import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

// Reads candidate replies from the Zoho mailbox over IMAP, reusing the same
// app-specific password as sending (lib/zoho.ts). IMAP must be enabled in Zoho:
// Settings -> Mail Accounts -> IMAP Access. Host defaults to the US data center
// (imap.zoho.com); derived from ZOHO_SMTP_HOST or set ZOHO_IMAP_HOST directly.

const DEFAULT_IMAP_HOST = "imap.zoho.com";
const DEFAULT_IMAP_PORT = 993;

function imapConfig() {
  const smtpHost = process.env.ZOHO_SMTP_HOST;
  const host =
    process.env.ZOHO_IMAP_HOST ||
    (smtpHost ? smtpHost.replace(/^smtp\./, "imap.") : DEFAULT_IMAP_HOST);
  const port = Number(process.env.ZOHO_IMAP_PORT || DEFAULT_IMAP_PORT);
  const user = process.env.ZOHO_SMTP_USER;
  const pass = process.env.ZOHO_SMTP_PASSWORD;
  return { host, port, user, pass };
}

export function isZohoImapConfigured(): boolean {
  const { user, pass } = imapConfig();
  return Boolean(user && pass);
}

export interface InboundMessage {
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  fromAddress: string | null;
  fromName: string | null;
  subject: string;
  text: string;
  date: string | null; // ISO
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Fetch INBOX messages received since `since`, newest-capped at `max`. */
export async function fetchInboxSince(
  since: Date,
  max = 200,
): Promise<InboundMessage[]> {
  const { host, port, user, pass } = imapConfig();
  if (!user || !pass) {
    throw new Error("Zoho IMAP is not configured (ZOHO_SMTP_USER/PASSWORD).");
  }

  const client = new ImapFlow({
    host,
    port,
    secure: port === 993,
    auth: { user, pass },
    logger: false,
  });

  const out: InboundMessage[] = [];
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const uids = await client.search({ since }, { uid: true });
    const list = Array.isArray(uids) ? uids.slice(-max) : [];
    if (list.length) {
      for await (const msg of client.fetch(
        list,
        { source: true },
        { uid: true },
      )) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const fromValue = parsed.from?.value?.[0];
        const references = Array.isArray(parsed.references)
          ? parsed.references
          : parsed.references
            ? [parsed.references]
            : [];

        out.push({
          messageId: parsed.messageId ?? null,
          inReplyTo: parsed.inReplyTo ?? null,
          references,
          fromAddress: fromValue?.address?.toLowerCase() ?? null,
          fromName: fromValue?.name || null,
          subject: parsed.subject ?? "(no subject)",
          text:
            parsed.text?.trim() ||
            (parsed.html ? htmlToText(parsed.html) : "") ||
            "",
          date: parsed.date ? parsed.date.toISOString() : null,
        });
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return out;
}
