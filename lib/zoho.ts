import "server-only";
import nodemailer from "nodemailer";

// Email sending via Zoho Mail SMTP (app-specific password).
// Owner reverted email from Gmail back to Zoho on 2026-07-13 (HR sends from a
// Zoho mailbox). Google stays connected for Calendar/Meet scheduling only.
//
// Auth is a Zoho *app-specific password* (Zoho → Settings → Security → App
// Passwords), not OAuth — simplest for a single-user tool. Secrets live in env,
// never in the DB. SMTP host defaults to the US data center; override for EU/IN
// accounts with ZOHO_SMTP_HOST (e.g. smtp.zoho.eu, smtp.zoho.in).

const DEFAULT_HOST = "smtp.zoho.com";
const DEFAULT_PORT = 465; // implicit TLS

function zohoConfig() {
  const host = process.env.ZOHO_SMTP_HOST || DEFAULT_HOST;
  const port = Number(process.env.ZOHO_SMTP_PORT || DEFAULT_PORT);
  const user = process.env.ZOHO_SMTP_USER; // full mailbox address, e.g. hr@yourdomain.com
  const pass = process.env.ZOHO_SMTP_PASSWORD; // app-specific password
  const fromName = process.env.ZOHO_FROM_NAME; // optional display name
  return { host, port, user, pass, fromName };
}

export function isZohoConfigured(): boolean {
  const { user, pass } = zohoConfig();
  return Boolean(user && pass);
}

/** The address emails are sent from, for display in Settings. Null if unset. */
export function zohoSenderAddress(): string | null {
  return zohoConfig().user ?? null;
}

function requireZohoConfig() {
  const cfg = zohoConfig();
  if (!cfg.user || !cfg.pass) {
    throw new Error(
      "Zoho email is not configured. Set ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD.",
    );
  }
  return cfg as Required<Pick<typeof cfg, "user" | "pass">> & typeof cfg;
}

// One transporter is enough for a single-user tool; created lazily so a missing
// config never crashes module load.
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  const { host, port, user, pass } = requireZohoConfig();
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user, pass },
    });
  }
  return transporter;
}

/** Recipients the app must never email (comma-separated env, e.g. during testing). */
function isSuppressed(to: string): boolean {
  const list = (process.env.EMAIL_SUPPRESS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(to.trim().toLowerCase());
}

/** Send an HTML email from the configured Zoho mailbox via SMTP. */
export async function sendZohoMail(msg: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id: string }> {
  if (isSuppressed(msg.to)) {
    throw new Error(`Email to ${msg.to} is blocked (suppression list / testing).`);
  }
  const { user, fromName } = requireZohoConfig();
  const from = fromName ? `"${fromName}" <${user}>` : user;

  const info = await getTransporter().sendMail({
    from,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
  });

  return { id: info.messageId };
}
