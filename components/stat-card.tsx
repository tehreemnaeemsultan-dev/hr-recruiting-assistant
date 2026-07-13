import type { LucideIcon } from "lucide-react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatAccent = "violet" | "blue" | "amber" | "emerald" | "red";

const ACCENT: Record<StatAccent, { border: string; icon: string }> = {
  violet: { border: "border-l-violet-500", icon: "text-violet-500" },
  blue: { border: "border-l-blue-500", icon: "text-blue-500" },
  amber: { border: "border-l-amber-500", icon: "text-amber-500" },
  emerald: { border: "border-l-emerald-500", icon: "text-emerald-500" },
  red: { border: "border-l-red-500", icon: "text-red-500" },
};

/**
 * Clean stat tile: white card with a 4px colored left border, a large dark
 * number, a small secondary label, and a muted icon. Optional delta with an
 * up/down arrow (green positive, red negative). Presentational — server-safe.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "violet",
  delta,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: StatAccent;
  delta?: number | null;
  hint?: string;
  className?: string;
}) {
  const a = ACCENT[accent];
  return (
    <div
      className={cn(
        "rounded-xl border border-l-4 bg-card p-5 shadow-xs transition-shadow duration-200 hover:shadow-sm",
        a.border,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-text-secondary text-sm">{label}</span>
          <span className="text-text-primary text-2xl font-bold tabular-nums">
            {value}
          </span>
        </div>
        <Icon className={cn("size-5 shrink-0 opacity-80", a.icon)} />
      </div>

      {delta != null || hint ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          {delta != null ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                delta >= 0 ? "text-success" : "text-danger",
              )}
            >
              {delta >= 0 ? (
                <ArrowUp className="size-3" />
              ) : (
                <ArrowDown className="size-3" />
              )}
              {delta >= 0 ? "+" : ""}
              {delta}
            </span>
          ) : null}
          {hint ? <span className="text-text-tertiary">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
