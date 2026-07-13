"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncInboundEmails } from "@/app/emails/actions";
import { Button } from "@/components/ui/button";

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

/**
 * Checks the Zoho inbox for new candidate replies: automatically on mount
 * (rate-limited server-side) and on demand via the Refresh button.
 */
export function SyncReplies({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  // Auto-check once when the tab is opened.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await syncInboundEmails();
      if (!cancelled && res.ok && !res.skipped && (res.inserted ?? 0) > 0) {
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const refresh = () => {
    setNote(null);
    startTransition(async () => {
      const res = await syncInboundEmails({ force: true });
      if (res.ok) {
        const n = res.inserted ?? 0;
        setNote(n > 0 ? `${n} new repl${n === 1 ? "y" : "ies"}` : "No new replies");
        if (n > 0) router.refresh();
      } else {
        setNote(res.error);
      }
    });
  };

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <p className="text-text-tertiary text-xs">
        {pending ? "Checking inbox…" : note ?? `Last checked ${relativeTime(lastSyncedAt)}`}
      </p>
      <Button variant="outline" size="sm" onClick={refresh} disabled={pending} className="gap-2">
        <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
        Refresh
      </Button>
    </div>
  );
}
