import { cn } from "@/lib/utils";

/**
 * Official-style brand logos as self-contained inline SVGs (no external
 * requests — CSP-safe). Sized via the `className` on the outer element.
 */

/** Gmail — multicolor envelope on a white app-icon tile (reads in light & dark). */
export function GmailIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-black/5",
        className,
      )}
    >
      <svg
        viewBox="0 0 48 48"
        aria-hidden
        style={{ width: "62%", height: "62%" }}
      >
        <path
          fill="#4caf50"
          d="M45 16.2l-5 2.75l-5 4.75L35 40h7c1.657 0 3-1.343 3-3V16.2z"
        />
        <path
          fill="#1e88e5"
          d="M3 16.2l3.614 1.71L13 23.7V40H6c-1.657 0-3-1.343-3-3V16.2z"
        />
        <polygon
          fill="#e53935"
          points="35,11.2 24,19.45 13,11.2 12,17 13,23.7 24,31.95 35,23.7 36,17"
        />
        <path
          fill="#c62828"
          d="M3 12.298V16.2l10 7.5V11.2L9.876 8.859C9.132 8.301 8.228 8 7.298 8C4.924 8 3 9.924 3 12.298z"
        />
        <path
          fill="#fbc02d"
          d="M45 12.298V16.2l-10 7.5V11.2l3.124-2.341C38.868 8.301 39.772 8 40.702 8C43.076 8 45 9.924 45 12.298z"
        />
      </svg>
    </span>
  );
}

/** LinkedIn — white "in" on the brand blue rounded square. */
export function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-96 -40 640 592"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <rect x="-96" y="-40" width="640" height="592" rx="120" fill="#0a66c2" />
      <path
        fill="#fff"
        d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z"
      />
    </svg>
  );
}
