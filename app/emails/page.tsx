import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Inbox, Send, ChevronDown, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isZohoImapConfigured } from "@/lib/zoho-imap";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { ZohoMailIcon } from "@/components/brand-icons";
import { SyncReplies } from "@/components/sync-replies";

export const metadata = {
  title: "Emails · Mujtaba Hires",
};

interface EmailRow {
  id: string;
  direction: "outbound" | "inbound";
  to_address: string;
  from_address: string | null;
  subject: string;
  body: string;
  status: "sent" | "failed" | "received";
  created_at: string;
  received_at: string | null;
  applications: {
    candidate_id: string;
    candidates: { full_name: string } | null;
    jobs: { id: string; title: string } | null;
  } | null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function EmailItem({ e }: { e: EmailRow }) {
  const inbound = e.direction === "inbound";
  const name = e.applications?.candidates?.full_name ?? "Unknown candidate";
  const job = e.applications?.jobs;
  const candidateId = e.applications?.candidate_id;
  const when = inbound ? e.received_at ?? e.created_at : e.created_at;

  return (
    <details className="group">
      <summary className="hover:bg-brand-ghost flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors">
        <ZohoMailIcon className="size-9" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{e.subject}</span>
            {e.status === "sent" ? (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                Sent
              </span>
            ) : e.status === "received" ? (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-sky-200 bg-sky-50 px-2 text-[11px] font-medium text-sky-700 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-300">
                Reply
              </span>
            ) : (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-red-200 bg-red-50 px-2 text-[11px] font-medium text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
                Failed
              </span>
            )}
          </div>
          <div className="text-text-secondary truncate text-xs">
            {inbound ? `From ${e.from_address ?? "unknown"}` : `To ${e.to_address}`} · {name}
            {job ? <> · {job.title}</> : null}
          </div>
        </div>
        <span className="text-text-tertiary hidden shrink-0 text-xs sm:block">{fmt(when)}</span>
        <ChevronDown className="text-text-tertiary size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t px-4 py-4">
        <div className="text-text-secondary mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs sm:hidden">
          <span>{fmt(when)}</span>
        </div>
        <div className="text-foreground/90 whitespace-pre-wrap text-sm">{e.body}</div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          {candidateId ? (
            <Link href={`/candidates/${candidateId}`} className="text-brand font-medium hover:underline">
              View candidate
            </Link>
          ) : null}
          {job ? (
            <Link href={`/jobs/${job.id}`} className="text-brand font-medium hover:underline">
              View role
            </Link>
          ) : null}
        </div>
      </div>
    </details>
  );
}

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "received" ? "received" : "sent";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("emails")
    .select(
      "id, direction, to_address, from_address, subject, body, status, created_at, received_at, applications(candidate_id, candidates(full_name), jobs(id, title))",
    )
    .order("created_at", { ascending: false });

  const { data: syncState } = await supabase
    .from("email_sync_state")
    .select("last_synced_at")
    .eq("id", 1)
    .maybeSingle();

  const emails = (data ?? []) as unknown as EmailRow[];
  const sentEmails = emails
    .filter((e) => e.direction !== "inbound")
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const receivedEmails = emails
    .filter((e) => e.direction === "inbound")
    .sort(
      (a, b) =>
        +new Date(b.received_at ?? b.created_at) - +new Date(a.received_at ?? a.created_at),
    );

  const sentCount = sentEmails.filter((e) => e.status === "sent").length;
  const failedCount = sentEmails.filter((e) => e.status === "failed").length;
  const receivedCount = receivedEmails.length;

  const list = activeTab === "received" ? receivedEmails : sentEmails;
  const imapConfigured = isZohoImapConfigured();

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors ${
      active
        ? "border-brand text-foreground"
        : "text-text-secondary hover:text-foreground border-transparent"
    }`;

  return (
    <AppShell email={user.email} avatarUrl={(user.user_metadata?.avatar_url as string | undefined) ?? null}>
      <div className="page-enter mx-auto w-full max-w-4xl px-5 py-7 md:px-6 md:py-9">
        <div className="mb-7">
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Emails</h1>
          <p className="text-text-secondary mt-1 text-sm">
            Messages sent to candidates and their replies, all in one place.
          </p>
        </div>

        {error ? (
          <div className="surface text-text-secondary border-dashed p-10 text-center text-sm">
            Couldn&apos;t load emails. The database schema may not be applied yet.
          </div>
        ) : (
          <>
            <section className="stagger mb-6 grid grid-cols-2 gap-3 sm:max-w-md lg:gap-4">
              <StatCard label="Sent" value={sentCount} icon={CheckCircle2} accent="emerald" />
              <StatCard label="Received" value={receivedCount} icon={Inbox} accent="blue" />
            </section>

            {/* Tabs */}
            <div className="border-border mb-4 flex items-center gap-6 border-b">
              <Link href="/emails?tab=sent" className={tabClass(activeTab === "sent")}>
                <Send className="size-4" /> Sent
                <span className="text-text-tertiary text-xs">{sentEmails.length}</span>
              </Link>
              <Link href="/emails?tab=received" className={tabClass(activeTab === "received")}>
                <Inbox className="size-4" /> Received
                <span className="text-text-tertiary text-xs">{receivedCount}</span>
              </Link>
            </div>

            {activeTab === "received" ? (
              imapConfigured ? (
                <SyncReplies lastSyncedAt={syncState?.last_synced_at ?? null} />
              ) : (
                <div className="surface mb-4 border-dashed p-4 text-center text-xs text-text-secondary">
                  To receive replies, enable IMAP in Zoho (Settings → Mail Accounts → IMAP Access).
                  The app reuses your existing Zoho credentials.
                </div>
              )
            ) : null}

            {list.length === 0 ? (
              <div className="surface flex flex-col items-center justify-center border-dashed px-6 py-16 text-center">
                <span className="bg-brand-muted text-brand mb-4 flex size-14 items-center justify-center rounded-2xl">
                  {activeTab === "received" ? <Inbox className="size-7" /> : <Mail className="size-7" />}
                </span>
                <h3 className="text-base font-semibold">
                  {activeTab === "received" ? "No replies yet" : "No emails sent yet"}
                </h3>
                <p className="text-text-secondary mt-1 max-w-sm text-sm">
                  {activeTab === "received"
                    ? "Candidate replies to your emails will show up here once they respond."
                    : "Emails you send to candidates — from the board, a profile, or on rejection — will appear here."}
                </p>
              </div>
            ) : (
              <div className="surface divide-y overflow-hidden">
                {list.map((e) => (
                  <EmailItem key={e.id} e={e} />
                ))}
                {activeTab === "sent" && failedCount > 0 ? (
                  <div className="text-text-tertiary px-4 py-2 text-xs">
                    {failedCount} failed send{failedCount === 1 ? "" : "s"} included above.
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
