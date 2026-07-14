// Interview-related candidate emails (plain text for logging + HTML for sending).
// Pure functions — safe to import from any server module.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function shell(inner: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111;">${inner}</div>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${esc(href)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;">${esc(label)}</a></p>`;
}

/** Confirmation email once an interview time is fixed (with the Meet link). */
export function buildInterviewEmail(opts: {
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
    `Your interview for the ${opts.jobTitle} role is confirmed.`,
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

  const meetBlock = opts.meetUrl
    ? button(opts.meetUrl, "Join Google Meet") +
      `<p style="color:#555;font-size:13px;">Or copy this link: <a href="${esc(opts.meetUrl)}">${esc(opts.meetUrl)}</a></p>`
    : `<p>We'll share the joining details shortly.</p>`;

  const html = shell(`
  <p>Hi ${esc(opts.candidateName)},</p>
  <p>Your interview for the <strong>${esc(opts.jobTitle)}</strong> role is confirmed.</p>
  <table style="border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:4px 16px 4px 0;color:#555;">When</td><td style="padding:4px 0;font-weight:600;">${esc(when)} (PKT)</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#555;">Duration</td><td style="padding:4px 0;font-weight:600;">${opts.durationMin} minutes</td></tr>
  </table>
  ${meetBlock}
  <p>A calendar invite has also been sent to this address. If the time doesn't work, just reply to this email.</p>
  <p style="margin-top:20px;">Best regards,<br>${esc(sender)}</p>`);

  return { subject, text, html };
}

/** Invite the candidate to self-pick an interview time via a booking link. */
export function buildBookingLinkEmail(opts: {
  candidateName: string;
  jobTitle: string;
  bookingUrl: string;
  senderName?: string;
}): { subject: string; text: string; html: string } {
  const sender = opts.senderName ?? "The hiring team";
  const subject = `Choose a time for your ${opts.jobTitle} interview`;

  const text = [
    `Hi ${opts.candidateName},`,
    ``,
    `We'd like to invite you to an interview for the ${opts.jobTitle} role.`,
    ``,
    `Please pick a time that suits you here:`,
    opts.bookingUrl,
    ``,
    `You'll see the available slots and can choose whichever works — a Google Meet link is generated automatically once you book.`,
    ``,
    `Best regards,`,
    sender,
  ].join("\n");

  const html = shell(`
  <p>Hi ${esc(opts.candidateName)},</p>
  <p>We'd like to invite you to an interview for the <strong>${esc(opts.jobTitle)}</strong> role.</p>
  <p>Pick a time that suits you:</p>
  ${button(opts.bookingUrl, "Choose your interview time")}
  <p style="color:#555;font-size:13px;">Or paste this link into your browser: <a href="${esc(opts.bookingUrl)}">${esc(opts.bookingUrl)}</a></p>
  <p>You'll see the open slots and can choose whichever works — a Google Meet link is created automatically once you book.</p>
  <p style="margin-top:20px;">Best regards,<br>${esc(sender)}</p>`);

  return { subject, text, html };
}
