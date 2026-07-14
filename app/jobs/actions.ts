"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, RESUMES_BUCKET } from "@/lib/supabase/admin";
import { extractPdfText } from "@/lib/pdf";
import { parseCandidateFields } from "@/lib/parse";
import { scoreCandidate, isScoringConfigured } from "@/lib/scoring";
import { createCalendarEvent } from "@/lib/google";
import { sendZohoMail } from "@/lib/zoho";
import type { ParsedCandidate } from "@/lib/types";
import { STAGES, type Stage } from "@/lib/constants";

// Cost controls (SPEC §10).
const MAX_CVS_PER_BATCH = 20;
const SCORE_CONCURRENCY = 4;

type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return supabase;
}

// --- Job CRUD -------------------------------------------------------------

export type CreateJobState = { error: string } | undefined;

export async function createJob(
  _prev: CreateJobState,
  formData: FormData,
): Promise<CreateJobState> {
  const supabase = await requireUser();
  if (!supabase) return { error: "You are signed out. Please sign in again." };

  const title = String(formData.get("title") ?? "").trim();
  const jd_text = String(formData.get("jd_text") ?? "").trim();
  const criteria_text = String(formData.get("criteria_text") ?? "").trim();

  if (!title) return { error: "Job title is required." };
  if (!criteria_text) return { error: "Ranking criteria are required." };

  const { data, error } = await supabase
    .from("jobs")
    .insert({ title, jd_text, criteria_text })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create job." };
  }

  redirect(`/jobs/${data.id}`);
}

export async function deleteJob(jobId: string): Promise<void> {
  const supabase = await requireUser();
  if (!supabase) return;

  // Gather candidates uploaded for this job so we can remove their rows + files.
  const { data: apps } = await supabase
    .from("applications")
    .select("candidate_id")
    .eq("job_id", jobId);
  const candidateIds = (apps ?? []).map((a) => a.candidate_id as string);

  const admin = createAdminClient();
  // Remove all stored resumes under this job's folder.
  const { data: files } = await admin.storage.from(RESUMES_BUCKET).list(jobId);
  if (files && files.length) {
    await admin.storage
      .from(RESUMES_BUCKET)
      .remove(files.map((f) => `${jobId}/${f.name}`));
  }

  // Delete the job (cascades applications), then the now-orphaned candidates.
  await supabase.from("jobs").delete().eq("id", jobId);
  if (candidateIds.length) {
    await supabase.from("candidates").delete().in("id", candidateIds);
  }

  revalidatePath("/");
  redirect("/");
}

// --- CV upload + ingest + scoring ----------------------------------------

/** Create per-file signed upload URLs so the browser can upload straight to Storage. */
export async function createUploadTargets(
  jobId: string,
  files: { name: string }[],
): Promise<
  ActionResult<{ targets: { path: string; token: string; name: string }[] }>
> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };

  const admin = createAdminClient();
  const targets: { path: string; token: string; name: string }[] = [];

  for (const file of files.slice(0, MAX_CVS_PER_BATCH)) {
    const path = `${jobId}/${crypto.randomUUID()}.pdf`;
    const { data, error } = await admin.storage
      .from(RESUMES_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Could not start upload." };
    }
    targets.push({ path: data.path, token: data.token, name: file.name });
  }

  return { ok: true, targets };
}

interface AppJoinRow {
  id: string;
  jobs: { title: string; jd_text: string; criteria_text: string } | null;
  candidates: { raw_text: string | null } | null;
}

async function runPool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  const queue = [...items];
  const runners = Array.from(
    { length: Math.min(concurrency, queue.length) },
    async () => {
      while (queue.length) {
        const item = queue.shift();
        if (item !== undefined) await worker(item);
      }
    },
  );
  await Promise.all(runners);
}

