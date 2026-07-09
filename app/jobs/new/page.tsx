import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { JobForm } from "@/components/job-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "New job · HR Recruiting Assistant",
};

export default async function NewJobPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader email={user.email} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="mb-6">
          <Link href="/" className="text-muted-foreground text-sm hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Create a job
          </h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job details</CardTitle>
            <CardDescription>
              Paste the job description and describe your ranking criteria in
              plain language.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JobForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
