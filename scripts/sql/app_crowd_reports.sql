-- Shared crowd reports (app)
create table if not exists public.beach_reports (
  id uuid primary key default gen_random_uuid(),
  beach_id text not null,
  crowd_level smallint not null check (crowd_level between 1 and 4),
  reporter_hash text not null,
  attribution jsonb,
  source_ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists beach_reports_created_at_idx
  on public.beach_reports(created_at desc);

create index if not exists beach_reports_beach_created_at_idx
  on public.beach_reports(beach_id, created_at desc);

create index if not exists beach_reports_reporter_beach_created_at_idx
  on public.beach_reports(reporter_hash, beach_id, created_at desc);
