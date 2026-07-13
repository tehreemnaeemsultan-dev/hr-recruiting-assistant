-- Phase 6: inbound email (candidate replies).
-- Extends `emails` to hold received messages alongside sent ones, so the Emails
-- tab can show Sent and Received. Replies are matched to an application by the
-- RFC In-Reply-To header (pointing at a sent Message-ID), falling back to the
-- sender address. Idempotent.

-- Direction of the message. Existing rows are all outbound.
alter table emails
  add column if not exists direction   text not null default 'outbound'
    check (direction in ('outbound', 'inbound'));

-- Threading / provenance fields (populated for inbound; message_id also stored
-- for new outbound sends so replies can be threaded back to them).
alter table emails add column if not exists from_address text;
alter table emails add column if not exists message_id   text; -- RFC Message-ID of this email
alter table emails add column if not exists in_reply_to  text; -- RFC In-Reply-To (inbound)
alter table emails add column if not exists received_at  timestamptz;

-- Inbound messages use status 'received'.
alter table emails drop constraint if exists emails_status_check;
alter table emails
  add constraint emails_status_check check (status in ('sent', 'failed', 'received'));

-- Email is sent via Zoho again (owner reverted from Gmail on 2026-07-13).
alter table emails alter column provider set default 'zoho';

-- Dedup inbound fetches: a Message-ID is globally unique, so never store one twice.
create unique index if not exists emails_message_id_key
  on emails(message_id) where message_id is not null;

create index if not exists emails_direction_idx on emails(direction);

-- Single-row bookkeeping for the last successful inbox sync (single-user tool).
create table if not exists email_sync_state (
  id             int primary key default 1,
  last_synced_at timestamptz,
  last_error     text,
  constraint email_sync_state_singleton check (id = 1)
);

alter table email_sync_state enable row level security;
drop policy if exists owner_all on email_sync_state;
create policy owner_all on email_sync_state
  for all to authenticated using (true) with check (true);
