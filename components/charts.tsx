import { cn } from "@/lib/utils";

/**
 * Lightweight, dependency-free SVG charts. Pure functions of their props
 * (no hooks, no client JS) so they render inside server components. Colors
 * resolve from theme CSS variables, so they adapt to light/dark automatically.
 *
 * `currentColor` drives single-series charts — set the hue with a text-color
 * utility on the element (e.g. `className="text-primary"`).
 */

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

// ---------------------------------------------------------------------------
// Area chart — smooth line with a gradient fill.
// ---------------------------------------------------------------------------

export interface Point {
  label: string;
  value: number;
}

/** Catmull-Rom → cubic Bézier for a smooth line through the points. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function AreaChart({
  data,
  height = 220,
  className,
  valueSuffix = "",
}: {
  data: Point[];
  height?: number;
  className?: string;
  valueSuffix?: string;
}) {
  const W = 640;
  const H = height;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const pts = data.map((d, i) => ({
    x: padL + i * stepX,
    y: padT + innerH - (d.value / max) * innerH,
  }));

  const line = smoothPath(pts);
  const area =
    pts.length > 0
      ? `${line} L ${pts[pts.length - 1].x} ${padT + innerH} L ${pts[0].x} ${
          padT + innerH
        } Z`
      : "";

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const gid = `area-grad-${data.length}-${Math.round(max)}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("text-primary w-full", className)}
      preserveAspectRatio="none"
      role="img"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* horizontal grid */}
      {gridLines.map((g) => {
        const y = padT + innerH * g;
        return (
          <line
            key={g}
            x1={padL}
            x2={W - padR}
            y1={y}
            y2={y}
            className="text-border"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="3 4"
            opacity={0.6}
          />
        );
      })}

      {area ? <path d={area} fill={`url(#${gid})`} /> : null}
      {line ? (
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {/* end dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="currentColor">
          <title>{`${data[i].label}: ${data[i].value}${valueSuffix}`}</title>
        </circle>
      ))}

      {/* x labels */}
      {data.map((d, i) => (
        <text
          key={i}
          x={pts[i].x}
          y={H - 8}
          textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
          className="fill-muted-foreground"
          style={{ fontSize: 11 }}
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Donut chart — segments + a hollow center, with a legend beside it.
// ---------------------------------------------------------------------------

export interface Segment {
  label: string;
  value: number;
  color: string;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const a = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arc(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

export function DonutChart({
  data,
  size = 180,
  thickness = 22,
  centerLabel,
  centerValue,
  className,
}: {
  data: Segment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;

  let acc = 0;
  const segs = data.map((d) => {
    const start = total > 0 ? (acc / total) * 360 : 0;
    acc += d.value;
    const end = total > 0 ? (acc / total) * 360 : 0;
    return { ...d, start, end };
  });

  return (
    <div className={cn("flex flex-wrap items-center gap-6", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full">
          {/* track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            className="text-muted"
            strokeWidth={thickness}
          />
          {total > 0 &&
            segs.map((s, i) =>
              s.end - s.start > 0.01 ? (
                <path
                  key={i}
                  d={
                    s.end - s.start >= 359.999
                      ? // full circle: draw as two arcs
                        `${arc(cx, cy, r, 0, 180)} ${arc(cx, cy, r, 180, 360)}`
                      : arc(cx, cy, r, s.start, s.end)
                  }
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeLinecap="butt"
                >
                  <title>{`${s.label}: ${s.value}`}</title>
                </path>
              ) : null,
            )}
        </svg>
        {centerValue != null || centerLabel ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue != null ? (
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {centerValue}
              </span>
            ) : null}
            {centerLabel ? (
              <span className="text-muted-foreground text-xs">{centerLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="truncate">{d.label}</span>
            <span className="text-muted-foreground ml-auto tabular-nums">
              {d.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar chart — vertical bars with rounded tops and x labels.
// ---------------------------------------------------------------------------

export interface Bar {
  label: string;
  value: number;
  color?: string;
}

export function BarChart({
  data,
  height = 220,
  className,
}: {
  data: Bar[];
  height?: number;
  className?: string;
}) {
  const W = 640;
  const H = height;
  const padT = 12;
  const padB = 28;
  const innerH = H - padT - padB;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const slot = W / n;
  const barW = Math.min(46, slot * 0.55);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("text-primary w-full", className)}
      preserveAspectRatio="none"
      role="img"
    >
      {[0.25, 0.5, 0.75, 1].map((g) => {
        const y = padT + innerH * (1 - g);
        return (
          <line
            key={g}
            x1={0}
            x2={W}
            y1={y}
            y2={y}
            className="text-border"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="3 4"
            opacity={0.6}
          />
        );
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * innerH;
        const x = i * slot + (slot - barW) / 2;
        const y = padT + innerH - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 2)}
              rx={6}
              fill={d.color ?? "currentColor"}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            <text
              x={i * slot + slot / 2}
              y={H - 9}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 11 }}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Horizontal funnel bars — labeled rows with a value on the right.
// ---------------------------------------------------------------------------

export function FunnelBars({
  data,
  className,
}: {
  data: { label: string; value: number; color?: string }[];
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn("space-y-3", className)}>
      {data.map((d, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>{d.label}</span>
            <span className="text-muted-foreground tabular-nums">{d.value}</span>
          </div>
          <div className="bg-muted h-2.5 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: d.color ?? "var(--primary)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
