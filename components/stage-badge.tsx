import { STAGE_LABELS, type Stage } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Stage pill color pairs (bg / text / border), light + dark. */
const STAGE_BADGE: Record<Stage, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900",
  screening:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
  interview_1:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900",
  interview_2:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900",
  hired: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
  rejected:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
};

/** Solid dot color per stage (for column headers / legends). */
export const STAGE_DOT: Record<Stage, string> = {
  new: "bg-blue-500",
  screening: "bg-amber-500",
  interview_1: "bg-violet-500",
  interview_2: "bg-purple-500",
  hired: "bg-emerald-500",
  rejected: "bg-red-500",
};

/** Hex per stage (for SVG charts). */
export const STAGE_HEX: Record<Stage, string> = {
  new: "#3b82f6",
  screening: "#f59e0b",
  interview_1: "#6c5ce7",
  interview_2: "#a855f7",
  hired: "#10b981",
  rejected: "#ef4444",
};

export function StageBadge({
  stage,
  className,
}: {
  stage: Stage;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit items-center rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        STAGE_BADGE[stage],
        className,
      )}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}
