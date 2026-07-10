import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatVariant = "violet" | "orange" | "green" | "cyan" | "rose";

const VARIANT_CLASS: Record<StatVariant, string> = {
  violet: "stat-violet",
  orange: "stat-orange",
  green: "stat-green",
  cyan: "stat-cyan",
  rose: "stat-rose",
};

/**
 * Colorful gradient hero tile (dashboard / analytics). White foreground,
 * a soft decorative corner blob, an icon chip, and a big tabular number.
 * Purely presentational — safe to render from a server component.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  variant = "violet",
  delta,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: StatVariant;
  /** Signed percentage-ish change; positive renders green-up, negative red-down. */
  delta?: number | null;
  /** Small caption under the delta, e.g. "vs last 30 days". */
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "stat-card relative overflow-hidden rounded-2xl p-5",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {/* Decorative corner blobs */}
      <span className="pointer-events-none absolute -top-8 -right-8 size-28 rounded-full bg-white/15" />
      <span className="pointer-events-none absolute -top-2 -right-2 size-16 rounded-full bg-white/10" />

      <div className="relative flex items-center justify-between">
        <span className="text-[13px] font-medium text-white/85">{label}</span>
        <span className="flex size-9 items-center justify-center rounded-full bg-white/20 text-white ring-1 ring-white/25 backdrop-blur-sm">
          <Icon className="size-[18px]" />
        </span>
      </div>

      <div className="relative mt-3 font-mono text-3xl font-semibold tabular-nums">
        {value}
      </div>

      {delta != null || hint ? (
        <div className="relative mt-2 flex items-center gap-1.5 text-xs text-white/85">
          {delta != null ? (
            <span className="inline-flex items-center gap-1 font-medium">
              {delta >= 0 ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {delta >= 0 ? "+" : ""}
              {delta}%
            </span>
          ) : null}
          {hint ? <span className="text-white/70">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
