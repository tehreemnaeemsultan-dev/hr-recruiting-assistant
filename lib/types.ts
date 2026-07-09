// Shared types for CV ranking (Phase 1).

export type Recommendation = "strong" | "possible" | "weak";

export interface CriterionResult {
  criterion: string;
  met: boolean;
  evidence: string;
  weight_note: string;
}

/** Matches the AI ranking contract in SPEC §9. Stored in applications.score_breakdown. */
export interface ScoreBreakdown {
  overall_score: number; // integer 0-100
  recommendation: Recommendation;
  criteria_breakdown: CriterionResult[];
  strengths: string[];
  gaps: string[];
  summary: string;
}

/** Extra fields we extract from a CV and store on candidates.parsed. */
export interface ParsedCandidate {
  source_filename: string;
  email: string | null;
  phone: string | null;
  pages: number;
  extract_error?: string | null;
}
