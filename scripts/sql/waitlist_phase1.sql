-- Phase 1 waitlist schema upgrades
alter table public.waitlist_signups
  add column if not exists status text not null default 'pending',
  add column if not exists count int not null default 1,
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists source_quality text,
  add column if not exists honeypot text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirm_token_hash text;

create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups(created_at);

create index if not exists waitlist_signups_source_quality_idx
  on public.waitlist_signups(source_quality);
