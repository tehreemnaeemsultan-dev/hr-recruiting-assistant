"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateApplicationNotes } from "@/app/jobs/actions";

export function ApplicationNotes({
  applicationId,
  jobId,
  initialNotes,
}: {
  applicationId: string;
  jobId: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(initialNotes);
  const [pending, startTransition] = useTransition();
  const dirty = notes !== saved;

  function onSave() {
    startTransition(async () => {
      const res = await updateApplicationNotes(applicationId, jobId, notes);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        setSaved(notes);
        toast.success("Notes saved.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Private notes about this candidate for this job…"
      />
      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onSave}
          disabled={pending || !dirty}
        >
          {pending ? "Saving…" : dirty ? "Save notes" : "Saved"}
        </Button>
      </div>
    </div>
  );
}