async function scoreApplications(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>>,
  applicationIds: string[],
): Promise<{ scored: number; errors: number }> {
  if (!applicationIds.length) return { scored: 0, errors: 0 };

  const { data, error } = await supabase
    .from("applications")
    .select("id, jobs(title, jd_text, criteria_text), candidates(raw_text)")
    .in("id", applicationIds);

  if (error || !data) return { scored: 0, errors: applicationIds.length };

  const rows = data as unknown as AppJoinRow[];
  let scored = 0;
  let errors = 0;

  await runPool(
    rows,
    async (row) => {
      const job = row.jobs;
      const raw = row.candidates?.raw_text ?? "";
      if (!job) {
        errors++;
        return;
      }
      if (!raw.trim()) {
        await supabase
          .from("applications")
          .update({
            score: null,
            score_breakdown: null,
            score_summary: "No CV text available to score.",
          })
          .eq("id", row.id);
        return;
      }
      try {
        const breakdown = await scoreCandidate({
          jobTitle: job.title,
          jdText: job.jd_text,
          criteriaText: job.criteria_text,
          rawText: raw,
        });
        await supabase
          .from("applications")
          .update({
            score: breakdown.overall_score,
            score_breakdown: breakdown,
            score_summary: breakdown.summary,
          })
          .eq("id", row.id);
        scored++;
      } catch (e) {
        errors++;
        await supabase
          .from("applications")
          .update({
            score_summary: `Scoring failed: ${
              e instanceof Error ? e.message : "unknown error"
            }`,
          })
          .eq("id", row.id);
      }
    },
    SCORE_CONCURRENCY,
  );

  return { scored, errors };
}

export type IngestResult = ActionResult<{
  ingested: number;
  skipped: number;
  failures: { name: string; error: string }[];
  scored: number;
  scoreErrors: number;
  scoringConfigured: boolean;
}>;

/** Download each uploaded PDF, extract text, create candidate + application, then score. */
export async function ingestCandidates(
  jobId: string,
  items: { path: string; name: string }[],
): Promise<IngestResult> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .single();
  if (!job) return { ok: false, error: "Job not found." };

  const capped = items.slice(0, MAX_CVS_PER_BATCH);
  const admin = createAdminClient();
  const createdIds: string[] = [];
  const failures: { name: string; error: string }[] = [];

  for (const item of capped) {
    try {
      const { data: blob, error: dlErr } = await admin.storage
        .from(RESUMES_BUCKET)
        .download(item.path);
      if (dlErr || !blob) throw new Error("Could not read the uploaded file.");

      const bytes = new Uint8Array(await blob.arrayBuffer());
      let rawText = "";
      let pages = 0;
      let extractError: string | null = null;
      try {
        const r = await extractPdfText(bytes);
        rawText = r.text;
        pages = r.pages;
      } catch {
        extractError = "Could not read PDF (corrupt or unsupported).";
      }
      if (!extractError && rawText.length < 20) {
        extractError = "No text found (possibly a scanned image).";
      }

      const fields = parseCandidateFields(rawText, item.name);
      const parsed: ParsedCandidate = {
        source_filename: item.name,
        email: fields.email,
        phone: fields.phone,
        pages,
        extract_error: extractError,
      };

      const { data: cand, error: cErr } = await supabase
        .from("candidates")
        .insert({
          full_name: fields.full_name,
          email: fields.email,
          phone: fields.phone,
          source: "upload",
          resume_path: item.path,
          parsed,
          raw_text: rawText || null,
        })
        .select("id")
        .single();
      if (cErr || !cand) throw new Error(cErr?.message ?? "Could not save candidate.");

      const { data: app, error: aErr } = await supabase
        .from("applications")
        .insert({
          job_id: jobId,
          candidate_id: cand.id,
          stage: "new",
          ...(extractError ? { score_summary: extractError } : {}),
        })
        .select("id")
        .single();
      if (aErr || !app) throw new Error(aErr?.message ?? "Could not save application.");

      if (!extractError) createdIds.push(app.id);
    } catch (e) {
      failures.push({
        name: item.name,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const scoringConfigured = isScoringConfigured();
  let scored = 0;
  let scoreErrors = 0;
  if (createdIds.length && scoringConfigured) {
    const r = await scoreApplications(supabase, createdIds);
    scored = r.scored;
    scoreErrors = r.errors;
  }

  revalidatePath(`/jobs/${jobId}`);
  return {
    ok: true,
    ingested: capped.length,
    skipped: items.length - capped.length,
    failures,
    scored,
    scoreErrors,
    scoringConfigured,
  };
}

export async function rescoreApplication(
  applicationId: string,
  jobId: string,
): Promise<ActionResult<{ scored: number; errors: number }>> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };
  if (!isScoringConfigured()) {
    return { ok: false, error: "Scoring is not configured (GEMINI_API_KEY missing)." };
  }
  const r = await scoreApplications(supabase, [applicationId]);
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, ...r };
}

export async function rescoreJob(
  jobId: string,
): Promise<ActionResult<{ scored: number; errors: number }>> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };
  if (!isScoringConfigured()) {
    return { ok: false, error: "Scoring is not configured (GEMINI_API_KEY missing)." };
  }
  const { data: apps } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", jobId);
  const ids = (apps ?? []).map((a) => a.id as string);
  const r = await scoreApplications(supabase, ids);
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, ...r };
}

