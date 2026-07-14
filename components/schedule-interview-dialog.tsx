"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { scheduleInterview, sendBookingLink } from "@/app/jobs/actions";

const DURATIONS = [30, 45, 60];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toWallClock(value: string, addMinutes: number): string {
  const d = new Date(value);
  d.setMinutes(d.getMinutes() + addMinutes);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

interface Props {
  applicationId: string;
  jobId: string;
  candidateName: string;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ScheduleInterviewDialog(props: Props) {
  const router = useRouter();
  const controlled = props.open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? (props.open as boolean) : internalOpen;
  const setOpen = controlled
    ? (props.onOpenChange ?? (() => {}))
    : setInternalOpen;

  const [mode, setMode] = useState<"invite" | "manual">("invite");
  const [start, setStart] = useState(defaultStart());
  const [duration, setDuration] = useState(45);
  const [busy, setBusy] = useState(false);

  async function onSendLink() {
    setBusy(true);
    const res = await sendBookingLink(props.applicationId, props.jobId);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Booking link sent to ${props.candidateName}.`);
    setOpen(false);
    router.refresh();
  }

  async function onSchedule() {
    if (!start) {
      toast.error("Pick a date and time.");
      return;
    }
    setBusy(true);
    const res = await scheduleInterview(props.applicationId, props.jobId, {
      startLocal: toWallClock(start, 0),
      endLocal: toWallClock(start, duration),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.email === "sent") {
      toast.success(
        "Interview scheduled — Meet link created and emailed to the candidate.",
      );
    } else if (res.email === "failed") {
      toast.warning(
        "Interview scheduled, but the invite email to the candidate failed — check the Emails tab.",
      );
    } else {
      toast.success(
        res.meetUrl
          ? "Interview scheduled — Meet link created. (No candidate email on file.)"
          : "Interview scheduled. (No candidate email on file.)",
      );
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {!controlled ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setInternalOpen(true)}
        >
          {props.triggerLabel ?? "Schedule interview"}
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule interview</DialogTitle>
            <DialogDescription>
              {mode === "invite"
                ? `Email ${props.candidateName} a link to pick their own time from your open slots.`
                : `Create a Google Meet event at a fixed time and invite ${props.candidateName}. Times are Asia/Karachi.`}
            </DialogDescription>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="bg-secondary flex items-center gap-0.5 rounded-lg p-0.5">
            {(
              [
                ["invite", "Let candidate pick"],
                ["manual", "Set time myself"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === value
                    ? "bg-card text-foreground shadow-xs"
                    : "text-text-secondary hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "invite" ? (
            <div className="text-text-secondary rounded-lg border border-dashed p-4 text-sm">
              The candidate gets a private link showing your open slots (Mon–Fri,
              11–1 & 3–5 PKT, 30 min). When they pick one, a Google Meet event is
              created on your calendar and a Zoho confirmation email is sent
              automatically.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="interview-start">Start</Label>
                <Input
                  id="interview-start"
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Duration</Label>
                <div className="flex gap-2">
                  {DURATIONS.map((d) => (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={duration === d ? "default" : "outline"}
                      onClick={() => setDuration(d)}
                    >
                      {d} min
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            {mode === "invite" ? (
              <Button type="button" onClick={onSendLink} disabled={busy}>
                {busy ? "Sending…" : "Send booking link"}
              </Button>
            ) : (
              <Button type="button" onClick={onSchedule} disabled={busy}>
                {busy ? "Scheduling…" : "Schedule"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
