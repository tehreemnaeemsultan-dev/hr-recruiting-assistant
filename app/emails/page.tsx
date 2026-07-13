import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { ZohoMailIcon } from "@/components/brand-icons";

export const metadata = {
  title: "Emails · Mujtaba Hires",
};

interface EmailRow {
  id: string;
  to_address: string;
  subject: string;
  body: string;
  status: "sent" | "failed";
  created_at: string;
  applications: {
    candidate_id: string;
    candidates: { full_name: string } | null;
    jobs: { id: string; title: string } | null;
  } | null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function EmailsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("emails")
    .select(
      "id, to_address, subject, body, status, created_at, applications(candidate_id, candidates(full_name), jobs(id, title))",
    )
    .order("created_at", { ascending: false });

  const emails = (data ?? []) as unknown as EmailRow[];
  const sent = emails.filter((e) => e.status === "sent").length;
  const failed = emails.filter((e) => e.status === "failed").length;

  return (
    <AppShell email={user.email} avatarUrl={(user.user_metadata?.avatar_url as string | undefined) ?? null}>
      <div className="page-enter mx-auto w-full max-w-4xl px-5 py-7 md:px-6 md:py-9">
        <div className="mb-7">
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
            Emails
          </h1>
          <p className="text-text-secondary mt-1 text-sm">
            Every message sent to candidates from Mujtaba Hires.
          </p>
        </div>

        {error ? (
          <div className="surface text-text-secondary border-dashed p-10 text-center text-sm">
            Couldn&apos;t load emails. The database schema may not be applied yet.
          </div>
        ) : emails.length === 0 ? (
          <div className="surface flex flex-col items-center justify-center border-dashed px-6 py-16 text-center">
            <span className="bg-brand-muted text-brand mb-4 flex size-14 items-center justify-center rounded-2xl">
              <Mail className="size-7" />
            </span>
            <h3 className="text-base font-semibold">No emails yet</h3>
            <p className="text-text-secondary mt-1 max-w-sm text-sm">
              Emails you send to candidates — from the board, a candidate profile,
              or on rejection — will appear here.
            </p>
          </div>
        ) : (
          <>
            <section className="stagger mb-6 grid grid-cols-2 gap-3 sm:max-w-md lg:gap-4">
              <StatCard label="Sent" value={sent} icon={CheckCircle2} accent="emerald" />
              <StatCard label="Failed" value={failed} icon={XCircle} accent="red" />
            </section>

            <div className="surface divide-y overflow-hidden">
              {emails.map((e) => {
                const name = e.applications?.candidates?.full_name ?? "Unknown candidate";
                const job = e.applications?.jobs;
                const candidateId = e.applications?.candidate_id;
                return (
                  <details key={e.id} className="group">
                    <summary className="hover:bg-brand-ghost flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors">
                      <ZohoMailIcon className="size-9" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {e.subject}
                          </span>
                          {e.status === "sent" ? (
                            <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Sent
                            </span>
                          ) : (
                            <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-red-200 bg-red-50 px-2 text-[11px] font-medium text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
                              Failed
                            </span>
                          )}
                        </div>
                        <div className="text-text-secondary truncate text-xs">
                          To {e.to_address} · {name}
                          {job ? <> · {job.title}</> : null}
                        </div>
                      </div>
                      <span className="text-text-tertiary hidden shrink-0 text-xs sm:block">
                        {fmt(e.created_at)}
                      </span>
                      <ChevronDown className="text-text-tertiary size-4 shrink-0 transition-transform group-open:rotate-180" />
                    </summary>

                    <div className="border-t px-4 py-4">
                      <div className="text-text-secondary mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs sm:hidden">
                        <span>{fmt(e.created_at)}</span>
                      </div>
                      <div className="text-foreground/90 whitespace-pre-wrap text-sm">
                        {e.body}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3 text-xs">
                        {candidateId ? (
                          <Link
                            href={`/candidates/${candidateId}`}
                            className="text-brand font-medium hover:underline"
                          >
                            View candidate
                          </Link>
                        ) : null}
                        {job ? (
                          <Link
                            href={`/jobs/${job.id}`}
                            className="text-brand font-medium hover:underline"
                          >
                            View role
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
