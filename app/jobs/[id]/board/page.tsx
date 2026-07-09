import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { PipelineBoard, type BoardItem } from "@/components/pipeline-board";
import type { Stage } from "@/lib/constants";

interface BoardRow {
  id: string;
  candidate_id: string;
  stage: string;
  score: number | null;
  candidates: { full_name: string; source: string } | null;
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
    .select("id, candidate_id, stage, score, candidates(full_name, source)")
    .eq("job_id", id);

  const items: BoardItem[] = ((rows ?? []) as unknown as BoardRow[]).map(
    (a) => ({
      applicationId: a.id,
      candidateId: a.candidate_id,
      fullName: a.candidates?.full_name ?? "Unknown candidate",
      score: a.score,
      source: a.candidates?.source ?? "upload",
      stage: a.stage as Stage,
    }),
  );

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader email={user.email} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8">
        <div className="mb-6">
          <Link
            href={`/jobs/${job.id}`}
            className="text-muted-foreground text-sm hover:underline"
          >
            ← {job.title}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Pipeline board
          </h1>
          <p className="text-muted-foreground text-sm">
            Drag candidates between stages. Changes save and log automatically.
          </p>
        </div>

        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No candidates yet.{" "}
            <Link href={`/jobs/${job.id}`} className="text-primary underline">
              Add CVs
            </Link>{" "}
            to populate the board.
          </p>
        ) : (
          <PipelineBoard jobId={job.id} initialItems={items} />
        )}
      </main>
    </div>
  );
}
