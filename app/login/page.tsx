import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Sign in · HR Recruiting Assistant",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <LoginForm />
    </main>
  );
}
