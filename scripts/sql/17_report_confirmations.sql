-- Feature: report confirmations — users can confirm/validate active beach reports.

-- Add confirmation_count to beach_reports
alter table public.beach_reports
  add column if not exists confirmation_count integer not null default 0 check (confirmation_count >= 0);

-- Table to track which user confirmed which report (unique per user/report pair)
create table if not exists public.report_confirmations (
  id          bigserial   primary key,
  report_id   uuid        not null references public.beach_reports(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (report_id, user_id)
);

create index if not exists report_confirmations_report_idx
  on public.report_confirmations(report_id);

create index if not exists report_confirmations_user_idx
  on public.report_confirmations(user_id, created_at desc);

-- Row-level security
alter table public.report_confirmations enable row level security;

create policy "Service role manages confirmations"
  on public.report_confirmations
  as permissive for all
  to service_role
  using (true)
  with check (true);

-- Atomically confirm a report:
-- 1. Inserts a confirmation record (fails if already confirmed by this user)
-- 2. Increments confirmation_count on the report
-- 3. Extends expires_at by 15 minutes
-- 4. Awards 2 points to the original reporter and 1 point to the confirmer
create or replace function public.confirm_beach_report(
  p_confirmer_id uuid,
  p_report_id    uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter_id uuid;
  v_expires_at  timestamptz;
begin
  -- Look up the report (must be active / not expired)
  select user_id, expires_at
    into v_reporter_id, v_expires_at
    from public.beach_reports
    where id = p_report_id
      and expires_at > now();

  if v_reporter_id is null then
    return jsonb_build_object('ok', false, 'error', 'report_not_found');
  end if;

  if v_reporter_id = p_confirmer_id then
    return jsonb_build_object('ok', false, 'error', 'cannot_confirm_own_report');
  end if;

  -- Guard duplicate (unique constraint will also catch this, but we return a clean error)
  if exists (
    select 1 from public.report_confirmations
    where report_id = p_report_id and user_id = p_confirmer_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_confirmed');
  end if;

  -- Record confirmation
  insert into public.report_confirmations (report_id, user_id)
    values (p_report_id, p_confirmer_id);

  -- Increment confirmation_count and extend TTL by 15 min
  update public.beach_reports
    set confirmation_count = confirmation_count + 1,
        expires_at = greatest(expires_at, now()) + interval '15 minutes'
    where id = p_report_id;

  -- Ensure balance rows exist
  insert into public.user_points_balances (user_id)
    values (v_reporter_id), (p_confirmer_id)
    on conflict (user_id) do nothing;

  -- Award 2 points to reporter (only if confirmer is different user)
  if v_reporter_id != p_confirmer_id then
    insert into public.points_ledger (user_id, points_delta, reason)
      values (v_reporter_id, 2, 'report_confirmed');

    update public.user_points_balances
      set points_balance = points_balance + 2,
          points_earned  = points_earned + 2,
          updated_at     = now()
      where user_id = v_reporter_id;
  end if;

  -- Award 1 point to confirmer
  insert into public.points_ledger (user_id, points_delta, reason)
    values (p_confirmer_id, 1, 'report_confirmation');

  update public.user_points_balances
    set points_balance = points_balance + 1,
        points_earned  = points_earned + 1,
        updated_at     = now()
    where user_id = p_confirmer_id;

  return jsonb_build_object('ok', true);
end;
$$;
