import { redirect } from "next/navigation";
import { Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isApifyConfigured } from "@/lib/apify";
import { AppShell } from "@/components/app-shell";
import { SourcingForm } from "@/components/sourcing-form";
import { SourcingRunRow, type RunData } from "@/components/sourcing-run-row";
import {
  SourcedProfileCard,
  type SourcedProfileData,
} from "@/components/sourced-profile-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = { title: "Find people · Mujtaba Hires" };

interface RunRow {
  id: string;
  status: "running" | "succeeded" | "failed";
  result_count: number;
  query: { title?: string; location?: string; company?: string } | null;
  created_at: string;
}
interface ProfileRow {
  id: string;
  full_name: string;
  headline: string | null;
  location: string | null;
  linkedin_url: string | null;
}

export default async function SourcePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const configured = isApifyConfigured();

  const [{ data: runsData }, { data: profilesData }, { data: jobs }] =
    await Promise.all([
      supabase
        .from("sourcing_runs")
        .select("id, status, result_count, query, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("sourced_profiles")
        .select("id, full_name, headline, location, linkedin_url")
        .eq("status", "new")
        .order("created_at", { ascending: false }),
      supabase.from("jobs").select("id, title").order("created_at", { ascending: false }),
    ]);

  const runs: RunData[] = ((runsData ?? []) as RunRow[]).map((r) => ({
    id: r.id,
    status: r.status,
    resultCount: r.result_count,
    query: r.query ?? {},
    createdAt: r.created_at,
  }));
  const profiles: SourcedProfileData[] = ((profilesData ?? []) as ProfileRow[]).map(
    (p) => ({
      id: p.id,
      fullName: p.full_name,
      headline: p.headline,
      location: p.location,
      linkedinUrl: p.linkedin_url,
    }),
  );
  const jobList = (jobs ?? []) as { id: string; title: string }[];

  return (
    <AppShell email={user.email}>
      <div className="mx-auto w-full max-w-4xl px-6 py-8 md:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Find people</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Search public LinkedIn profiles and add the best matches to a role.
          </p>
        </div>

        {!configured ? (
          <Alert className="mb-6">
            <AlertDescription>
              Sourcing isn&apos;t set up yet. Add <code>APIFY_TOKEN</code> to search
              for people.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Search className="text-primary size-4" /> New search
            </CardTitle>
            <CardDescription>
              We only read public profiles — no logins or messaging, ever.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SourcingForm disabled={!configured} />
          </CardContent>
        </Card>

        {runs.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-medium">Recent searches</h2>
            <div className="flex flex-col gap-2">
              {runs.map((r) => (
                <SourcingRunRow key={r.id} run={r} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Users className="text-primary size-4.5" /> To review
            {profiles.length > 0 ? (
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                {profiles.length}
              </span>
            ) : null}
          </h2>
          {profiles.length === 0 ? (
            <div className="bg-card text-muted-foreground rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
              No one to review yet. Run a search above — results show up here for
              you to add or skip.
            </div>
          ) : (
            <div className="stagger grid gap-3 sm:grid-cols-2">
              {profiles.map((p) => (
                <SourcedProfileCard key={p.id} profile={p} jobs={jobList} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
