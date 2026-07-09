import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extract plain text from a PDF's bytes using unpdf (serverless-friendly, no
 * native deps). Throws on a corrupt/unreadable PDF — callers must catch and
 * flag the candidate rather than crash.
 */
export async function extractPdfText(
  bytes: Uint8Array,
): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n") : (text ?? "");
  return { text: merged.trim(), pages: totalPages };
}
