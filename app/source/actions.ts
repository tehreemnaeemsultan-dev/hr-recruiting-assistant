"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getSourceActors,
  startProfileSearch,
  isApifyConfigured,
  type StartedRun,
} from "@/lib/apify";
import { ingestRunResults } from "@/lib/sourcing";
import { scoreCandidate, isScoringConfigured } from "@/lib/scoring";

const MAX_RESULTS = 25;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return supabase;
}

export type SourcingState = { error: string } | { ok: true } | undefined;

/** Start a cookieless LinkedIn search on Apify and record the run. */
export async function startSourcing(
  _prev: SourcingState,
  formData: FormData,
): Promise<SourcingState> {
  const supabase = await requireUser();
  if (!supabase) return { error: "You are signed out. Please sign in again." };
  if (!isApifyConfigured()) {
    return { error: "Sourcing isn't configured yet (APIFY_TOKEN missing)." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  let maxItems = parseInt(String(formData.get("maxItems") ?? "10"), 10);
  if (!Number.isFinite(maxItems) || maxItems < 1) maxItems = 10;
  maxItems = Math.min(maxItems, MAX_RESULTS);

  if (!title) return { error: "Enter a role or title to search for." };

  const query = { title, location, company, maxItems };

  // Try each cookieless actor in order; if one fails to start (e.g. its usage
  // limit/quota is hit), automatically fall back to the next.
  const actors = getSourceActors();
  let run: StartedRun | null = null;
  let usedSlug = "";
  let lastErr = "Failed to start search.";
  for (const actor of actors) {
    try {
      run = await startProfileSearch(actor.buildInput(query), actor.slug);
      usedSlug = actor.slug;
      break;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : lastErr;
      // fall through to the next actor
    }
  }
  if (!run) {
    return { error: `Sourcing providers are unavailable right now. ${lastErr}` };
  }

  const { error } = await supabase.from("sourcing_runs").insert({
    apify_run_id: run.runId,
    apify_dataset_id: run.datasetId,
    actor: usedSlug,
    query,
    status: "running",
  });
  if (error) return { error: error.message };

  revalidatePath("/source");
  return { ok: true };
}

/** Check an in-flight run and ingest its results if finished. */
export async function pollSourcingRun(
  sourcingRunId: string,
): Promise<{ ok: true; status: string; count?: number } | { ok: false; error: string }> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };

  const { data: run } = await supabase
    .from("sourcing_runs")
    .select("id, apify_run_id, apify_dataset_id, query")
    .eq("id", sourcingRunId)
    .single();
  if (!run) return { ok: false, error: "Search not found." };

  try {
    const r = await ingestRunResults(supabase, run);
    revalidatePath("/source");
    return { ok: true, status: r.status, count: r.count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Check failed." };
  }
}

/** Import a reviewed profile into a role: create candidate + application, then score. */
export async function importSourcedProfile(
  profileId: string,
  jobId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("sourced_profiles")
    .select("*")
    .eq("id", profileId)
    .single();
  if (!profile) return { ok: false, error: "Profile not found." };

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, jd_text, criteria_text")
    .eq("id", jobId)
    .single();
  if (!job) return { ok: false, error: "Role not found." };

  // Create the candidate (source = linkedin).
  const { data: cand, error: cErr } = await supabase
    .from("candidates")
    .insert({
      full_name: profile.full_name,
      source: "linkedin",
      linkedin_url: profile.linkedin_url,
      raw_text: profile.raw_text,
      parsed: profile.parsed ?? {},
    })
    .select("id")
    .single();
  if (cErr || !cand) return { ok: false, error: cErr?.message ?? "Could not save candidate." };

  const { data: app, error: aErr } = await supabase
    .from("applications")
    .insert({ job_id: jobId, candidate_id: cand.id, stage: "new" })
    .select("id")
    .single();
  if (aErr || !app) return { ok: false, error: aErr?.message ?? "Could not add to role." };

  // Score like an uploaded CV (best-effort).
  if (isScoringConfigured() && profile.raw_text) {
    try {
      const breakdown = await scoreCandidate({
        jobTitle: job.title,
        jdText: job.jd_text,
        criteriaText: job.criteria_text,
        rawText: profile.raw_text,
      });
      await supabase
        .from("applications")
        .update({
          score: breakdown.overall_score,
          score_breakdown: breakdown,
          score_summary: breakdown.summary,
        })
        .eq("id", app.id);
    } catch {
      // Leave unscored; owner can re-review from the role page.
    }
  }

  await supabase
    .from("sourced_profiles")
    .update({ status: "imported", candidate_id: cand.id })
    .eq("id", profileId);

  revalidatePath("/source");
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function dismissSourcedProfile(
  profileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };
  const { error } = await supabase
    .from("sourced_profiles")
    .update({ status: "dismissed" })
    .eq("id", profileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/source");
  return { ok: true };
}

export async function deleteSourcingRun(
  sourcingRunId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };
  const { error } = await supabase.from("sourcing_runs").delete().eq("id", sourcingRunId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/source");
  return { ok: true };
}
