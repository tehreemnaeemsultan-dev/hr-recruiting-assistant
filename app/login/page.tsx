import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Sign in · Mujtaba Hires",
};

/** A drifting candidate card for the hero visualization — real, polished content. */
function FloatCard({
  className,
  rotate,
  delay,
  duration,
  name,
  role,
  initials,
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
  initials: string;
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
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white ring-1 ring-white/20">
          {initials}
        </span>
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
            name="Ayesha Khan"
            role="Senior Product Designer"
            initials="AK"
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
            name="Bilal Ahmed"
            role="Full-Stack Engineer"
            initials="BA"
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
            name="Sana Malik"
            role="Data Scientist"
            initials="SM"
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
