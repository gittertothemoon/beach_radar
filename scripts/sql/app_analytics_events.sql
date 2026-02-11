-- Server-side anonymous analytics events
create extension if not exists pgcrypto;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_name text not null,
  session_id text not null,
  path text not null,
  beach_id text,
  src text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  props jsonb,
  event_id uuid,
  user_id uuid references auth.users(id) on delete set null
);

create unique index if not exists analytics_events_event_id_uidx
  on public.analytics_events(event_id);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events(created_at desc);

create index if not exists analytics_events_event_name_created_at_idx
  on public.analytics_events(event_name, created_at desc);

create index if not exists analytics_events_session_created_at_idx
  on public.analytics_events(session_id, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_service_role_insert" on public.analytics_events;
create policy "analytics_events_service_role_insert"
  on public.analytics_events
  for insert
  to service_role
  with check (true);

drop policy if exists "analytics_events_service_role_select" on public.analytics_events;
create policy "analytics_events_service_role_select"
  on public.analytics_events
  for select
  to service_role
  using (true);
