"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disconnectGoogle } from "@/app/settings/actions";

export function DisconnectGoogleButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("Disconnect Google? You'll need to reconnect to send email or schedule interviews.")) {
      return;
    }
    startTransition(async () => {
      const res = await disconnectGoogle();
      if (!res.ok) toast.error(res.error);
      else toast.success("Google disconnected.");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </Button>
  );
}
