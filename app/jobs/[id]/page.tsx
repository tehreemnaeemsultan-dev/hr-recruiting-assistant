import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isScoringConfigured } from "@/lib/scoring";
import { AppHeader } from "@/components/app-header";
import { CvUploader } from "@/components/cv-uploader";
import { CandidateCard, type CandidateCardData } from "@/components/candidate-card";
import { RescoreJobButton } from "@/components/rescore-job-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ParsedCandidate, ScoreBreakdown, Recommendation } from "@/lib/types";

const REC_RANK: Record<Recommendation, number> = {
  strong: 3,
  possible: 2,
  weak: 1,
};

interface AppRow {
  id: string;
  candidate_id: string;
  stage: string;
  score: number | null;
  score_summary: string | null;
  score_breakdown: ScoreBreakdown | null;
  candidates: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    parsed: ParsedCandidate | null;
  } | null;
}

export default async function JobDetailPage({
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
    .select("*")
    .eq("id", id)
    .single();
  if (!job) notFound();

  const { data: appsRaw } = await supabase
    .from("applications")
    .select(
      "id, candidate_id, stage, score, score_summary, score_breakdown, candidates(id, full_name, email, phone, parsed)",
    )
    .eq("job_id", id);

  const apps = (appsRaw ?? []) as unknown as AppRow[];

  const cards: CandidateCardData[] = apps
    .map((a) => ({
      applicationId: a.id,
      candidateId: a.candidate_id,
      fullName: a.candidates?.full_name ?? "Unknown candidate",
      email: a.candidates?.email ?? null,
      phone: a.candidates?.phone ?? null,
      sourceFilename: a.candidates?.parsed?.source_filename ?? null,
      score: a.score,
      scoreSummary: a.score_summary,
      breakdown: a.score_breakdown,
      rank: 0,
    }))
    // Sort by score desc (nulls last), ties broken by recommendation (SPEC §9).
    .sort((x, y) => {
      if (x.score === null && y.score === null) return 0;
      if (x.score === null) return 1;
      if (y.score === null) return -1;
      if (y.score !== x.score) return y.score - x.score;
      const rx = x.breakdown ? REC_RANK[x.breakdown.recommendation] : 0;
      const ry = y.breakdown ? REC_RANK[y.breakdown.recommendation] : 0;
      return ry - rx;
    })
    .map((c, i) => ({ ...c, rank: i + 1 }));

  const scoredCount = cards.filter((c) => c.score !== null).length;
  const scoringOn = isScoringConfigured();

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader email={user.email} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <div className="mb-6">
          <Link href="/" className="text-muted-foreground text-sm hover:underline">
            ← Dashboard
          </Link>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {job.title}
              </h1>
              <p className="text-muted-foreground text-sm">
                {cards.length} candidate{cards.length === 1 ? "" : "s"} ·{" "}
                {scoredCount} scored
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                render={<Link href={`/jobs/${job.id}/board`} />}
                variant="outline"
                size="sm"
              >
                Board
              </Button>
              {cards.length > 0 ? (
                <RescoreJobButton jobId={job.id} disabled={!scoringOn} />
              ) : null}
            </div>
          </div>
        </div>

        {!scoringOn ? (
          <Card className="mb-6 border-destructive/40">
            <CardHeader>
              <CardTitle className="text-base">Scoring not configured</CardTitle>
              <CardDescription>
                Set <code>GEMINI_API_KEY</code> to score CVs. Uploads still
                work — candidates will be added unscored, then you can re-score.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">
                {job.jd_text || (
                  <span className="text-muted-foreground">None provided.</span>
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ranking criteria</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{job.criteria_text}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Add CVs</CardTitle>
            <CardDescription>
              Upload PDF resumes to rank them against this job.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CvUploader jobId={job.id} />
          </CardContent>
        </Card>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Ranked candidates</h2>
          {cards.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No candidates yet. Upload CVs above to get started.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {cards.map((c) => (
                <CandidateCard key={c.applicationId} data={c} jobId={job.id} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
