"use client";

import { useActionState } from "react";
import { Search, Loader2 } from "lucide-react";
import { startSourcing, type SourcingState } from "@/app/source/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function SourcingForm({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState<SourcingState, FormData>(
    startSourcing,
    undefined,
  );
  const error = state && "error" in state ? state.error : null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Role / title</Label>
          <Input id="title" name="title" placeholder="e.g. Product Designer" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" placeholder="e.g. Islamabad" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="company">Company (optional)</Label>
          <Input id="company" name="company" placeholder="e.g. a current employer" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="maxItems">How many to fetch</Label>
          <Input
            id="maxItems"
            name="maxItems"
            type="number"
            min={1}
            max={25}
            defaultValue={10}
          />
          <p className="text-text-tertiary text-xs">Up to 25 per search.</p>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending || disabled}
        className="w-full gap-2"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Searching LinkedIn…
          </>
        ) : (
          <>
            <Search className="size-4" /> Search
          </>
        )}
      </Button>
    </form>
  );
}
