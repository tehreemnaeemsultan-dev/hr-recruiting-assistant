-- HR Recruiting Assistant — initial schema (Phase 0)
--
-- Single-user internal tool. RLS is enabled on every table and access is granted
-- ONLY to the `authenticated` role. Because there is exactly one account (the
-- owner) and public sign-ups are disabled in Supabase Auth, "authenticated"
-- effectively means "the owner". The `anon` role gets no policies (no access),
-- and the service_role key (server-only) bypasses RLS for admin tasks.
--
-- Safe to run more than once (idempotent).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type application_stage as enum
    ('new', 'screening', 'interview_1', 'interview_2', 'hired', 'rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------
create table if not exists jobs (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  jd_text       text not null default '',
  criteria_text text not null default '',
  status        text not null default 'open' check (status in ('open', 'closed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists jobs_set_updated_at on jobs;
create trigger jobs_set_updated_at before update on jobs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- candidates
-- ---------------------------------------------------------------------------
create table if not exists candidates (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  email        text,
  phone        text,
  source       text not null check (source in ('upload', 'linkedin')),
  linkedin_url text,
  resume_path  text,
  parsed       jsonb not null default '{}'::jsonb,
  raw_text     text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- applications (links a candidate to a job)
-- ---------------------------------------------------------------------------
create table if not exists applications (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references jobs(id) on delete cascade,
  candidate_id    uuid not null references candidates(id) on delete cascade,
  stage           application_stage not null default 'new',
  score           int check (score between 0 and 100),
  score_breakdown jsonb,
  score_summary   text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (job_id, candidate_id)
);

create index if not exists applications_job_id_idx on applications(job_id);
create index if not exists applications_candidate_id_idx on applications(candidate_id);
create index if not exists applications_stage_idx on applications(stage);

drop trigger if exists applications_set_updated_at on applications;
create trigger applications_set_updated_at before update on applications
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- events (audit + timing log; powers analytics in Phase 6)
-- ---------------------------------------------------------------------------
create table if not exists events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  type           text not null,
  from_stage     application_stage,
  to_stage       application_stage,
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists events_application_id_idx on events(application_id);
create index if not exists events_type_idx on events(type);

-- ---------------------------------------------------------------------------
-- emails
-- ---------------------------------------------------------------------------
create table if not exists emails (
  id                  uuid primary key default gen_random_uuid(),
  application_id      uuid not null references applications(id) on delete cascade,
  to_address          text not null,
  subject             text not null,
  body                text not null,
  provider            text not null default 'zoho' check (provider in ('zoho')),
  status              text not null check (status in ('sent', 'failed')),
  provider_message_id text,
  created_at          timestamptz not null default now()
);

create index if not exists emails_application_id_idx on emails(application_id);

-- ---------------------------------------------------------------------------
-- interviews
-- ---------------------------------------------------------------------------
create table if not exists interviews (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications(id) on delete cascade,
  google_event_id text,
  meet_url        text,
  scheduled_start timestamptz,
  scheduled_end   timestamptz,
  status          text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at      timestamptz not null default now()
);

create index if not exists interviews_application_id_idx on interviews(application_id);

-- ---------------------------------------------------------------------------
-- integration_tokens (one row per connected provider; tokens stored encrypted)
-- ---------------------------------------------------------------------------
create table if not exists integration_tokens (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null unique check (provider in ('zoho', 'google')),
  access_token_enc  text,
  refresh_token_enc text,
  scope             text,
  expires_at        timestamptz,
  account_id        text,
  updated_at        timestamptz not null default now()
);

drop trigger if exists integration_tokens_set_updated_at on integration_tokens;
create trigger integration_tokens_set_updated_at before update on integration_tokens
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security: enable everywhere, grant full access to the owner only.
-- ---------------------------------------------------------------------------
alter table jobs               enable row level security;
alter table candidates         enable row level security;
alter table applications       enable row level security;
alter table events             enable row level security;
alter table emails             enable row level security;
alter table interviews         enable row level security;
alter table integration_tokens enable row level security;

drop policy if exists owner_all on jobs;
drop policy if exists owner_all on candidates;
drop policy if exists owner_all on applications;
drop policy if exists owner_all on events;
drop policy if exists owner_all on emails;
drop policy if exists owner_all on interviews;
drop policy if exists owner_all on integration_tokens;

create policy owner_all on jobs               for all to authenticated using (true) with check (true);
create policy owner_all on candidates         for all to authenticated using (true) with check (true);
create policy owner_all on applications       for all to authenticated using (true) with check (true);
create policy owner_all on events             for all to authenticated using (true) with check (true);
create policy owner_all on emails             for all to authenticated using (true) with check (true);
create policy owner_all on interviews         for all to authenticated using (true) with check (true);
create policy owner_all on integration_tokens for all to authenticated using (true) with check (true);
