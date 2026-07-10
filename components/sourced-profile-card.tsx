"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  importSourcedProfile,
  dismissSourcedProfile,
} from "@/app/source/actions";

export interface SourcedProfileData {
  id: string;
  fullName: string;
  headline: string | null;
  location: string | null;
  linkedinUrl: string | null;
}

const AVATAR_COLORS = [
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
];
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function SourcedProfileCard({
  profile,
  jobs,
}: {
  profile: SourcedProfileData;
  jobs: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  function onImport() {
    if (!jobId) {
      toast.error("Create a role first, then add this person to it.");
      return;
    }
    startTransition(async () => {
      const res = await importSourcedProfile(profile.id, jobId);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`${profile.fullName} added.`);
        router.refresh();
      }
    });
  }

  function onDismiss() {
    startTransition(async () => {
      const res = await dismissSourcedProfile(profile.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(
            profile.fullName,
          )}`}
        >
          {initials(profile.fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{profile.fullName}</span>
            {profile.linkedinUrl ? (
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Open LinkedIn profile"
              >
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
          {profile.headline ? (
            <div className="text-muted-foreground truncate text-sm">
              {profile.headline}
            </div>
          ) : null}
          {profile.location ? (
            <div className="text-muted-foreground text-xs">{profile.location}</div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          disabled={jobs.length === 0}
          className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
          aria-label="Choose a role"
        >
          {jobs.length === 0 ? (
            <option value="">No roles yet</option>
          ) : (
            jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))
          )}
        </select>
        <Button type="button" size="sm" onClick={onImport} disabled={pending}>
          {pending ? "Adding…" : "Add to role"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          disabled={pending}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
