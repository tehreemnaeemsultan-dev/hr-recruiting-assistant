import { CalendarCheck, CalendarX, Clock } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSlots, type BusyInterval } from "@/lib/availability";
import { BookingCalendar } from "@/components/booking-calendar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book your interview" };

interface PageRow {
  id: string;
  status: string;
  token_expires_at: string | null;
  scheduled_start: string | null;
  meet_url: string | null;
  applications: {
    jobs: { title: string } | null;
    candidates: { full_name: string } | null;
  } | null;
}

function firstName(full?: string | null): string {
  return (full ?? "").trim().split(/\s+/)[0] || "there";
}

// Kept out of the component body so React Compiler doesn't flag Date.now().
function isExpired(iso: string | null): boolean {
  return iso ? new Date(iso).getTime() < Date.now() : false;
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-surface-sunken flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">{children}</div>
    </main>
  );
}

function Notice({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center px-6 py-14 text-center">
      <span className="bg-brand-muted text-brand mb-4 flex size-14 items-center justify-center rounded-2xl">
        {icon}
      </span>
      <h1 className="text-lg font-semibold">{title}</h1>
      {children ? (
        <div className="text-text-secondary mt-2 max-w-sm text-sm">{children}</div>
      ) : null}
    </div>
  );
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("interviews")
    .select(
      "id, status, token_expires_at, scheduled_start, meet_url, applications(jobs(title), candidates(full_name))",
    )
    .eq("booking_token", token)
    .maybeSingle();
  const iv = data as unknown as PageRow | null;

  if (!iv) {
    return (
      <Shell>
        <Notice icon={<CalendarX className="size-7" />} title="Link not found">
          This booking link isn&apos;t valid. Please use the most recent link we
          emailed you, or reply to that email for help.
        </Notice>
      </Shell>
    );
  }

  const name = firstName(iv.applications?.candidates?.full_name);
  const jobTitle = iv.applications?.jobs?.title ?? "the role";

  if (iv.status === "scheduled" && iv.scheduled_start) {
    return (
      <Shell>
        <Notice
          icon={<CalendarCheck className="size-7" />}
          title="You're booked in 🎉"
        >
          <p>
            Your interview for <strong>{jobTitle}</strong> is confirmed for{" "}
            <strong>{fmtWhen(iv.scheduled_start)}</strong> (Pakistan time).
          </p>
          {iv.meet_url ? (
            <p className="mt-3">
              <a
                href={iv.meet_url}
                className="text-brand font-medium hover:underline"
              >
                Join Google Meet link
              </a>
            </p>
          ) : null}
          <p className="mt-3">A confirmation email is on its way.</p>
        </Notice>
      </Shell>
    );
  }

  if (iv.status === "cancelled") {
    return (
      <Shell>
        <Notice icon={<CalendarX className="size-7" />} title="Interview cancelled">
          This interview has been cancelled. Please reach out to us if you have
          any questions.
        </Notice>
      </Shell>
    );
  }

  // pending — check expiry
  if (isExpired(iv.token_expires_at)) {
    return (
      <Shell>
        <Notice icon={<Clock className="size-7" />} title="This link has expired">
          Please reply to our email and we&apos;ll send you a fresh booking link.
        </Notice>
      </Shell>
    );
  }

  // Build open slots (exclude already-scheduled interviews).
  const { data: booked } = await admin
    .from("interviews")
    .select("scheduled_start, scheduled_end")
    .eq("status", "scheduled")
    .not("scheduled_start", "is", null);
  const busy: BusyInterval[] = (booked ?? []).map((b) => ({
    start: b.scheduled_start,
    end: b.scheduled_end,
  }));
  const days = generateSlots(busy).map((d) => ({
    ...d,
    slots: d.slots.filter((s) => !s.booked),
  }));

  return (
    <Shell>
      <div className="mb-6 text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Book your interview
        </h1>
        <p className="text-text-secondary mt-1 text-sm">
          Hi {name} — pick a time that works for your{" "}
          <strong>{jobTitle}</strong> interview. All times are Pakistan time
          (PKT), 30 minutes long.
        </p>
      </div>
      <BookingCalendar token={token} days={days} />
    </Shell>
  );
}
