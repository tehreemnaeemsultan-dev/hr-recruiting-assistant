"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isZohoImapConfigured, fetchInboxSince } from "@/lib/zoho-imap";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return supabase;
}

const SYNC_COOLDOWN_MS = 45_000; // don't hammer IMAP on every page open
const OVERLAP_MS = 24 * 60 * 60 * 1000; // re-scan last day to catch boundary msgs
const INITIAL_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000; // first sync: last 30 days

type SyncResult =
  | { ok: true; skipped?: boolean; fetched?: number; inserted?: number; unmatched?: number }
  | { ok: false; error: string };

/** Fetch new candidate replies from the Zoho inbox and store matched ones. */
export async function syncInboundEmails(opts?: { force?: boolean }): Promise<SyncResult> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };
  if (!isZohoImapConfigured()) {
    return { ok: false, error: "Zoho IMAP is not configured." };
  }

  const { data: state } = await supabase
    .from("email_sync_state")
    .select("last_synced_at")
    .eq("id", 1)
    .maybeSingle();

  const lastSynced = state?.last_synced_at ? new Date(state.last_synced_at) : null;
  if (
    !opts?.force &&
    lastSynced &&
    Date.now() - lastSynced.getTime() < SYNC_COOLDOWN_MS
  ) {
    return { ok: true, skipped: true };
  }

  const since = lastSynced
    ? new Date(lastSynced.getTime() - OVERLAP_MS)
    : new Date(Date.now() - INITIAL_LOOKBACK_MS);

  try {
    const messages = await fetchInboxSince(since);
    const withId = messages.filter((m) => m.messageId);

    // Skip messages already stored (Message-IDs are globally unique).
    const ids = withId.map((m) => m.messageId as string);
    const existing = new Set<string>();
    if (ids.length) {
      const { data: rows } = await supabase
        .from("emails")
        .select("message_id")
        .in("message_id", ids);
      for (const r of rows ?? []) if (r.message_id) existing.add(r.message_id);
    }

    // Preload sent messages so replies can be threaded back to an application.
    const { data: outbound } = await supabase
      .from("emails")
      .select("application_id, message_id, provider_message_id")
      .eq("direction", "outbound");
    const threadMap = new Map<string, string>();
    for (const o of outbound ?? []) {
      if (o.message_id) threadMap.set(o.message_id, o.application_id);
      if (o.provider_message_id) threadMap.set(o.provider_message_id, o.application_id);
    }

    const ourAddress = process.env.ZOHO_SMTP_USER ?? "";
    const nowIso = new Date().toISOString();
    const toInsert: Record<string, unknown>[] = [];
    let unmatched = 0;

    for (const m of withId) {
      const mid = m.messageId as string;
      if (existing.has(mid)) continue;

      // 1) Thread match: In-Reply-To / References point at a sent Message-ID.
      const refIds = [m.inReplyTo, ...m.references].filter(Boolean) as string[];
      let applicationId: string | null = null;
      for (const rid of refIds) {
        const hit = threadMap.get(rid);
        if (hit) {
          applicationId = hit;
          break;
        }
      }

      // 2) Fallback: sender address -> that candidate's most recent application.
      if (!applicationId && m.fromAddress) {
        const { data: cands } = await supabase
          .from("candidates")
          .select("id")
          .ilike("email", m.fromAddress)
          .limit(5);
        const candIds = (cands ?? []).map((c) => c.id);
        if (candIds.length) {
          const { data: apps } = await supabase
            .from("applications")
            .select("id")
            .in("candidate_id", candIds)
            .order("created_at", { ascending: false })
            .limit(1);
          applicationId = apps?.[0]?.id ?? null;
        }
      }

      if (!applicationId) {
        unmatched++;
        continue;
      }

      toInsert.push({
        application_id: applicationId,
        direction: "inbound",
        from_address: m.fromAddress,
        to_address: ourAddress || m.fromAddress || "unknown",
        subject: m.subject,
        body: m.text,
        provider: "zoho",
        status: "received",
        message_id: mid,
        in_reply_to: m.inReplyTo,
        received_at: m.date ?? nowIso,
      });
      existing.add(mid); // guard against duplicates within this batch
    }

    if (toInsert.length) {
      const { error: insErr } = await supabase.from("emails").insert(toInsert);
      if (insErr) throw new Error(insErr.message);
    }

    await supabase
      .from("email_sync_state")
      .upsert({ id: 1, last_synced_at: nowIso, last_error: null }, { onConflict: "id" });

    revalidatePath("/emails");
    return { ok: true, fetched: messages.length, inserted: toInsert.length, unmatched };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to sync inbox.";
    await supabase
      .from("email_sync_state")
      .upsert({ id: 1, last_error: msg }, { onConflict: "id" });
    return { ok: false, error: msg };
  }
}
