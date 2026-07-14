import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Sign in · Mujtaba Hires",
};

/** Self-contained illustrated avatar (no external requests), with blinking eyes. */
const AVATARS = [
  { bg1: "#f9c0cb", bg2: "#e07a94", skin: "#f2c9a0", hair: "#5a3b28", top: "#fef4ec", style: "long" },
  { bg1: "#8fd7c6", bg2: "#3a9d88", skin: "#e0a878", hair: "#241f1b", top: "#eafaf5", style: "short" },
  { bg1: "#f7d391", bg2: "#e0a24e", skin: "#f0c8a2", hair: "#8a3b2a", top: "#fdf6e7", style: "bob" },
] as const;

function HeroAvatar({ v }: { v: 0 | 1 | 2 }) {
  const a = AVATARS[v];
  const id = `hav${v}`;
  const hair =
    a.style === "long" ? (
      <path
        d="M29 46 Q29 21 50 21 Q71 21 71 46 Q66 33 50 32 Q34 33 29 46 Z M29 46 Q26 66 31 78 L37 78 Q31 58 36 44 Z M71 46 Q74 66 69 78 L63 78 Q69 58 64 44 Z"
        fill={a.hair}
      />
    ) : a.style === "bob" ? (
      <path
        d="M29 50 Q29 22 50 22 Q71 22 71 50 L71 40 Q66 32 50 32 Q34 32 29 40 Z M29 50 L34 60 L37 43 Z M71 50 L66 60 L63 43 Z"
        fill={a.hair}
      />
    ) : (
      <path d="M30 45 Q32 23 50 23 Q68 23 70 45 Q64 32 50 32 Q36 32 30 45 Z" fill={a.hair} />
    );
  return (
    <svg viewBox="0 0 100 100" className="size-11 shrink-0 rounded-full shadow-sm ring-2 ring-white/25" aria-hidden>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a.bg1} />
          <stop offset="1" stopColor={a.bg2} />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="100" height="100" fill={`url(#${id}g)`} />
        <ellipse cx="50" cy="102" rx="33" ry="26" fill={a.top} />
        <rect x="45" y="58" width="10" height="15" rx="5" fill={a.skin} />
        <circle cx="50" cy="45" r="18" fill={a.skin} />
        {hair}
        <g className="hero-eye" fill="#3a2e28">
          <ellipse cx="43.5" cy="45" rx="2" ry="2.6" />
          <ellipse cx="56.5" cy="45" rx="2" ry="2.6" />
        </g>
        <path d="M45 52 Q50 56 55 52" stroke="#b5695a" strokeWidth="2" fill="none" strokeLinecap="round" />
        {v === 1 ? (
          <path d="M39 49 Q50 66 61 49 Q57 58 50 58 Q43 58 39 49 Z" fill={a.hair} opacity="0.9" />
        ) : null}
      </g>
    </svg>
  );
}

/** A drifting candidate card for the hero visualization — real, polished content. */
function FloatCard({
  className,
  rotate,
  delay,
  duration,
  name,
  role,
  avatar,
  score,
  scoreClass,
  stage,
  tags,
}: {
  className: string;
  rotate: string;
  delay: string;
  duration: string;
  name: string;
  role: string;
  avatar: 0 | 1 | 2;
  score: string;
  scoreClass: string;
  stage: string;
  tags: string[];
}) {
  return (
    <div
      className={`absolute w-64 rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/30 backdrop-blur-md ${className}`}
      style={
        {
          ["--r"]: rotate,
          animation: `float-card ${duration} ease-in-out ${delay} infinite`,
        } as React.CSSProperties
      }
    >
      <div className="flex items-center gap-3">
        <HeroAvatar v={avatar} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{name}</div>
          <div className="truncate text-xs text-white/60">{role}</div>
        </div>
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${scoreClass}`}
        >
          {score}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80 ring-1 ring-white/10"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-200 ring-1 ring-emerald-300/20">
          <span className="size-1.5 rounded-full bg-emerald-300" />
          {stage}
        </span>
        <span className="text-[10px] font-medium text-white/40">
          {score}% match
        </span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-svh">
      {/* Left — brand hero (desktop only) */}
      <section className="relative hidden w-3/5 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#26231d] via-[#1c1a17] to-[#121110] p-10 text-white lg:flex">
        {/* Ambient drifting orbs */}
        <div className="pointer-events-none absolute inset-0 -z-0">
          <div
            className="absolute -top-24 -left-16 size-96 rounded-full bg-[#e6d3a8]/15 blur-3xl"
            style={{ animation: "drift-orb 18s ease-in-out infinite" }}
          />
          <div
            className="absolute right-0 bottom-0 size-[28rem] rounded-full bg-[#c2a878]/15 blur-3xl"
            style={{ animation: "drift-orb 22s ease-in-out 2s infinite" }}
          />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur">
            MH
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Mujtaba Hires
          </span>
        </div>

        {/* Headline + visualization */}
        <div className="relative z-10 max-w-lg">
          <h1 className="font-heading text-4xl leading-tight font-extrabold tracking-tight sm:text-[2.75rem]">
            Hire smarter,
            <br />
            not harder.
          </h1>
          <p className="mt-4 max-w-md text-base text-white/60">
            AI-powered candidate ranking, pipeline management, and scheduling —
            all in one place.
          </p>
        </div>

        {/* Floating candidate cards */}
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <FloatCard
            className="top-[16%] right-[8%]"
            rotate="-6deg"
            delay="0s"
            duration="7s"
            name="Emma Carter"
            role="Senior Product Designer"
            avatar={0}
            score="92"
            scoreClass="bg-emerald-400/90 text-emerald-950"
            stage="Interview"
            tags={["Figma", "Design Systems", "UX"]}
          />
          <FloatCard
            className="top-[44%] right-[27%]"
            rotate="4deg"
            delay="1.2s"
            duration="8.5s"
            name="James Bennett"
            role="Full-Stack Engineer"
            avatar={1}
            score="85"
            scoreClass="bg-amber-300/90 text-amber-950"
            stage="Shortlisted"
            tags={["React", "Node.js", "AWS"]}
          />
          <FloatCard
            className="bottom-[14%] right-[12%]"
            rotate="-3deg"
            delay="0.6s"
            duration="9s"
            name="Olivia Reed"
            role="Data Scientist"
            avatar={2}
            score="78"
            scoreClass="bg-amber-300/90 text-amber-950"
            stage="Screening"
            tags={["Python", "ML", "SQL"]}
          />
        </div>

        {/* Trust signal */}
        <div className="relative z-10 text-sm text-white/40">
          Built with ♥ in Islamabad
        </div>
      </section>

      {/* Right — form panel */}
      <section className="bg-background relative flex w-full flex-col lg:w-2/5">
        {/* Mobile branded header */}
        <div className="flex items-center gap-2.5 border-b px-5 py-4 lg:hidden">
          <span className="bg-primary text-primary-foreground shadow-inset-btn flex size-8 items-center justify-center rounded-lg text-xs font-bold">
            MH
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Mujtaba Hires
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center p-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
