"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { login, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-sm">
      <span className="mb-6 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#5b6ff0] to-[#3a5ce8] text-base font-bold text-white shadow-lg shadow-[#3a5ce8]/25">
        MH
      </span>

      <h1 className="font-heading text-2xl font-bold tracking-tight">
        Welcome back
      </h1>
      <p className="text-text-secondary mt-1 text-sm">
        Sign in to keep things moving.
      </p>

      <form action={formAction} className="mt-7 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="text-text-tertiary hover:text-text-secondary absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg transition-colors"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        {state?.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={pending} size="lg" className="mt-1 w-full">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <p className="text-text-secondary mt-6 text-center text-sm">
        Don&apos;t have an account?{" "}
        <span className="text-brand font-medium">Contact your admin</span>
      </p>
    </div>
  );
}
