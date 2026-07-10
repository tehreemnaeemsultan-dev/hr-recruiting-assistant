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
import { scheduleInterview } from "@/app/jobs/actions";

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

  const [start, setStart] = useState(defaultStart());
  const [duration, setDuration] = useState(45);
  const [busy, setBusy] = useState(false);

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
    toast.success(
      res.meetUrl
        ? "Interview scheduled — Google Meet link created and invite sent."
        : "Interview scheduled and invite sent.",
    );
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
              Creates a Google Calendar event with a Meet link and invites{" "}
              {props.candidateName}. Times are Asia/Karachi.
            </DialogDescription>
          </DialogHeader>

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

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onSchedule} disabled={busy}>
              {busy ? "Scheduling…" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
