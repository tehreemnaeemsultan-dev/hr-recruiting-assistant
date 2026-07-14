"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveBookingUrl } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BookingUrlForm({ initialUrl }: { initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await saveBookingUrl(url);
    setBusy(false);
    if (res.ok) toast.success("Booking link saved.");
    else toast.error(res.error);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://calendar.app.google/…"
        className="flex-1"
      />
      <Button type="button" onClick={save} disabled={busy} className="shrink-0">
        {busy ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
