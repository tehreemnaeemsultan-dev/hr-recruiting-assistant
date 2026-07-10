import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Upload, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isScoringConfigured } from "@/lib/scoring";
import { AppShell } from "@/components/app-shell";
import { RoleTabs } from "@/components/role-tabs";
import { CvUploader } from "@/components/cv-uploader";
import { CandidateCard, type CandidateCardData } from "@/components/candidate-card";
import { RescoreJobButton } from "@/components/rescore-job-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export default async function RolePeoplePage({
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

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
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

  const reviewedCount = cards.filter((c) => c.score !== null).length;
  const scoringOn = isScoringConfigured();

  return (
    <AppShell email={user.email}>
      <div className="mx-auto w-full max-w-4xl px-6 py-8 md:py-10">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> Home
        </Link>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {cards.length} {cards.length === 1 ? "person" : "people"} ·{" "}
              {reviewedCount} reviewed
            </p>
          </div>
          <div className="flex items-center gap-2">
            {cards.length > 0 ? (
              <RescoreJobButton jobId={job.id} disabled={!scoringOn} />
            ) : null}
            <RoleTabs jobId={job.id} active="people" />
          </div>
        </div>

        {!scoringOn ? (
          <Alert className="mb-6">
            <AlertDescription>
              Automatic review is off. Add <code>GEMINI_API_KEY</code> to score CVs.
              Uploads still work — people are added unreviewed, then you can review.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">About the role</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">
                {job.jd_text || (
                  <span className="text-muted-foreground">Nothing added yet.</span>
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                What you&apos;re looking for
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{job.criteria_text}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Upload className="text-primary size-4" /> Add people
            </CardTitle>
            <CardDescription>
              Drop in CVs (PDF) and they&apos;ll be reviewed and ranked for this
              role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CvUploader jobId={job.id} />
          </CardContent>
        </Card>

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="text-primary size-4.5" /> Best matches first
          </h2>
          {cards.length === 0 ? (
            <div className="bg-card text-muted-foreground rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
              No people yet — add some CVs above to get started.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cards.map((c) => (
                <CandidateCard key={c.applicationId} data={c} jobId={job.id} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
