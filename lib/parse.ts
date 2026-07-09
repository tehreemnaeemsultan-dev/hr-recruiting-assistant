// Lightweight heuristics to pull a display name, email and phone out of a CV.
// Best-effort only — the AI scoring does the real work. The recruiter can edit
// these later if needed.

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;

/** Turn a filename like "john_doe-cv (final).pdf" into "John Doe". */
function nameFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, ""); // drop extension
  const cleaned = base
    .replace(/[_\-.]+/g, " ")
    .replace(/\b(cv|resume|resumé|curriculum vitae|final|updated|copy|\d+)\b/gi, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Unknown candidate";
  return cleaned
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function parseCandidateFields(
  rawText: string,
  filename: string,
): { full_name: string; email: string | null; phone: string | null } {
  const email = rawText.match(EMAIL_RE)?.[0]?.toLowerCase() ?? null;

  const phoneMatch = rawText.match(PHONE_RE)?.[0] ?? null;
  const phone = phoneMatch
    ? phoneMatch.replace(/[^\d+]/g, "").slice(0, 20)
    : null;

  return { full_name: nameFromFilename(filename), email, phone };
}
