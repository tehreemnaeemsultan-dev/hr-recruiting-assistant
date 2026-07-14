-- Phase 8: app settings (single-row). Holds the owner's Google Appointment
-- Schedule link used for candidate self-scheduling (Option A). Idempotent.

create table if not exists app_settings (
  id          int primary key default 1,
  booking_url text,
  updated_at  timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

alter table app_settings enable row level security;
drop policy if exists owner_all on app_settings;
create policy owner_all on app_settings
  for all to authenticated using (true) with check (true);
