-- source: scripts/sql/07_signup_anonymize_legacy.sql
-- synced_at: 2026-03-22T16:57:57.244Z

-- Anonymize legacy signup network metadata and enforce hashed-only storage.

create extension if not exists pgcrypto;

update public.waitlist_signups
set source_ip = 'sha256:' || encode(digest(source_ip, 'sha256'), 'hex')
where source_ip is not null
  and source_ip !~ '^sha256:[a-f0-9]{64}$';

update public.waitlist_signups
set user_agent = 'sha256:' || encode(digest(user_agent, 'sha256'), 'hex')
where user_agent is not null
  and user_agent !~ '^sha256:[a-f0-9]{64}$';

alter table public.waitlist_signups
  drop constraint if exists waitlist_signups_source_ip_hash_chk,
  drop constraint if exists waitlist_signups_user_agent_hash_chk;

alter table public.waitlist_signups
  add constraint waitlist_signups_source_ip_hash_chk
    check (source_ip is null or source_ip ~ '^sha256:[a-f0-9]{64}$'),
  add constraint waitlist_signups_user_agent_hash_chk
    check (user_agent is null or user_agent ~ '^sha256:[a-f0-9]{64}$');
