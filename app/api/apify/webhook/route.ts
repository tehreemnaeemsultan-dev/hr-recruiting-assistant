import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestRunResults } from "@/lib/sourcing";

/**
 * Apify run-finished webhook (SPEC §8.1). Verifies APIFY_WEBHOOK_SECRET, then
 * ingests the run's dataset into sourced_profiles (needs-review). No user session
 * here, so it uses the service-role client. Runs on the Node runtime (excluded
 * from the auth proxy matcher).
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (
    !process.env.APIFY_WEBHOOK_SECRET ||
    secret !== process.env.APIFY_WEBHOOK_SECRET
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const resource = body.resource as Record<string, unknown> | undefined;
  const eventData = body.eventData as Record<string, unknown> | undefined;
  const runId =
    (resource?.id as string | undefined) ??
    (eventData?.actorRunId as string | undefined);
  if (!runId) return new NextResponse("No run id", { status: 400 });

  const admin = createAdminClient();
  const { data: run } = await admin
    .from("sourcing_runs")
    .select("id, apify_run_id, apify_dataset_id, query")
    .eq("apify_run_id", runId)
    .single();
  if (!run) return NextResponse.json({ ok: true, note: "run not tracked" });

  try {
    await ingestRunResults(admin, run);
  } catch (e) {
    // Return 200 so Apify doesn't retry-storm; the run stays pollable in the UI.
    return NextResponse.json({ ok: false, error: String(e) });
  }
  return NextResponse.json({ ok: true });
}
