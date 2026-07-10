"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    <div className="bg-card flex items-center justify-between gap-3 rounded-xl border p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{summary || "Search"}</div>
        <div className="text-muted-foreground text-xs">
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
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
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
          <Badge variant={run.status === "succeeded" ? "secondary" : "outline"}>
            {run.status === "succeeded" ? "Done" : "Failed"}
          </Badge>
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