export async function deleteCandidate(
  candidateId: string,
  jobId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };

  const { data: cand } = await supabase
    .from("candidates")
    .select("resume_path")
    .eq("id", candidateId)
    .single();

  if (cand?.resume_path) {
    const admin = createAdminClient();
    await admin.storage.from(RESUMES_BUCKET).remove([cand.resume_path]);
  }

  // Cascades applications + events (and emails/interviews in later phases).
  const { error } = await supabase.from("candidates").delete().eq("id", candidateId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

// --- Pipeline board (Phase 2) --------------------------------------------

/** Move an application to a new stage and log an `events` row (SPEC §5). */
export async function moveApplicationStage(
  applicationId: string,
  jobId: string,
  toStage: Stage,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };
  if (!STAGES.includes(toStage)) return { ok: false, error: "Invalid stage." };

  const { data: app } = await supabase
    .from("applications")
    .select("stage")
    .eq("id", applicationId)
    .single();
  if (!app) return { ok: false, error: "Application not found." };

  const fromStage = app.stage as Stage;
  if (fromStage === toStage) return { ok: true };

  const { error: uErr } = await supabase
    .from("applications")
    .update({ stage: toStage })
    .eq("id", applicationId);
  if (uErr) return { ok: false, error: uErr.message };

  // Audit + timing log — powers Phase 6 analytics.
  await supabase.from("events").insert({
    application_id: applicationId,
    type: "stage_changed",
    from_stage: fromStage,
    to_stage: toStage,
    payload: {},
  });

  revalidatePath(`/jobs/${jobId}/board`);
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function updateApplicationNotes(
  applicationId: string,
  jobId: string,
  notes: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("applications")
    .update({ notes })
    .eq("id", applicationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

// --- Email (Phase 3, via Zoho Mail SMTP) ---------------------------------

function bodyToHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">${esc.replace(
    /\n/g,
    "<br>",
  )}</div>`;
}

/** Send an email to a candidate via Zoho; log it to `emails` + an `events` row. */
export async function sendCandidateEmail(
  applicationId: string,
  jobId: string,
  input: { to: string; subject: string; body: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };

  const to = input.to?.trim();
  if (!to) return { ok: false, error: "Candidate has no email address." };
  if (!input.subject.trim()) return { ok: false, error: "Subject is required." };

  try {
    const sent = await sendZohoMail({
      to,
      subject: input.subject,
      html: bodyToHtml(input.body),
    });
    await supabase.from("emails").insert({
      application_id: applicationId,
      direction: "outbound",
      to_address: to,
      subject: input.subject,
      body: input.body,
      provider: "zoho",
      status: "sent",
      provider_message_id: sent.id,
      message_id: sent.id, // RFC Message-ID, so replies can be threaded back
    });
    await supabase.from("events").insert({
      application_id: applicationId,
      type: "email_sent",
      payload: { to, subject: input.subject, provider_message_id: sent.id },
    });
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send email.";
    await supabase.from("emails").insert({
      application_id: applicationId,
      to_address: to,
      subject: input.subject,
      body: input.body,
      provider: "zoho",
      status: "failed",
    });
    return { ok: false, error: msg };
  }
}

// --- Interview scheduling (Phase 4, Google Calendar + Meet) ---------------

interface ScheduleJoinRow {
  jobs: { title: string } | null;
  candidates: { full_name: string; email: string | null } | null;
}

/** Build the interview-invite email (plain text for logging + HTML for sending). */
function buildInterviewEmail(opts: {
  candidateName: string;
  jobTitle: string;
  startLocal: string; // "YYYY-MM-DDTHH:MM:SS" wall-clock Asia/Karachi
  durationMin: number;
  meetUrl: string | null;
  senderName?: string;
}): { subject: string; text: string; html: string } {
  const when = new Date(`${opts.startLocal}+05:00`).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const sender = opts.senderName ?? "The hiring team";
  const subject = `Interview scheduled: ${opts.jobTitle}`;

  const text = [
    `Hi ${opts.candidateName},`,
    ``,
    `Good news — we'd like to invite you to an interview for the ${opts.jobTitle} role.`,
    ``,
    `When: ${when} (Pakistan time)`,
    `Duration: ${opts.durationMin} minutes`,
    opts.meetUrl
      ? `Join link: ${opts.meetUrl}`
      : `We'll share the joining details shortly.`,
    ``,
    `A calendar invite has also been sent to this email. If the time doesn't work, just reply to this message.`,
    ``,
    `Best regards,`,
    sender,
  ].join("\n");

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const meetBlock = opts.meetUrl
    ? `<p style="margin:20px 0;">
         <a href="${esc(opts.meetUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;">Join Google Meet</a>
       </p>
       <p style="color:#555;font-size:13px;">Or copy this link: <a href="${esc(opts.meetUrl)}">${esc(opts.meetUrl)}</a></p>`
    : `<p>We'll share the joining details shortly.</p>`;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111;">
  <p>Hi ${esc(opts.candidateName)},</p>
  <p>Good news — we'd like to invite you to an interview for the <strong>${esc(opts.jobTitle)}</strong> role.</p>
  <table style="border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:4px 16px 4px 0;color:#555;">When</td><td style="padding:4px 0;font-weight:600;">${esc(when)} (PKT)</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#555;">Duration</td><td style="padding:4px 0;font-weight:600;">${opts.durationMin} minutes</td></tr>
  </table>
  ${meetBlock}
  <p>A calendar invite has also been sent to this address. If the time doesn't work, just reply to this email.</p>
  <p style="margin-top:20px;">Best regards,<br>${esc(sender)}</p>
