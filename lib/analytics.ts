// Phase 6 — Tracking and analytics.
//
// Everything here is computed from the `events` audit log (plus `applications`
// for the current snapshot). Single-user internal tool: data volume is tiny, so
// we fetch the rows and reduce them in JS rather than pushing SQL window
// functions into Postgres. All access is server-side (SPEC §11).

import type { SupabaseClient } from "@supabase/supabase-js";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/constants";

/** Linear progression stages for the funnel (rejected is a terminal off-ramp). */
export const FUNNEL_STAGES = [
  "new",
  "screening",
  "interview_1",
  "interview_2",
  "hired",
] as const satisfies readonly Stage[];

const STAGE_ORDER: Record<Stage, number> = Object.fromEntries(
  STAGES.map((s, i) => [s, i]),
) as Record<Stage, number>;

export interface StageStat {
  stage: Stage;
  label: string;
  /** Applications currently sitting in this stage. */
  current: number;
  /** Applications that ever entered this stage (funnel reach). */
  reached: number;
  /** Average completed time spent in this stage, in ms (null if never exited). */
  avgMs: number | null;
  /** Number of completed (exited) visits that fed avgMs. */
  samples: number;
}

export interface JobAnalytics {
  jobId: string;
  title: string;
  status: string;
  total: number;
  stages: StageStat[];
  rejected: number;
  hired: number;
  /** Average time from application creation to reaching `hired`, in ms. */
  avgTimeToHireMs: number | null;
}

export interface Analytics {
  overall: {
    totalCandidates: number;
    inProgress: number;
    hired: number;
    rejected: number;
    avgTimeToHireMs: number | null;
  };
  jobs: JobAnalytics[];
  schemaReady: boolean;
}

interface AppRow {
  id: string;
  job_id: string;
  stage: Stage;
  created_at: string;
}

interface EventRow {
  application_id: string;
  type: string;
  from_stage: Stage | null;
  to_stage: Stage | null;
  created_at: string;
}

/** One contiguous span an application spent in a single stage. */
interface Segment {
  stage: Stage;
  enteredAt: number;
  exitedAt: number | null; // null = still in this stage (the current one)
}

/**
 * Reconstruct an application's stage timeline from its `stage_changed` events.
 * Every application starts in `new` at its creation time; each stage change
 * closes the open segment and opens the next.
 */
function buildTimeline(app: AppRow, events: EventRow[]): Segment[] {
  const changes = events
    .filter((e) => e.type === "stage_changed" && e.to_stage)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  const segments: Segment[] = [
    { stage: "new", enteredAt: Date.parse(app.created_at), exitedAt: null },
  ];

  for (const ev of changes) {
    const t = Date.parse(ev.created_at);
    const open = segments[segments.length - 1];
    open.exitedAt = t;
    segments.push({ stage: ev.to_stage as Stage, enteredAt: t, exitedAt: null });
  }

  return segments;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Compute the full analytics payload for the dashboard. */
export async function computeAnalytics(
  supabase: SupabaseClient,
): Promise<Analytics> {
  const [jobsRes, appsRes, eventsRes] = await Promise.all([
    supabase.from("jobs").select("id, title, status, created_at").order("created_at", { ascending: false }),
    supabase.from("applications").select("id, job_id, stage, created_at"),
    supabase.from("events").select("application_id, type, from_stage, to_stage, created_at"),
  ]);

  if (jobsRes.error || appsRes.error || eventsRes.error) {
    return {
      overall: { totalCandidates: 0, inProgress: 0, hired: 0, rejected: 0, avgTimeToHireMs: null },
      jobs: [],
      schemaReady: false,
    };
  }

  const jobs = (jobsRes.data ?? []) as { id: string; title: string; status: string; created_at: string }[];
  const apps = (appsRes.data ?? []) as AppRow[];
  const events = (eventsRes.data ?? []) as EventRow[];

  // Bucket events by application for timeline reconstruction.
  const eventsByApp = new Map<string, EventRow[]>();
  for (const e of events) {
    const list = eventsByApp.get(e.application_id);
    if (list) list.push(e);
    else eventsByApp.set(e.application_id, [e]);
  }

  const jobAnalytics: JobAnalytics[] = jobs.map((job) => {
    const jobApps = apps.filter((a) => a.job_id === job.id);

    // Per-stage accumulators.
    const current: Record<Stage, number> = blankStageCounts();
    const reached: Record<Stage, number> = blankStageCounts();
    const durations: Record<Stage, number[]> = blankStageDurations();
    const timeToHire: number[] = [];

    for (const app of jobApps) {
      current[app.stage] = (current[app.stage] ?? 0) + 1;

      const timeline = buildTimeline(app, eventsByApp.get(app.id) ?? []);
      const seen = new Set<Stage>();
      for (const seg of timeline) {
        if (!seen.has(seg.stage)) {
          reached[seg.stage] += 1;
          seen.add(seg.stage);
        }
        if (seg.exitedAt !== null) {
          durations[seg.stage].push(seg.exitedAt - seg.enteredAt);
        }
      }

      // Time-to-hire: creation → entry into the `hired` segment.
      const hiredSeg = timeline.find((s) => s.stage === "hired");
      if (hiredSeg) timeToHire.push(hiredSeg.enteredAt - Date.parse(app.created_at));
    }

    const stages: StageStat[] = STAGES.map((stage) => ({
      stage,
      label: STAGE_LABELS[stage],
      current: current[stage],
      reached: reached[stage],
      avgMs: avg(durations[stage]),
      samples: durations[stage].length,
    }));

    return {
      jobId: job.id,
      title: job.title,
      status: job.status,
      total: jobApps.length,
      stages,
      rejected: current.rejected,
      hired: current.hired,
      avgTimeToHireMs: avg(timeToHire),
    };
  });

  const overall = {
    totalCandidates: apps.length,
    inProgress: apps.filter((a) => a.stage !== "hired" && a.stage !== "rejected").length,
    hired: apps.filter((a) => a.stage === "hired").length,
    rejected: apps.filter((a) => a.stage === "rejected").length,
    avgTimeToHireMs: avg(jobAnalytics.flatMap((j) => (j.avgTimeToHireMs !== null ? [j.avgTimeToHireMs] : []))),
  };

  return { overall, jobs: jobAnalytics, schemaReady: true };
}

function blankStageCounts(): Record<Stage, number> {
  return Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
}
function blankStageDurations(): Record<Stage, number[]> {
  return Object.fromEntries(STAGES.map((s) => [s, [] as number[]])) as Record<Stage, number[]>;
}

/** Human-friendly duration, e.g. "3d 4h", "5h", "12m", "—" for null. */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const rem = mins % 60;
    return rem ? `${hours}h ${rem}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}

export { STAGE_ORDER };
