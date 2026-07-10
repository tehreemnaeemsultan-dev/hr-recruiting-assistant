import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Users, Clock, CheckCircle2, Plus, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Home · Mujtaba Hires",
};

type Stat = { label: string; value: number | null; icon: typeof Users };

async function getStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ stats: Stat[]; schemaReady: boolean }> {
  const countOf = async (
    build: () => PromiseLike<{ count: number | null; error: unknown }>,
  ): Promise<number | null> => {
    const { count, error } = await build();
    return error ? null : (count ?? 0);
  };

  const [openJobs, candidates, inProgress, hired] = await Promise.all([
    countOf(() =>
      supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "open"),
    ),
    countOf(() =>
      supabase.from("candidates").select("*", { count: "exact", head: true }),
    ),
    countOf(() =>
      supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .not("stage", "in", "(hired,rejected)"),
    ),
    countOf(() =>
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("stage", "hired"),
    ),
  ]);

  const schemaReady = [openJobs, candidates, inProgress, hired].every((v) => v !== null);
  return {
    stats: [
      { label: "Open roles", value: openJobs, icon: Briefcase },
      { label: "People", value: candidates, icon: Users },
      { label: "In progress", value: inProgress, icon: Clock },
      { label: "Hired", value: hired, icon: CheckCircle2 },
    ],
    schemaReady,
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { stats } = await getStats(supabase);
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, created_at")
    .order("created_at", { ascending: false });

  const name = user.email?.split("@")[0] ?? "there";

  return (
    <AppShell email={user.email}>
      <div className="mx-auto w-full max-w-6xl px-6 py-8 md:py-10">
        {/* Hero */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Welcome back, <span className="capitalize">{name}</span> 👋
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Here&apos;s how your hiring is going today.
            </p>
          </div>
          <Button render={<Link href="/jobs/new" />} nativeButton={false} className="gap-2">
            <Plus className="size-4" />
            New role
          </Button>
        </div>

        {/* Stat tiles */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="bg-card rounded-2xl border p-5 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">{s.label}</span>
                  <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-full">
                    <Icon className="size-[18px]" />
                  </span>
                </div>
                <div className="mt-3 font-mono text-3xl font-semibold tabular-nums">
                  {s.value ?? "—"}
                </div>
              </div>
            );
          })}
        </section>

        {/* Roles */}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your roles</h2>
            {jobs && jobs.length > 0 ? (
              <span className="text-muted-foreground text-sm">{jobs.length} total</span>
            ) : null}
          </div>

          {!jobs || jobs.length === 0 ? (
            <div className="bg-card flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
              <span className="bg-primary/10 text-primary mb-4 flex size-14 items-center justify-center rounded-2xl">
                <Briefcase className="size-7" />
              </span>
              <h3 className="text-base font-semibold">No roles yet</h3>
              <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                Create your first role, drop in a few CVs, and we&apos;ll help you
                find the best people fast.
              </p>
              <Button render={<Link href="/jobs/new" />} nativeButton={false} className="mt-5 gap-2">
                <Plus className="size-4" />
                Create your first role
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {jobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="group">
                  <div className="bg-card hover:border-primary/40 flex items-center justify-between gap-3 rounded-2xl border p-5 transition-all hover:shadow-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                        <Briefcase className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{job.title}</div>
                        <div className="text-muted-foreground text-xs">
                          Added {fmtDate(job.created_at)}
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
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
