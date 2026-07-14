-- Phase 7: candidate self-scheduling.
-- A recruiter sends a booking link; the candidate picks an open slot on a public
-- page, which then creates the Google Calendar/Meet event. Pending interviews
-- (link sent, not yet booked) have a token and no time yet. Idempotent.

alter table interviews drop constraint if exists interviews_status_check;
alter table interviews
  add constraint interviews_status_check
  check (status in ('pending', 'scheduled', 'cancelled'));

alter table interviews add column if not exists booking_token    text;
alter table interviews add column if not exists token_expires_at timestamptz;
alter table interviews add column if not exists duration_min      int not null default 30;

-- Public booking page looks interviews up by this token (via the service role).
create unique index if not exists interviews_booking_token_key
  on interviews(booking_token) where booking_token is not null;
