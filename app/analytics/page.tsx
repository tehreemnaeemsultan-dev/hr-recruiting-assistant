import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Download,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { DonutChart, BarChart, FunnelBars, type Bar } from "@/components/charts";
import { STAGE_HEX } from "@/components/stage-badge";
import {
  computeAnalytics,
  formatDuration,
  FUNNEL_STAGES,
  type JobAnalytics,
} from "@/lib/analytics";
import { STAGES, STAGE_LABELS } from "@/lib/constants";

export const metadata = {
  title: "Analytics · Mujtaba Hires",
};

function JobCard({ job }: { job: JobAnalytics }) {
  const funnel = FUNNEL_STAGES.map((s) => job.stages.find((x) => x.stage === s)!);

  return (
    <div className="surface p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/jobs/${job.jobId}`}
            className="hover:text-primary truncate text-base font-semibold transition-colors"
          >
            {job.title}
          </Link>
          <Badge variant={job.status === "open" ? "secondary" : "outline"}>
            {job.status === "open" ? "Open" : "Closed"}
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-sm">
            {job.total} {job.total === 1 ? "candidate" : "candidates"}
            {job.avgTimeToHireMs !== null && (
              <> · avg time-to-hire {formatDuration(job.avgTimeToHireMs)}</>
            )}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            render={<a href={`/api/analytics/${job.jobId}/export`} download />}
            nativeButton={false}
          >
            <Download className="size-4" />
            CSV
          </Button>
        </div>
      </div>

      {job.total === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No candidates in this role yet.
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Funnel — how many candidates ever reached each stage */}
          <div>
            <h4 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
              Funnel (ever reached)
            </h4>
            <FunnelBars
              data={funnel.map((f) => ({
                label: f.label,
                value: f.reached,
                color: STAGE_HEX[f.stage],
              }))}
            />
            {job.rejected > 0 && (
              <p className="text-muted-foreground mt-3 text-xs">
                {job.rejected} rejected
              </p>
            )}
          </div>

          {/* Per-stage: current count + average time in stage */}
          <div>
            <h4 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
              By stage
            </h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-left text-xs">
                  <th className="pb-2 font-medium">Stage</th>
                  <th className="pb-2 text-right font-medium">Now</th>
                  <th className="pb-2 text-right font-medium">Avg time</th>
                </tr>
              </thead>
              <tbody>
                {job.stages.map((s) => (
                  <tr key={s.stage} className="border-t">
                    <td className="py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: STAGE_HEX[s.stage] }}
                        />
                        {s.label}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{s.current}</td>
                    <td className="text-muted-foreground py-2 text-right tabular-nums">
                      {formatDuration(s.avgMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted-foreground mt-2 text-xs">
              Avg time = mean of completed visits to a stage.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { overall, jobs, schemaReady } = await computeAnalytics(supabase);

  // Aggregate current per-stage counts across every role for the overview donut.
  const stageTotals = STAGES.map((stage) => ({
    label: STAGE_LABELS[stage],
    value: jobs.reduce(
      (sum, j) => sum + (j.stages.find((s) => s.stage === stage)?.current ?? 0),
      0,
    ),
    color: STAGE_HEX[stage],
  })).filter((d) => d.value > 0);

  const perRole: Bar[] = jobs
    .filter((j) => j.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map((j) => ({
      label: j.title.length > 14 ? j.title.slice(0, 13) + "…" : j.title,
      value: j.total,
    }));

  return (
    <AppShell email={user.email}>
      <div className="page-enter mx-auto w-full max-w-6xl px-5 py-7 md:px-6 md:py-9">
        <div className="mb-7">
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
            Analytics
          </h1>
          <p className="text-text-secondary mt-1 text-sm">
            Pipeline health and timing, computed from your activity log.
          </p>
        </div>

        {!schemaReady ? (
          <div className="surface border-dashed p-10 text-center">
            <p className="text-muted-foreground text-sm">
              Couldn&apos;t load analytics. The database schema may not be applied yet.
            </p>
          </div>
        ) : (
          <>
            <section className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <StatCard label="Candidates" value={overall.totalCandidates} icon={Users} accent="blue" />
              <StatCard label="In progress" value={overall.inProgress} icon={Clock} accent="amber" />
              <StatCard label="Hired" value={overall.hired} icon={CheckCircle2} accent="emerald" />
              <StatCard label="Rejected" value={overall.rejected} icon={XCircle} accent="red" />
            </section>

            {overall.avgTimeToHireMs !== null && (
              <div className="surface mt-4 flex items-center gap-4 p-5">
                <span className="bg-brand-muted text-brand flex size-12 shrink-0 items-center justify-center rounded-xl">
                  <Clock className="size-6" />
                </span>
                <div>
                  <div className="text-text-secondary text-sm">
                    Average time-to-hire across roles
                  </div>
                  <div className="text-2xl font-bold tabular-nums">
                    {formatDuration(overall.avgTimeToHireMs)}
                  </div>
                </div>
              </div>
            )}

            {overall.totalCandidates > 0 ? (
              <section className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="surface p-5">
                  <h2 className="text-sm font-semibold">Overall by stage</h2>
                  <p className="text-text-secondary mb-4 text-xs">
                    Active candidates now
                  </p>
                  {stageTotals.length > 0 ? (
                    <DonutChart
                      data={stageTotals}
                      centerValue={overall.inProgress + overall.hired}
                      centerLabel="active"
                    />
                  ) : (
                    <p className="text-text-secondary text-sm">No active candidates.</p>
                  )}
                </div>
                {perRole.length > 0 ? (
                  <div className="surface p-5 lg:col-span-2">
                    <h2 className="text-sm font-semibold">Candidates by role</h2>
                    <p className="text-text-secondary mb-4 text-xs">
                      Total per role
                    </p>
                    <BarChart data={perRole} height={200} />
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="mt-8">
              <h2 className="mb-4 text-lg font-semibold">By role</h2>
              {jobs.length === 0 ? (
                <div className="surface flex flex-col items-center justify-center border-dashed px-6 py-16 text-center">
                  <span className="bg-brand-muted text-brand mb-4 flex size-14 items-center justify-center rounded-2xl">
                    <BarChart3 className="size-7" />
                  </span>
                  <h3 className="text-base font-semibold">Nothing to chart yet</h3>
                  <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                    Create a role and move candidates through your pipeline — their
                    activity will show up here.
                  </p>
                  <Button
                    render={<Link href="/jobs/new" />}
                    nativeButton={false}
                    className="mt-5 gap-2 rounded-xl"
                  >
                    Create a role
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <JobCard key={job.jobId} job={job} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
