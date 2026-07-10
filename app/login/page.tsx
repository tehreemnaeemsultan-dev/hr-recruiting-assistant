import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Sign in · Mujtaba Hires",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden p-6">
      {/* Ambient violet glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-primary/20 absolute top-0 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full blur-3xl" />
        <div className="bg-primary/10 absolute right-0 bottom-0 h-[24rem] w-[24rem] translate-x-1/4 translate-y-1/4 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-lg font-bold text-white shadow-lg shadow-violet-600/25">
            MH
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Mujtaba Hires</h1>
            <p className="text-muted-foreground text-sm">
              Find and hire great people.
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
