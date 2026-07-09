import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Dashboard · HR Recruiting Assistant",
};

type Stat = { label: string; value: number | null };

async function getStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ stats: Stat[]; schemaReady: boolean }> {
  const countOf = async (
    build: () => PromiseLike<{ count: number | null; error: unknown }>,
  ): Promise<number | null> => {
    const { count, error } = await build();
    return error ? null : (count ?? 0);
  };

  const [openJobs, candidates, inPipeline, hired] = await Promise.all([
    countOf(() =>
      supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "open"),
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
      supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("stage", "hired"),
    ),
  ]);

  const schemaReady = [openJobs, candidates, inPipeline, hired].every(
    (v) => v !== null,
  );

  return {
    stats: [
      { label: "Open jobs", value: openJobs },
      { label: "Candidates", value: candidates },
      { label: "In pipeline", value: inPipeline },
      { label: "Hired", value: hired },
    ],
    schemaReady,
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { stats, schemaReady } = await getStats(supabase);

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader email={user.email} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Overview of your hiring pipeline.
          </p>
        </div>

        {!schemaReady ? (
          <Card className="mb-6 border-destructive/40">
            <CardHeader>
              <CardTitle className="text-base">Database not ready</CardTitle>
              <CardDescription>
                Connected to Supabase, but the tables could not be read. Apply
                the migration in <code>supabase/migrations</code> and reload.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader>
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-3xl">{stat.value ?? "—"}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Jobs</CardTitle>
              <CardDescription>
                No jobs yet. Creating jobs and ranking CVs arrives in Phase 1.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </main>
    </div>
  );
}
