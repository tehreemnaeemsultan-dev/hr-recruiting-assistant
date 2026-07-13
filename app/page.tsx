import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Users, Clock, CheckCircle2, Plus, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { AreaChart, DonutChart, BarChart, type Point, type Bar } from "@/components/charts";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/constants";

export const metadata = {
  title: "Dashboard · Mujtaba Hires",
};

const STAGE_COLORS: Record<Stage, string> = {
  new: "var(--chart-3)",
  screening: "var(--chart-2)",
  interview_1: "var(--chart-1)",
  interview_2: "oklch(0.62 0.19 300)",
  hired: "var(--chart-5)",
  rejected: "oklch(0.63 0.2 15)",
};

interface AppRow {
  stage: Stage;
  created_at: string;
  job_id: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Bucket applications into the last `weeks` calendar weeks for the area chart. */
function weeklyBuckets(apps: AppRow[], weeks = 8): Point[] {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const counts = new Array(weeks).fill(0);
  for (const a of apps) {
    const ago = Math.floor((now - Date.parse(a.created_at)) / weekMs);
    if (ago >= 0 && ago < weeks) counts[weeks - 1 - ago] += 1;
  }
  return counts.map((value, j) => {
    const ago = weeks - 1 - j;
    const label = new Date(now - ago * weekMs).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    return { label, value };
  });
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: jobs }, { data: appsRaw }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("applications").select("stage, created_at, job_id"),
  ]);

  const apps = (appsRaw ?? []) as AppRow[];
  const jobList = (jobs ?? []) as { id: string; title: string; status: string; created_at: string }[];

  const openJobs = jobList.filter((j) => j.status === "open").length;
  const totalCandidates = apps.length;
  const inProgress = apps.filter((a) => a.stage !== "hired" && a.stage !== "rejected").length;
  const hired = apps.filter((a) => a.stage === "hired").length;

  // Chart data (all real, computed in JS from the single applications query).
  const stageData = STAGES.map((s) => ({
    label: STAGE_LABELS[s],
    value: apps.filter((a) => a.stage === s).length,
    color: STAGE_COLORS[s],
  })).filter((d) => d.value > 0);

  const perRole: Bar[] = jobList
    .map((j) => ({ label: j.title, value: apps.filter((a) => a.job_id === j.id).length }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((d) => ({ ...d, label: d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label }));

  const timeline = weeklyBuckets(apps);
  const name = user.email?.split("@")[0] ?? "there";

  return (
    <AppShell email={user.email}>
      <div className="mx-auto w-full max-w-6xl px-5 py-7 md:px-6 md:py-9">
        {/* Hero */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Welcome back, <span className="capitalize">{name}</span> 👋
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Here&apos;s how your hiring is going today.
            </p>
          </div>
          <Button render={<Link href="/jobs/new" />} nativeButton={false} className="gap-2 rounded-xl">
            <Plus className="size-4" />
            New role
          </Button>
        </div>

        {/* Stat tiles */}
        <section className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard label="Open roles" value={openJobs} icon={Briefcase} accent="violet" />
          <StatCard label="People" value={totalCandidates} icon={Users} accent="blue" />
          <StatCard label="In progress" value={inProgress} icon={Clock} accent="amber" />
          <StatCard label="Hired" value={hired} icon={CheckCircle2} accent="emerald" />
        </section>

        {/* Charts */}
        {totalCandidates > 0 ? (
          <section className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="surface animate-in fade-in slide-in-from-bottom-2 p-5 duration-500 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Applications over time</h2>
                  <p className="text-muted-foreground text-xs">Last 8 weeks</p>
                </div>
              </div>
              <AreaChart data={timeline} height={240} />
            </div>

            <div className="surface animate-in fade-in slide-in-from-bottom-2 p-5 duration-500">
              <h2 className="mb-4 text-base font-semibold">Pipeline by stage</h2>
              {stageData.length > 0 ? (
                <DonutChart
                  data={stageData}
                  centerValue={totalCandidates}
                  centerLabel="people"
                />
              ) : (
                <p className="text-muted-foreground text-sm">No candidates yet.</p>
              )}
            </div>

            {perRole.length > 0 ? (
              <div className="surface animate-in fade-in slide-in-from-bottom-2 p-5 duration-500 lg:col-span-3">
                <h2 className="mb-4 text-base font-semibold">Candidates by role</h2>
                <BarChart data={perRole} height={220} />
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Roles */}
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your roles</h2>
            {jobList.length > 0 ? (
              <span className="text-muted-foreground text-sm">{jobList.length} total</span>
            ) : null}
          </div>

          {jobList.length === 0 ? (
            <div className="surface flex flex-col items-center justify-center border-dashed px-6 py-16 text-center">
              <span className="bg-primary/10 text-primary mb-4 flex size-14 items-center justify-center rounded-2xl">
                <Briefcase className="size-7" />
              </span>
              <h3 className="text-base font-semibold">No roles yet</h3>
              <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                Create your first role, drop in a few CVs, and we&apos;ll help you
                find the best people fast.
              </p>
              <Button render={<Link href="/jobs/new" />} nativeButton={false} className="mt-5 gap-2 rounded-xl">
                <Plus className="size-4" />
                Create your first role
              </Button>
            </div>
          ) : (
            <div className="stagger grid gap-3 sm:grid-cols-2">
              {jobList.map((job) => {
                const count = apps.filter((a) => a.job_id === job.id).length;
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="group">
                    <div className="surface hover:border-primary/40 flex items-center justify-between gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                          <Briefcase className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{job.title}</div>
                          <div className="text-muted-foreground text-xs">
                            {count} {count === 1 ? "person" : "people"} · Added{" "}
                            {fmtDate(job.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={job.status === "open" ? "secondary" : "outline"}>
                          {job.status === "open" ? "Open" : "Closed"}
                        </Badge>
                        <ArrowRight className="text-muted-foreground group-hover:text-foreground size-4 transition-colors" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
