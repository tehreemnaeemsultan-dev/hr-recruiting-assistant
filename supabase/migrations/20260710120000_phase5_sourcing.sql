-- Phase 5: LinkedIn sourcing via Apify (cookieless actors only).
-- Staging tables for search runs and sourced profiles that require owner review
-- before entering a job's pipeline (SPEC §8.1). Idempotent. RLS: owner only.

create table if not exists sourcing_runs (
  id               uuid primary key default gen_random_uuid(),
  apify_run_id     text,
  apify_dataset_id text,
  actor            text not null,
  query            jsonb not null default '{}'::jsonb,
  status           text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  result_count     int not null default 0,
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists sourcing_runs_set_updated_at on sourcing_runs;
create trigger sourcing_runs_set_updated_at before update on sourcing_runs
  for each row execute function set_updated_at();

create table if not exists sourced_profiles (
  id              uuid primary key default gen_random_uuid(),
  sourcing_run_id uuid not null references sourcing_runs(id) on delete cascade,
  full_name       text not null,
  headline        text,
  location        text,
  linkedin_url    text,
  about           text,
  raw_text        text,
  parsed          jsonb not null default '{}'::jsonb,
  status          text not null default 'new' check (status in ('new', 'imported', 'dismissed')),
  candidate_id    uuid references candidates(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists sourced_profiles_run_idx on sourced_profiles(sourcing_run_id);
create index if not exists sourced_profiles_status_idx on sourced_profiles(status);

alter table sourcing_runs    enable row level security;
alter table sourced_profiles enable row level security;

drop policy if exists owner_all on sourcing_runs;
drop policy if exists owner_all on sourced_profiles;
create policy owner_all on sourcing_runs    for all to authenticated using (true) with check (true);
create policy owner_all on sourced_profiles for all to authenticated using (true) with check (true);
