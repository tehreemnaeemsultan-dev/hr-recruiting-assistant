"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rescoreJob } from "@/app/jobs/actions";

export function RescoreJobButton({
  jobId,
  disabled,
}: {
  jobId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await rescoreJob(jobId);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success(
          `Re-scored ${res.scored} candidate${res.scored === 1 ? "" : "s"}` +
            (res.errors ? ` · ${res.errors} error(s)` : ""),
        );
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={pending || disabled}
    >
      {pending ? "Reviewing…" : "Re-review all"}
    </Button>
  );
}
