import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
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
    <AppShell email={user.email}>
      <div className="mx-auto w-full max-w-2xl px-6 py-8 md:py-10">
        <div className="mb-6">
          <Link href="/" className="text-muted-foreground text-sm hover:underline">
            ← Home
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Add a role
          </h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Role details</CardTitle>
            <CardDescription>
              Add the role details and tell us what a great person looks like —
              in plain language.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JobForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
