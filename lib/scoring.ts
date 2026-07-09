import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ScoreBreakdown, Recommendation } from "./types";

// SPEC §3: default to Claude Sonnet 5; override to claude-haiku-4-5 for cheaper
// high-volume scoring via ANTHROPIC_MODEL.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

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
- Be consistent and evidence-based. Return your assessment ONLY by calling the submit_score tool.`;

const SCORING_TOOL: Anthropic.Tool = {
  name: "submit_score",
  description:
    "Submit the structured scoring result for this candidate against the job.",
  // strict: true guarantees the input validates against this schema.
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      overall_score: {
        type: "integer",
        description: "Overall fit score, integer 0-100.",
      },
      recommendation: {
        type: "string",
        enum: ["strong", "possible", "weak"],
      },
      criteria_breakdown: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            criterion: {
              type: "string",
              description: "Echo of the free-form criterion being assessed.",
            },
            met: { type: "boolean" },
            evidence: {
              type: "string",
              description: "Short quote/paraphrase from the CV, or 'not stated'.",
            },
            weight_note: {
              type: "string",
              description: "Why this criterion mattered to the score.",
            },
          },
          required: ["criterion", "met", "evidence", "weight_note"],
        },
      },
      strengths: { type: "array", items: { type: "string" } },
      gaps: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
    required: [
      "overall_score",
      "recommendation",
      "criteria_breakdown",
      "strengths",
      "gaps",
      "summary",
    ],
  },
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
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Score one candidate's CV against a job. Throws on API/config failure. */
export async function scoreCandidate(input: {
  jobTitle: string;
  jdText: string;
  criteriaText: string;
  rawText: string;
}): Promise<ScoreBreakdown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — cannot score candidates.");
  }

  const client = new Anthropic({ apiKey });
  const cv = input.rawText.slice(0, MAX_CV_CHARS);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    // Deterministic scoring: no thinking, forced single tool call. (Sonnet 5
    // rejects temperature/top_p, so consistency comes from prompt + forced tool.)
    thinking: { type: "disabled" },
    tools: [SCORING_TOOL],
    tool_choice: { type: "tool", name: "submit_score" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `JOB TITLE:
${input.jobTitle}

JOB DESCRIPTION:
${input.jdText || "(none provided)"}

RANKING CRITERIA (free-form, priority signal):
${input.criteriaText || "(none provided)"}

CANDIDATE CV (extracted text):
${cv || "(no text could be extracted)"}`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a structured score.");
  }
  return normalize(toolUse.input);
}
