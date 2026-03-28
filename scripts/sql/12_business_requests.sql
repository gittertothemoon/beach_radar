-- Business partnership requests captured from landing/app account CTA.

create extension if not exists pgcrypto;

create table if not exists public.business_requests (
  id uuid primary key default gen_random_uuid(),
  business_type text not null,
  company_name text not null,
  company_name_norm text not null,
  contact_name text not null,
  role text not null,
  email text not null,
  email_norm text not null,
  phone text null,
  city text not null,
  message text null,
  lang text not null default 'it',
  utm jsonb not null default '{}'::jsonb,
  attribution jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  source_ip text null,
  user_agent text null,
  honeypot text null,
  status text not null default 'new',
  notified boolean not null default false,
  notification_error text null,
  count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_requests_email_company_idx
  on public.business_requests (email_norm, company_name_norm, first_seen_at desc);

create index if not exists business_requests_created_idx
  on public.business_requests (created_at desc);

alter table public.business_requests
  drop constraint if exists business_requests_source_ip_hash_chk,
  drop constraint if exists business_requests_user_agent_hash_chk;

alter table public.business_requests
  add constraint business_requests_source_ip_hash_chk
    check (source_ip is null or source_ip ~ '^sha256:[a-f0-9]{64}$'),
  add constraint business_requests_user_agent_hash_chk
    check (user_agent is null or user_agent ~ '^sha256:[a-f0-9]{64}$');