</div>`;

  return { subject, text, html };
}

/** Create a Google Calendar event with a Meet link, invite the candidate, log it. */
export async function scheduleInterview(
  applicationId: string,
  jobId: string,
  input: { startLocal: string; endLocal: string },
): Promise<
  | { ok: true; meetUrl: string | null; email: "sent" | "failed" | "no_address" }
  | { ok: false; error: string }
> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, error: "Not authenticated." };

  const { data } = await supabase
    .from("applications")
    .select("jobs(title), candidates(full_name, email)")
    .eq("id", applicationId)
    .single();
  if (!data) return { ok: false, error: "Application not found." };

  const row = data as unknown as ScheduleJoinRow;
  const candName = row.candidates?.full_name ?? "Candidate";
  const jobTitle = row.jobs?.title ?? "the role";

  try {
    const ev = await createCalendarEvent(supabase, {
      summary: `Interview: ${candName} — ${jobTitle}`,
      description: `Interview for the ${jobTitle} role, scheduled from the HR Recruiting Assistant.`,
      startLocal: input.startLocal,
      endLocal: input.endLocal,
      attendeeEmail: row.candidates?.email ?? null,
    });

    // Asia/Karachi is a fixed +05:00 offset (no DST).
    await supabase.from("interviews").insert({
      application_id: applicationId,
      google_event_id: ev.eventId,
      meet_url: ev.meetUrl,
      scheduled_start: `${input.startLocal}+05:00`,
      scheduled_end: `${input.endLocal}+05:00`,
      status: "scheduled",
    });
    await supabase.from("events").insert({
      application_id: applicationId,
      type: "interview_scheduled",
      payload: {
        google_event_id: ev.eventId,
        meet_url: ev.meetUrl,
        start: input.startLocal,
      },
    });

    // Automated interview-invite email to the candidate via Zoho, with the
    // Meet link. The interview is already booked; a failed email must not undo it.
    const candEmail = row.candidates?.email?.trim() ?? null;
    let email: "sent" | "failed" | "no_address" = "no_address";
    if (candEmail) {
      const durationMin = Math.max(
        1,
        Math.round(
          (new Date(input.endLocal).getTime() -
            new Date(input.startLocal).getTime()) /
            60000,
        ),
      );
      const mail = buildInterviewEmail({
        candidateName: candName,
        jobTitle,
        startLocal: input.startLocal,
        durationMin,
        meetUrl: ev.meetUrl,
        senderName: process.env.ZOHO_FROM_NAME,
      });
      try {
        const sent = await sendZohoMail({
          to: candEmail,
          subject: mail.subject,
          html: mail.html,
        });
        await supabase.from("emails").insert({
          application_id: applicationId,
          direction: "outbound",
          to_address: candEmail,
          subject: mail.subject,
          body: mail.text,
          provider: "zoho",
          status: "sent",
          provider_message_id: sent.id,
          message_id: sent.id,
        });
        await supabase.from("events").insert({
          application_id: applicationId,
          type: "email_sent",
          payload: { to: candEmail, subject: mail.subject, kind: "interview_invite" },
        });
        email = "sent";
      } catch {
        await supabase.from("emails").insert({
          application_id: applicationId,
          direction: "outbound",
          to_address: candEmail,
          subject: mail.subject,
          body: mail.text,
          provider: "zoho",
          status: "failed",
        });
        email = "failed";
      }
    }

    revalidatePath(`/jobs/${jobId}`);
    return { ok: true, meetUrl: ev.meetUrl, email };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to schedule interview.",
    };
  }
}
