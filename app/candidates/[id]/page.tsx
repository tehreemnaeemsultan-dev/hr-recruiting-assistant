import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, RESUMES_BUCKET } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/app-header";
import { ApplicationNotes } from "@/components/application-notes";
import { ComposeEmailDialog } from "@/components/compose-email-dialog";
import { ScheduleInterviewDialog } from "@/components/schedule-interview-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ParsedCandidate } from "@/lib/types";

interface CandidateRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string;
  resume_path: string | null;
  raw_text: string | null;
  parsed: ParsedCandidate | null;
  created_at: string;
  applications: {
    id: string;
    job_id: string;
    score: number | null;
    score_summary: string | null;
    notes: string | null;
    jobs: { id: string; title: string } | null;
    interviews: {
      meet_url: string | null;
      scheduled_start: string | null;
      status: string;
    }[];
  }[];
}

export default async function CandidatePage({
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

  const { data } = await supabase
    .from("candidates")
    .select(
      "*, applications(id, score, score_summary, notes, job_id, jobs(id, title), interviews(meet_url, scheduled_start, status))",
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const candidate = data as unknown as CandidateRow;

  let resumeUrl: string | null = null;
  if (candidate.resume_path) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from(RESUMES_BUCKET)
      .createSignedUrl(candidate.resume_path, 3600);
    resumeUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader email={user.email} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-6">
          <Link
            href="/"
            className="text-muted-foreground text-sm hover:underline"
          >
            ← Dashboard
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {candidate.full_name}
            </h1>
            <Badge variant="secondary">{candidate.source}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {[candidate.email, candidate.phone].filter(Boolean).join(" · ") ||
              "No contact details extracted"}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Source file: </span>
                {candidate.parsed?.source_filename ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Pages: </span>
                {candidate.parsed?.pages ?? "—"}
              </div>
              {candidate.parsed?.extract_error ? (
                <div className="text-destructive">
                  {candidate.parsed.extract_error}
                </div>
              ) : null}
              {resumeUrl ? (
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  Download résumé (PDF)
                </a>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Applications & notes</CardTitle>
              <CardDescription>Jobs this candidate is on.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 text-sm">
              {candidate.applications.length === 0 ? (
                <span className="text-muted-foreground">None.</span>
              ) : (
                candidate.applications.map((a) => (
                  <div key={a.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={a.jobs ? `/jobs/${a.jobs.id}` : "#"}
                        className="font-medium hover:underline"
                      >
                        {a.jobs?.title ?? "Unknown job"}
                      </Link>
                      <Badge variant={a.score !== null ? "default" : "outline"}>
                        {a.score !== null ? a.score : "unscored"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ComposeEmailDialog
                        applicationId={a.id}
                        jobId={a.job_id}
                        candidateName={candidate.full_name}
                        candidateEmail={candidate.email}
                        jobTitle={a.jobs?.title ?? "this role"}
                      />
                      <ScheduleInterviewDialog
                        applicationId={a.id}
                        jobId={a.job_id}
                        candidateName={candidate.full_name}
                      />
                    </div>

                    {a.interviews.length > 0 ? (
                      <div className="flex flex-col gap-1 rounded-md border bg-muted/30 p-2 text-xs">
                        {a.interviews.map((iv, i) => (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">
                              {iv.scheduled_start
                                ? new Date(iv.scheduled_start).toLocaleString("en-GB", {
                                    timeZone: "Asia/Karachi",
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  }) + " PKT"
                                : "Interview"}{" "}
                              · {iv.status}
                            </span>
                            {iv.meet_url ? (
                              <a
                                href={iv.meet_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline underline-offset-2"
                              >
                                Join Meet
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <ApplicationNotes
                      applicationId={a.id}
                      jobId={a.job_id}
                      initialNotes={a.notes ?? ""}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Extracted CV text</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
              {candidate.raw_text || "No text extracted."}
            </pre>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
