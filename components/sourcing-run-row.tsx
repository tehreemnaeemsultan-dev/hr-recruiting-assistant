"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pollSourcingRun, deleteSourcingRun } from "@/app/source/actions";

export interface RunData {
  id: string;
  status: "running" | "succeeded" | "failed";
  resultCount: number;
  query: { title?: string; location?: string; company?: string };
  createdAt: string;
}

export function SourcingRunRow({ run }: { run: RunData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checking, setChecking] = useState(false);
  const polledRef = useRef(false);

  const summary = [run.query.title, run.query.location, run.query.company]
    .filter(Boolean)
    .join(" · ");

  async function check(silent: boolean) {
    if (checking) return;
    setChecking(true);
    const res = await pollSourcingRun(run.id);
    setChecking(false);
    if (!res.ok) {
      if (!silent) toast.error(res.error);
      return;
    }
    if (res.status !== "running") {
      toast.success(
        res.status === "succeeded"
          ? `Found ${res.count ?? 0} profile(s) to review.`
          : "That search didn't complete.",
      );
      router.refresh();
    } else if (!silent) {
      toast.message("Still searching — this can take a minute.");
    }
  }

  // Auto-poll once shortly after mount for running searches.
  useEffect(() => {
    if (run.status !== "running" || polledRef.current) return;
    polledRef.current = true;
    const t = setInterval(() => check(true), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.status]);

  function onDelete() {
    startTransition(async () => {
      const res = await deleteSourcingRun(run.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="bg-card hover:border-border-strong flex items-center justify-between gap-3 rounded-xl border p-3 shadow-xs transition-colors">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{summary || "Search"}</div>
        <div className="text-text-secondary text-xs">
          {run.status === "succeeded"
            ? `${run.resultCount} found`
            : run.status === "failed"
              ? "Didn't complete"
              : "Searching…"}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {run.status === "running" ? (
          <>
            <Loader2 className="text-brand size-4 animate-spin" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => check(false)}
              disabled={checking}
            >
              {checking ? "Checking…" : "Check now"}
            </Button>
          </>
        ) : (
          <span
            className={
              run.status === "succeeded"
                ? "inline-flex h-6 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "inline-flex h-6 items-center rounded-full border border-red-200 bg-red-50 px-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
            }
          >
            {run.status === "succeeded" ? "Done" : "Failed"}
          </span>
        )}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={onDelete}
          disabled={pending}
          aria-label="Remove search"
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
