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
import {
  computeAnalytics,
  formatDuration,
  FUNNEL_STAGES,
  type JobAnalytics,
} from "@/lib/analytics";

export const metadata = {
  title: "Analytics · Mujtaba Hires",
};

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
}) {
  return (
    <div className="bg-card rounded-2xl border p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-full">
          <Icon className="size-[18px]" />
        </span>
      </div>
      <div className="mt-3 font-mono text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function JobCard({ job }: { job: JobAnalytics }) {
  const funnel = FUNNEL_STAGES.map((s) => job.stages.find((x) => x.stage === s)!);
  const top = Math.max(1, ...funnel.map((f) => f.reached));

  return (
    <div className="bg-card rounded-2xl border p-6">
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
            <div className="space-y-2.5">
              {funnel.map((f) => (
                <div key={f.stage}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{f.label}</span>
                    <span className="text-muted-foreground tabular-nums">{f.reached}</span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${(f.reached / top) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
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
                    <td className="py-2">{s.label}</td>
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

  return (
    <AppShell email={user.email}>
      <div className="mx-auto w-full max-w-6xl px-6 py-8 md:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Analytics</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Pipeline health and timing, computed from your activity log.
          </p>
        </div>

        {!schemaReady ? (
          <div className="bg-card rounded-2xl border border-dashed p-10 text-center">
            <p className="text-muted-foreground text-sm">
              Couldn&apos;t load analytics. The database schema may not be applied yet.
            </p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <StatTile label="Candidates" value={overall.totalCandidates} icon={Users} />
              <StatTile label="In progress" value={overall.inProgress} icon={Clock} />
              <StatTile label="Hired" value={overall.hired} icon={CheckCircle2} />
              <StatTile label="Rejected" value={overall.rejected} icon={XCircle} />
            </section>

            {overall.avgTimeToHireMs !== null && (
              <p className="text-muted-foreground mt-4 text-sm">
                Average time-to-hire across roles:{" "}
                <span className="text-foreground font-medium">
                  {formatDuration(overall.avgTimeToHireMs)}
                </span>
              </p>
            )}

            <section className="mt-10">
              <h2 className="mb-4 text-lg font-semibold">By role</h2>
              {jobs.length === 0 ? (
                <div className="bg-card flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
                  <span className="bg-primary/10 text-primary mb-4 flex size-14 items-center justify-center rounded-2xl">
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
                    className="mt-5 gap-2"
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
