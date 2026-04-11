-- source: scripts/sql/14_gamification.sql
-- synced_at: 2026-04-11T18:53:09.889Z

-- Gamification: weekly mission claims tracking.

create table if not exists public.user_mission_claims (
  user_id        uuid        not null references auth.users(id) on delete cascade,
  period_start   timestamptz not null,
  points_awarded integer     not null default 0 check (points_awarded >= 0),
  created_at     timestamptz not null default now(),
  primary key (user_id, period_start)
);

create index if not exists user_mission_claims_user_idx
  on public.user_mission_claims(user_id, period_start desc);

-- Atomically claim the weekly mission reward.
-- Returns { ok: true } or { ok: false, error: "already_claimed" | "invalid_points" }.
create or replace function public.claim_weekly_mission_reward(
  p_user_id      uuid,
  p_period_start timestamptz,
  p_points       integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_points <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_points');
  end if;

  -- Idempotency guard
  if exists (
    select 1 from public.user_mission_claims
    where user_id = p_user_id and period_start = p_period_start
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  -- Ensure balance row
  insert into public.user_points_balances (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

  -- Record claim
  insert into public.user_mission_claims (user_id, period_start, points_awarded)
    values (p_user_id, p_period_start, p_points);

  -- Ledger entry (manual_adjustment covers bonus awards)
  insert into public.points_ledger (user_id, points_delta, reason)
    values (p_user_id, p_points, 'manual_adjustment');

  -- Update balance
  update public.user_points_balances
    set points_balance = points_balance + p_points,
        points_earned  = points_earned + p_points,
        updated_at     = now()
    where user_id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;
