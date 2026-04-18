-- source: scripts/sql/16_streak_and_push_tokens.sql
-- synced_at: 2026-04-18T00:26:53.905Z

-- Feature: daily streak computation + push notification token storage

-- ── Streak function ────────────────────────────────────────────────────────
-- Returns (current_streak, longest_streak) for a user based on consecutive days
-- where they claimed the daily mission. "Current" counts if the streak ends today
-- OR yesterday (so the user isn't penalized before claiming today's mission).
create or replace function public.get_user_daily_streak(p_user_id uuid)
returns table(current_streak integer, longest_streak integer)
language sql
stable
set search_path = public
as $$
  with days as (
    select distinct period_start::date as d
    from public.user_daily_mission_claims
    where user_id = p_user_id
  ),
  gaps as (
    select d,
           coalesce(d - lag(d) over (order by d), 1) as gap
    from days
  ),
  islands as (
    select d,
           sum(case when gap > 1 then 1 else 0 end) over (order by d) as iid
    from gaps
  ),
  island_stats as (
    select min(d) as start_d,
           max(d) as end_d,
           count(*)::int as len
    from islands
    group by iid
  )
  select
    coalesce((
      select len from island_stats
      where end_d >= current_date - 1
      order by end_d desc
      limit 1
    ), 0)::int as current_streak,
    coalesce(max(len), 0)::int as longest_streak
  from island_stats
$$;

-- ── Push notification tokens ───────────────────────────────────────────────
create table if not exists public.user_push_tokens (
  id          bigserial     primary key,
  user_id     uuid          not null references auth.users(id) on delete cascade,
  token       text          not null,
  platform    text          not null check (platform in ('ios', 'android', 'unknown')),
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),
  unique (user_id, token)
);

create index if not exists user_push_tokens_user_idx
  on public.user_push_tokens(user_id);

-- Row-level security: users can only manage their own tokens
alter table public.user_push_tokens enable row level security;

create policy "Service role manages push tokens"
  on public.user_push_tokens
  as permissive for all
  to service_role
  using (true)
  with check (true);
