-- Phase 3: email is now sent via Google (Gmail), an owner-approved change from
-- the SPEC's Zoho. Allow emails.provider = 'google' (keep 'zoho' for history).
-- Idempotent.

alter table emails drop constraint if exists emails_provider_check;
alter table emails
  add constraint emails_provider_check check (provider in ('zoho', 'google'));

alter table emails alter column provider set default 'google';
