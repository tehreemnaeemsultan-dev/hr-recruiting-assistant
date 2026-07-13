import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { RoleTabs } from "@/components/role-tabs";
import { PipelineBoard, type BoardItem } from "@/components/pipeline-board";
import type { Stage } from "@/lib/constants";

interface BoardRow {
  id: string;
  candidate_id: string;
  stage: string;
  score: number | null;
  candidates: { full_name: string; source: string; email: string | null } | null;
}

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("id", id)
    .single();
  if (!job) notFound();

  const { data: rows } = await supabase
    .from("applications")
    .select("id, candidate_id, stage, score, candidates(full_name, source, email)")
    .eq("job_id", id);

  const items: BoardItem[] = ((rows ?? []) as unknown as BoardRow[]).map((a) => ({
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
      <div className="page-enter w-full px-5 py-7 md:px-6 md:py-9">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> Home
        </Link>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">{job.title}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Move people through your stages — changes save automatically.
            </p>
          </div>
          <RoleTabs jobId={job.id} active="board" />
        </div>

        {items.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed px-6 py-16 text-center">
            <p className="text-muted-foreground text-sm">
              No people yet.{" "}
              <Link href={`/jobs/${job.id}`} className="text-primary underline">
                Add some CVs
              </Link>{" "}
              to get started.
            </p>
          </div>
        ) : (
          <PipelineBoard jobId={job.id} jobTitle={job.title} initialItems={items} />
        )}
      </div>
    </AppShell>
  );
}
