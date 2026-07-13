import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Columns3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  PipelineBoard,
  type BoardItem,
  type JobOption,
} from "@/components/pipeline-board";
import type { Stage } from "@/lib/constants";

export const metadata = {
  title: "Board · Mujtaba Hires",
};

interface BoardRow {
  id: string;
  candidate_id: string;
  stage: string;
  score: number | null;
  job_id: string;
  candidates: { full_name: string; source: string; email: string | null } | null;
}

export default async function BoardHomePage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const { job: jobParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: jobsData }, { data: rowsData }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("applications")
      .select(
        "id, candidate_id, stage, score, job_id, candidates(full_name, source, email)",
      ),
  ]);

  const jobsList = (jobsData ?? []) as { id: string; title: string }[];
  const rows = (rowsData ?? []) as unknown as BoardRow[];

  // Empty state — no roles yet.
  if (jobsList.length === 0) {
    return (
      <AppShell email={user.email} avatarUrl={(user.user_metadata?.avatar_url as string | undefined) ?? null}>
        <div className="page-enter mx-auto w-full max-w-2xl px-5 py-16 md:px-6">
          <div className="surface flex flex-col items-center justify-center border-dashed px-6 py-16 text-center">
            <span className="bg-brand-muted text-brand mb-4 flex size-14 items-center justify-center rounded-2xl">
              <Columns3 className="size-7" />
            </span>
            <h3 className="text-base font-semibold">No roles yet</h3>
            <p className="text-text-secondary mt-1 max-w-sm text-sm">
              Create your first role, drop in a few CVs, and your pipeline board
              will appear right here.
            </p>
            <Button
              render={<Link href="/jobs/new" />}
              nativeButton={false}
              className="mt-5 gap-2"
            >
              <Plus className="size-4" />
              Create your first role
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const jobOptions: JobOption[] = jobsList.map((j) => ({
    id: j.id,
    title: j.title,
    count: rows.filter((r) => r.job_id === j.id).length,
  }));

  // Selected role: ?job= if valid, else the most recent role.
  const selected =
    jobOptions.find((j) => j.id === jobParam) ?? jobOptions[0];

  const items: BoardItem[] = rows
    .filter((r) => r.job_id === selected.id)
    .map((a) => ({
      applicationId: a.id,
      candidateId: a.candidate_id,
      fullName: a.candidates?.full_name ?? "Unknown candidate",
      email: a.candidates?.email ?? null,
      score: a.score,
      source: a.candidates?.source ?? "upload",
      stage: a.stage as Stage,
    }));

  return (
    <AppShell email={user.email} avatarUrl={(user.user_metadata?.avatar_url as string | undefined) ?? null}>
      <div className="page-enter flex min-w-0 flex-col px-5 py-5 md:px-6">
        <PipelineBoard
          key={selected.id}
          jobId={selected.id}
          jobTitle={selected.title}
          initialItems={items}
          jobs={jobOptions}
          selectedJobId={selected.id}
        />
      </div>
    </AppShell>
  );
}
