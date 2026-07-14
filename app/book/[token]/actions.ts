"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCalendarEvent } from "@/lib/google";
import { sendZohoMail } from "@/lib/zoho";
import { buildInterviewEmail } from "@/lib/interview-email";
import {
  isValidFreeSlot,
  slotEndLocal,
  type BusyInterval,
} from "@/lib/availability";

interface BookRow {
  id: string;
  application_id: string;
  token_expires_at: string | null;
  duration_min: number | null;
  applications: {
    jobs: { title: string } | null;
    candidates: { full_name: string; email: string | null } | null;
  } | null;
}

type BookResult =
  | { ok: true; meetUrl: string | null; startLocal: string }
  | { ok: false; error: string };

/** Public (no-auth) action: candidate books an open slot for a pending interview. */
export async function bookInterviewSlot(
  token: string,
  startLocal: string,
): Promise<BookResult> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("interviews")
    .select(
      "id, application_id, token_expires_at, duration_min, applications(jobs(title), candidates(full_name, email))",
    )
    .eq("booking_token", token)
    .eq("status", "pending")
    .maybeSingle();

  const iv = data as unknown as BookRow | null;
  if (!iv) return { ok: false, error: "This booking link is no longer valid." };
  if (iv.token_expires_at && new Date(iv.token_expires_at).getTime() < Date.now()) {
    return { ok: false, error: "This booking link has expired." };
  }

  // Re-check the slot is still free against currently-scheduled interviews.
  const { data: booked } = await admin
    .from("interviews")
    .select("scheduled_start, scheduled_end")
    .eq("status", "scheduled")
    .not("scheduled_start", "is", null);
  const busy: BusyInterval[] = (booked ?? []).map((b) => ({
    start: b.scheduled_start,
    end: b.scheduled_end,
  }));
  if (!isValidFreeSlot(startLocal, busy)) {
    return {
      ok: false,
      error: "Sorry, that slot was just taken. Please pick another time.",
    };
  }

  const endLocal = slotEndLocal(startLocal);
  const candName = iv.applications?.candidates?.full_name ?? "Candidate";
  const candEmail = iv.applications?.candidates?.email?.trim() ?? null;
  const jobTitle = iv.applications?.jobs?.title ?? "the role";

  // Create the Google Calendar event + Meet link on the recruiter's calendar.
  let ev: { eventId: string; meetUrl: string | null };
  try {
    ev = await createCalendarEvent(admin, {
      summary: `Interview: ${candName} — ${jobTitle}`,
      description: `Interview for the ${jobTitle} role (booked by the candidate).`,
      startLocal,
      endLocal,
      attendeeEmail: candEmail,
    });
  } catch {
    return {
      ok: false,
      error:
        "We couldn't confirm your booking just now. Please try again in a moment.",
    };
  }

  // Consume the token and finalize the interview.
  const { error: updErr } = await admin
    .from("interviews")
    .update({
      status: "scheduled",
      scheduled_start: `${startLocal}+05:00`,
      scheduled_end: `${endLocal}+05:00`,
      google_event_id: ev.eventId,
      meet_url: ev.meetUrl,
    })
    .eq("id", iv.id)
    .eq("status", "pending"); // guard against a double-book race
  if (updErr) {
    return { ok: false, error: "Could not save your booking. Please try again." };
  }

  await admin.from("events").insert({
    application_id: iv.application_id,
    type: "interview_scheduled",
    payload: {
      google_event_id: ev.eventId,
      meet_url: ev.meetUrl,
      start: startLocal,
      by: "candidate",
    },
  });

  // Confirmation email to the candidate (via Zoho), with the Meet link.
  if (candEmail) {
    const mail = buildInterviewEmail({
      candidateName: candName,
      jobTitle,
      startLocal,
      durationMin: iv.duration_min ?? 30,
      meetUrl: ev.meetUrl,
      senderName: process.env.ZOHO_FROM_NAME,
    });
    try {
      const sent = await sendZohoMail({
        to: candEmail,
        subject: mail.subject,
        html: mail.html,
      });
      await admin.from("emails").insert({
        application_id: iv.application_id,
        direction: "outbound",
        to_address: candEmail,
        subject: mail.subject,
        body: mail.text,
        provider: "zoho",
        status: "sent",
        provider_message_id: sent.id,
        message_id: sent.id,
      });
    } catch {
      // Booking is confirmed regardless; log the failed email for visibility.
      await admin.from("emails").insert({
        application_id: iv.application_id,
        direction: "outbound",
        to_address: candEmail,
        subject: mail.subject,
        body: mail.text,
        provider: "zoho",
        status: "failed",
      });
    }
  }

  revalidatePath(`/book/${token}`);
  revalidatePath("/");
  return { ok: true, meetUrl: ev.meetUrl, startLocal };
}
