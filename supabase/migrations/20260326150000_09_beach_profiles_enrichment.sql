-- source: scripts/sql/09_beach_profiles_enrichment.sql
-- Beach profile enrichment pipeline (V1)
create extension if not exists pgcrypto;

create table if not exists public.beach_profile_current (
  beach_id text primary key,
  hours text,
  services text[] not null default '{}'::text[],
  phone text,
  website text,
  price_band text,
  confidence numeric(4,3) not null default 0,
  status text not null default 'published',
  source_primary_url text,
  source_secondary_url text,
  sources jsonb not null default '[]'::jsonb,
  field_scores jsonb not null default '{}'::jsonb,
  review_round integer not null default 1,
  verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beach_profile_current_confidence_chk check (confidence >= 0 and confidence <= 1),
  constraint beach_profile_current_status_chk check (status in ('published', 'needs_review', 'stale')),
  constraint beach_profile_current_price_band_chk check (price_band is null or price_band in ('low', 'mid', 'high', 'premium', 'unknown'))
);

create index if not exists beach_profile_current_verified_at_idx
  on public.beach_profile_current(verified_at desc);

create table if not exists public.beach_enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null default 'cron',
  status text not null default 'running',
  run_day_rome date not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  batch_size integer not null default 0,
  processed_count integer not null default 0,
  published_count integer not null default 0,
  queued_count integer not null default 0,
  failed_count integer not null default 0,
  notes jsonb not null default '{}'::jsonb,
  constraint beach_enrichment_runs_status_chk check (status in ('running', 'completed', 'failed')),
  constraint beach_enrichment_runs_counts_chk check (
    batch_size >= 0 and
    processed_count >= 0 and
    published_count >= 0 and
    queued_count >= 0 and
    failed_count >= 0
  )
);

create index if not exists beach_enrichment_runs_day_idx
  on public.beach_enrichment_runs(run_day_rome, started_at desc);

create table if not exists public.beach_profile_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.beach_enrichment_runs(id) on delete set null,
  beach_id text not null,
  candidate_payload jsonb not null,
  field_evidence jsonb not null default '[]'::jsonb,
  review_decision text not null,
  conflict_flags jsonb not null default '[]'::jsonb,
  field_scores jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) not null default 0,
  review_round integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beach_profile_candidates_decision_chk check (
    review_decision in ('verified', 'rejected', 'conflict', 'needs_review')
  ),
  constraint beach_profile_candidates_confidence_chk check (confidence >= 0 and confidence <= 1),
  constraint beach_profile_candidates_round_chk check (review_round >= 1)
);

create index if not exists beach_profile_candidates_beach_idx
  on public.beach_profile_candidates(beach_id, created_at desc);

create index if not exists beach_profile_candidates_run_idx
  on public.beach_profile_candidates(run_id, created_at desc);

create table if not exists public.beach_profile_review_queue (
  id uuid primary key default gen_random_uuid(),
  beach_id text not null,
  candidate_id uuid references public.beach_profile_candidates(id) on delete set null,
  reason text not null,
  priority_score numeric(8,3) not null default 0,
  conflict_flags jsonb not null default '[]'::jsonb,
  attempts integer not null default 1,
  last_attempt_at timestamptz,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beach_profile_review_queue_status_chk check (status in ('pending', 'in_review', 'resolved')),
  constraint beach_profile_review_queue_attempts_chk check (attempts >= 1)
);

create unique index if not exists beach_profile_review_queue_beach_uidx
  on public.beach_profile_review_queue(beach_id);

create index if not exists beach_profile_review_queue_priority_idx
  on public.beach_profile_review_queue(status, priority_score desc, updated_at asc);

alter table public.beach_profile_current enable row level security;
alter table public.beach_enrichment_runs enable row level security;
alter table public.beach_profile_candidates enable row level security;
alter table public.beach_profile_review_queue enable row level security;

drop policy if exists "beach_profile_current_public_read" on public.beach_profile_current;
create policy "beach_profile_current_public_read"
  on public.beach_profile_current
  for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "beach_profile_current_service_all" on public.beach_profile_current;
create policy "beach_profile_current_service_all"
  on public.beach_profile_current
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "beach_enrichment_runs_service_all" on public.beach_enrichment_runs;
create policy "beach_enrichment_runs_service_all"
  on public.beach_enrichment_runs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "beach_profile_candidates_service_all" on public.beach_profile_candidates;
create policy "beach_profile_candidates_service_all"
  on public.beach_profile_candidates
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "beach_profile_review_queue_service_all" on public.beach_profile_review_queue;
create policy "beach_profile_review_queue_service_all"
  on public.beach_profile_review_queue
  for all
  to service_role
  using (true)
  with check (true);
