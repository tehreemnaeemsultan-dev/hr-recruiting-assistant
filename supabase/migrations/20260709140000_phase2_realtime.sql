-- Phase 2: enable Supabase Realtime for the pipeline board so it updates live.
-- The board also works without this (optimistic local updates on your own drags);
-- this adds live sync across tabs/sessions and for automated stage changes (Phases 3-4).
-- Idempotent.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'applications'
  ) then
    alter publication supabase_realtime add table applications;
  end if;
end $$;
