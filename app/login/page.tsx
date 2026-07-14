import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Sign in · Mujtaba Hires",
};

/** One abstract, drifting "candidate card" for the hero visualization. */
function FloatCard({
  className,
  rotate,
  delay,
  duration,
  score,
  scoreClass,
}: {
  className: string;
  rotate: string;
  delay: string;
  duration: string;
  score: string;
  scoreClass: string;
}) {
  return (
    <div
      className={`absolute w-52 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md ${className}`}
      style={
        {
          ["--r"]: rotate,
          animation: `float-card ${duration} ease-in-out ${delay} infinite`,
        } as React.CSSProperties
      }
    >
      <div className="flex items-center gap-3">
        <span className="size-9 rounded-full bg-gradient-to-br from-white/80 to-white/40" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2 w-24 rounded-full bg-white/50" />
          <div className="h-2 w-16 rounded-full bg-white/25" />
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${scoreClass}`}
        >
          {score}
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="h-1.5 w-full rounded-full bg-white/20" />
        <div className="h-1.5 w-3/4 rounded-full bg-white/15" />
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
            className="top-[18%] right-[10%]"
            rotate="-6deg"
            delay="0s"
            duration="7s"
            score="92"
            scoreClass="bg-emerald-400/90 text-emerald-950"
          />
          <FloatCard
            className="top-[42%] right-[26%]"
            rotate="4deg"
            delay="1.2s"
            duration="8.5s"
            score="78"
            scoreClass="bg-amber-300/90 text-amber-950"
          />
          <FloatCard
            className="bottom-[16%] right-[14%]"
            rotate="-3deg"
            delay="0.6s"
            duration="9s"
            score="85"
            scoreClass="bg-amber-300/90 text-amber-950"
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
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#5b6ff0] to-[#3a5ce8] text-xs font-bold text-white">
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
