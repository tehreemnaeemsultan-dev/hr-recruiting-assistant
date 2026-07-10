import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRun, getDatasetItems, normalizeProfile } from "@/lib/apify";

interface RunRow {
  id: string;
  apify_run_id: string | null;
  apify_dataset_id: string | null;
  query: { maxItems?: number } | null;
}

/**
 * Fetch an Apify run's status; when it has succeeded, ingest the dataset into
 * `sourced_profiles` (once) and mark the run. Shared by the poll action and the
 * webhook. Works with either the authenticated or the service-role client.
 */
export async function ingestRunResults(
  supabase: SupabaseClient,
  run: RunRow,
): Promise<{ done: boolean; status: string; count?: number }> {
  if (!run.apify_run_id) return { done: true, status: "failed" };

  const status = await getRun(run.apify_run_id);
  if (status.status === "RUNNING" || status.status === "READY") {
    return { done: false, status: "running" };
  }
  if (status.status !== "SUCCEEDED") {
    await supabase
      .from("sourcing_runs")
      .update({ status: "failed", error: `Apify run ${status.status}` })
      .eq("id", run.id);
    return { done: true, status: "failed" };
  }

  const datasetId = run.apify_dataset_id || status.datasetId;
  const cap = run.query?.maxItems ?? 25;
  const items = datasetId ? await getDatasetItems(datasetId, cap) : [];

  // Ingest only once per run.
  const { count } = await supabase
    .from("sourced_profiles")
    .select("*", { count: "exact", head: true })
    .eq("sourcing_run_id", run.id);

  if (!count) {
    const rows = items.map((item) => {
      const p = normalizeProfile(item);
      return {
        sourcing_run_id: run.id,
        full_name: p.full_name,
        headline: p.headline,
        location: p.location,
        linkedin_url: p.linkedin_url,
        about: p.about,
        raw_text: p.raw_text,
        parsed: p.parsed,
        status: "new",
      };
    });
    if (rows.length) {
      await supabase.from("sourced_profiles").insert(rows);
    }
  }

  await supabase
    .from("sourcing_runs")
    .update({
      status: "succeeded",
      result_count: items.length,
      apify_dataset_id: datasetId,
    })
    .eq("id", run.id);

  return { done: true, status: "succeeded", count: items.length };
}
