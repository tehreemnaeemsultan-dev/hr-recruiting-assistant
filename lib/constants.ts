// Client-safe constants (no server-only imports).

/** Supabase Storage bucket holding uploaded CV PDFs. */
export const RESUMES_BUCKET_NAME = "resumes";

/** Pipeline stages, in board order (SPEC §5). */
export const STAGES = [
  "new",
  "screening",
  "interview_1",
  "interview_2",
  "hired",
  "rejected",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  new: "New",
  screening: "Screening",
  interview_1: "Interview 1",
  interview_2: "Interview 2",
  hired: "Hired",
  rejected: "Rejected",
};
