import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { ScoreBreakdown, Recommendation } from "./types";

// CV scoring via Google Gemini (owner-approved switch from Anthropic; see CLAUDE.md).
// Default model: gemini-2.5-flash (stable, best price-performance for high-volume).
// Override with GEMINI_MODEL (e.g. gemini-2.5-pro for higher quality).
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Cost/consistency control: cap the CV text sent to the model (SPEC §9).
const MAX_CV_CHARS = 24000;

const SYSTEM_PROMPT = `You are an expert technical recruiter. You score exactly one candidate's CV against a single job.

Rules:
- Treat the free-form ranking criteria as the PRIORITY signal; the job description is supporting context.
- overall_score is an integer 0-100 reflecting overall fit.
- For each distinct criterion in the free-form criteria, add one entry to criteria_breakdown, echoing the criterion text. If a criterion cannot be assessed from the CV, set met=false and evidence="not stated" — never guess or invent experience.
- evidence should be a short quote or close paraphrase from the CV.
- recommendation: "strong" (excellent fit), "possible" (partial fit / worth a look), or "weak" (poor fit).
- summary is 2-3 sentences justifying the score.
- Be consistent and evidence-based.`;

// Gemini structured-output schema mirroring the SPEC §9 contract.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overall_score: {
      type: Type.INTEGER,
      description: "Overall fit score, integer 0-100.",
    },
    recommendation: {
      type: Type.STRING,
      format: "enum",
      enum: ["strong", "possible", "weak"],
    },
    criteria_breakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          criterion: { type: Type.STRING },
          met: { type: Type.BOOLEAN },
          evidence: { type: Type.STRING },
          weight_note: { type: Type.STRING },
        },
        required: ["criterion", "met", "evidence", "weight_note"],
        propertyOrdering: ["criterion", "met", "evidence", "weight_note"],
      },
    },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
    summary: { type: Type.STRING },
  },
  required: [
    "overall_score",
    "recommendation",
    "criteria_breakdown",
    "strengths",
    "gaps",
    "summary",
  ],
  propertyOrdering: [
    "overall_score",
    "recommendation",
    "criteria_breakdown",
    "strengths",
    "gaps",
    "summary",
  ],
};

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function normalizeRecommendation(r: unknown): Recommendation {
  return r === "strong" || r === "weak" ? r : "possible";
}

function normalize(raw: unknown): ScoreBreakdown {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    overall_score: clampScore(obj.overall_score),
    recommendation: normalizeRecommendation(obj.recommendation),
    criteria_breakdown: Array.isArray(obj.criteria_breakdown)
      ? (obj.criteria_breakdown as ScoreBreakdown["criteria_breakdown"])
      : [],
    strengths: Array.isArray(obj.strengths) ? (obj.strengths as string[]) : [],
    gaps: Array.isArray(obj.gaps) ? (obj.gaps as string[]) : [],
    summary: typeof obj.summary === "string" ? obj.summary : "",
  };
}

export function isScoringConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Score one candidate's CV against a job. Throws on API/config failure. */
export async function scoreCandidate(input: {
  jobTitle: string;
  jdText: string;
  criteriaText: string;
  rawText: string;
}): Promise<ScoreBreakdown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set — cannot score candidates.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const cv = input.rawText.slice(0, MAX_CV_CHARS);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `JOB TITLE:
${input.jobTitle}

JOB DESCRIPTION:
${input.jdText || "(none provided)"}

RANKING CRITERIA (free-form, priority signal):
${input.criteriaText || "(none provided)"}

CANDIDATE CV (extracted text):
${cv || "(no text could be extracted)"}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      // Gemini supports temperature; keep scoring deterministic (SPEC §9).
      temperature: 0,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned no content.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }
  return normalize(parsed);
}
