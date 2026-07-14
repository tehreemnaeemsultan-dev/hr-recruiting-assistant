import "server-only";

// Interview availability rules (owner-provided). Asia/Karachi is a fixed UTC+5
// with no DST, which keeps the slot math simple.
export const AVAILABILITY = {
  timeZone: "Asia/Karachi",
  utcOffsetMinutes: 5 * 60,
  workingDays: [1, 2, 3, 4, 5], // Mon–Fri (0 = Sun)
  windows: [
    { start: "11:00", end: "13:00" },
    { start: "15:00", end: "17:00" },
  ],
  slotMinutes: 30,
  lookaheadDays: 14,
  minLeadHours: 12, // candidates can't book anything sooner than this
} as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Instant for a Karachi wall-clock string "YYYY-MM-DDTHH:MM:00". */
function karachiInstant(wallClock: string): Date {
  return new Date(`${wallClock}+05:00`);
}

export interface Slot {
  startLocal: string; // "YYYY-MM-DDTHH:MM:00" (Asia/Karachi wall-clock)
  endLocal: string;
  startISO: string; // absolute instant (UTC ISO)
  booked: boolean;
}
export interface DaySlots {
  date: string; // "YYYY-MM-DD" (Karachi)
  label: string; // e.g. "Mon, 14 Jul"
  slots: Slot[];
}
export interface BusyInterval {
  start: string | Date | null;
  end: string | Date | null;
}

/** End wall-clock of a 30-min slot (windows never cross midnight). */
export function slotEndLocal(startLocal: string): string {
  const [date, time] = startLocal.split("T");
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + AVAILABILITY.slotMinutes;
  return `${date}T${pad(Math.floor(total / 60))}:${pad(total % 60)}:00`;
}

function overlaps(aS: number, aE: number, bS: number, bE: number): boolean {
  return aS < bE && bS < aE;
}

/** Build the open/booked slot grid for the next `lookaheadDays` working days. */
export function generateSlots(
  busy: BusyInterval[] = [],
  now: Date = new Date(),
): DaySlots[] {
  const busyMs = busy
    .filter((b) => b.start && b.end)
    .map((b) => ({
      start: new Date(b.start as string | Date).getTime(),
      end: new Date(b.end as string | Date).getTime(),
    }));
  const minStartMs = now.getTime() + AVAILABILITY.minLeadHours * 3_600_000;

  // Shift so UTC date-parts equal Karachi local date-parts.
  const base = new Date(now.getTime() + AVAILABILITY.utcOffsetMinutes * 60_000);
  const days: DaySlots[] = [];

  for (let d = 0; d <= AVAILABILITY.lookaheadDays; d++) {
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() + d);
    if (!(AVAILABILITY.workingDays as readonly number[]).includes(day.getUTCDay()))
      continue;

    const dateStr = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
    const slots: Slot[] = [];

    for (const w of AVAILABILITY.windows) {
      const [wh, wm] = w.start.split(":").map(Number);
      const [eh, em] = w.end.split(":").map(Number);
      const endMins = eh * 60 + em;
      for (
        let mins = wh * 60 + wm;
        mins + AVAILABILITY.slotMinutes <= endMins;
        mins += AVAILABILITY.slotMinutes
      ) {
        const startLocal = `${dateStr}T${pad(Math.floor(mins / 60))}:${pad(mins % 60)}:00`;
        const endLocal = slotEndLocal(startLocal);
        const sMs = karachiInstant(startLocal).getTime();
        const eMs = karachiInstant(endLocal).getTime();
        if (sMs < minStartMs) continue;
        slots.push({
          startLocal,
          endLocal,
          startISO: new Date(sMs).toISOString(),
          booked: busyMs.some((b) => overlaps(sMs, eMs, b.start, b.end)),
        });
      }
    }

    if (slots.length) {
      days.push({
        date: dateStr,
        label: day.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }),
        slots,
      });
    }
  }
  return days;
}

/** Server-side guard: is `startLocal` a real, currently-free slot? */
export function isValidFreeSlot(
  startLocal: string,
  busy: BusyInterval[],
  now: Date = new Date(),
): boolean {
  for (const day of generateSlots(busy, now)) {
    const s = day.slots.find((x) => x.startLocal === startLocal);
    if (s) return !s.booked;
  }
  return false;
}
