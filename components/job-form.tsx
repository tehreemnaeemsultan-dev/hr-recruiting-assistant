"use client";

import { useActionState } from "react";
import { createJob, type CreateJobState } from "@/app/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function JobForm() {
  const [state, action, pending] = useActionState<CreateJobState, FormData>(
    createJob,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Job title</Label>
        <Input
          id="title"
          name="title"
          placeholder="e.g. B2B SaaS Account Executive"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="jd_text">Job description</Label>
        <Textarea
          id="jd_text"
          name="jd_text"
          rows={8}
          placeholder="Paste the full job description here…"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="criteria_text">Ranking criteria</Label>
        <Textarea
          id="criteria_text"
          name="criteria_text"
          rows={5}
          placeholder="Free-form, in plain language. e.g. 5+ years B2B SaaS sales, fluent English, based in or near Islamabad, experience selling to enterprise."
          required
        />
        <p className="text-muted-foreground text-xs">
          This is the priority signal used to rank CVs. Be specific.
        </p>
      </div>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create job"}
        </Button>
      </div>
    </form>
  );
}
