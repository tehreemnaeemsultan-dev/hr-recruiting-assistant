"use client";

import { useState } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";
import { bookInterviewSlot } from "@/app/book/[token]/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UISlot {
  startLocal: string;
  endLocal: string;
}
interface UIDay {
  date: string;
  label: string;
  slots: UISlot[];
}

function timeLabel(startLocal: string): string {
  const time = startLocal.split("T")[1] ?? "00:00:00";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtConfirm(startLocal: string): string {
  return new Date(`${startLocal}+05:00`).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function BookingCalendar({
  token,
  days,
}: {
  token: string;
  days: UIDay[];
}) {
  const [dayIdx, setDayIdx] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ startLocal: string; meetUrl: string | null } | null>(
    null,
  );

  if (done) {
    return (
      <div className="surface flex flex-col items-center px-6 py-14 text-center">
        <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <CalendarCheck className="size-7" />
        </span>
        <h2 className="text-lg font-semibold">You&apos;re booked in 🎉</h2>
        <p className="text-text-secondary mt-2 text-sm">
          See you on <strong>{fmtConfirm(done.startLocal)}</strong> (PKT). A
          confirmation email with the joining details is on its way.
        </p>
        {done.meetUrl ? (
          <p className="mt-3 text-sm">
            <a href={done.meetUrl} className="text-brand font-medium hover:underline">
              Join Google Meet link
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="surface border-dashed px-6 py-14 text-center">
        <p className="text-text-secondary text-sm">
          There are no open times in the next couple of weeks. Please reply to our
          email and we&apos;ll sort out a time with you.
        </p>
      </div>
    );
  }

  const day = days[Math.min(dayIdx, days.length - 1)];

  async function book(slot: UISlot) {
    setError(null);
    setPending(slot.startLocal);
    const res = await bookInterviewSlot(token, slot.startLocal);
    setPending(null);
    if (res.ok) {
      setDone({ startLocal: res.startLocal, meetUrl: res.meetUrl });
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="surface p-4 sm:p-5">
      {/* Day picker */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {days.map((d, i) => (
          <button
            key={d.date}
            type="button"
            onClick={() => setDayIdx(i)}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              i === dayIdx
                ? "border-brand bg-brand-muted text-brand"
                : "border-border text-text-secondary hover:border-border-strong",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {/* Slots */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {day.slots.map((s) => (
          <Button
            key={s.startLocal}
            type="button"
            variant="outline"
            disabled={pending !== null}
            onClick={() => book(s)}
            className="justify-center"
          >
            {pending === s.startLocal ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              timeLabel(s.startLocal)
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
