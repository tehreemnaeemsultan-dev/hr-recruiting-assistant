import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABELS, type Stage } from "@/lib/constants";

/**
 * Export a single job's activity log as CSV (SPEC §6, Phase 6 — optional export).
 * One row per `events` entry for that job's applications, joined to the
 * candidate name so the file reads on its own. Authenticated (owner) only.
 */

interface EventRow {
  type: string;
  from_stage: Stage | null;
  to_stage: Stage | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  application_id: string;
}

/** Quote a field for CSV (RFC 4180): wrap in quotes, double any inner quotes. */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

const stageLabel = (s: Stage | null): string => (s ? STAGE_LABELS[s] : "");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  // Fetch the job, its applications (with candidate names), and every event
  // for those applications.
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("id", jobId)
    .single();
  if (jobErr || !job) return new NextResponse("Job not found", { status: 404 });

  const { data: apps, error: appsErr } = await supabase
    .from("applications")
    .select("id, candidate:candidates(full_name)")
    .eq("job_id", jobId);
  if (appsErr) return new NextResponse("Failed to load applications", { status: 500 });

  const appIds = (apps ?? []).map((a) => a.id);
  const nameByApp = new Map<string, string>(
    (apps ?? []).map((a) => {
      // Supabase types the joined relation loosely; normalize to a string.
      const c = a.candidate as { full_name?: string } | { full_name?: string }[] | null;
      const name = Array.isArray(c) ? c[0]?.full_name : c?.full_name;
      return [a.id, name ?? "(unknown)"];
    }),
  );

  let events: EventRow[] = [];
  if (appIds.length > 0) {
    const { data, error } = await supabase
      .from("events")
      .select("application_id, type, from_stage, to_stage, payload, created_at")
      .in("application_id", appIds)
      .order("created_at", { ascending: true });
    if (error) return new NextResponse("Failed to load events", { status: 500 });
    events = (data ?? []) as EventRow[];
  }

  const header = ["Timestamp", "Candidate", "Event", "From", "To", "Details"];
  const rows = events.map((e) => {
    const details =
      e.payload && Object.keys(e.payload).length > 0
        ? JSON.stringify(e.payload)
        : "";
    return [
      e.created_at,
      nameByApp.get(e.application_id) ?? "(unknown)",
      e.type,
      stageLabel(e.from_stage),
      stageLabel(e.to_stage),
      details,
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map((f) => csvField(String(f))).join(","))
    .join("\r\n");

  const slug =
    job.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "job";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-activity.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
