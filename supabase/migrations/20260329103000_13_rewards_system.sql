-- source: scripts/sql/13_rewards_system.sql

-- Rewards system: points per completed report, badge redemption, and coupon-ready schema.

create extension if not exists pgcrypto;

alter table public.beach_reports
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists beach_reports_user_created_at_idx
  on public.beach_reports(user_id, created_at desc);

create table if not exists public.user_points_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  points_earned integer not null default 0 check (points_earned >= 0),
  points_spent integer not null default 0 check (points_spent >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  points_delta integer not null check (points_delta <> 0),
  reason text not null check (
    reason in (
      'report_completed',
      'badge_redeem',
      'coupon_redeem',
      'report_quality_reversal',
      'manual_adjustment'
    )
  ),
  report_id uuid null references public.beach_reports(id) on delete set null,
  badge_code text null,
  coupon_code text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.points_ledger
  drop constraint if exists points_ledger_report_reason_unique;

alter table public.points_ledger
  add constraint points_ledger_report_reason_unique unique (report_id, reason);

create index if not exists points_ledger_user_created_at_idx
  on public.points_ledger(user_id, created_at desc);

create index if not exists points_ledger_reason_created_at_idx
  on public.points_ledger(reason, created_at desc);

create table if not exists public.badge_catalog (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null,
  points_cost integer not null check (points_cost > 0),
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.badge_catalog (code, name, description, icon, points_cost, active, sort_order)
values
  ('occhio_del_mare', 'Occhio del Mare', 'Segnalatore attento delle condizioni reali.', 'eye', 120, true, 1),
  ('sentinella_costiera', 'Sentinella Costiera', 'Presenza costante a supporto della community.', 'shield', 120, true, 2),
  ('cacciatore_di_onda', 'Cacciatore di Onda', 'Contribuisce con segnalazioni tempestive.', 'wave', 120, true, 3),
  ('guardiano_della_spiaggia', 'Guardiano della Spiaggia', 'Aiuta a mantenere la mappa affidabile.', 'beach', 120, true, 4),
  ('faro_della_community', 'Faro della Community', 'Punto di riferimento per altri utenti.', 'lighthouse', 120, true, 5),
  ('leggenda_estiva', 'Leggenda Estiva', 'Badge iconico per i contributor piu attivi.', 'sun', 120, true, 6)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  points_cost = excluded.points_cost,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_code text not null references public.badge_catalog(code) on delete restrict,
  redeemed_points integer not null check (redeemed_points > 0),
  ledger_id uuid not null references public.points_ledger(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (user_id, badge_code),
  unique (ledger_id)
);

create index if not exists user_badges_user_created_at_idx
  on public.user_badges(user_id, created_at desc);

-- Future-ready coupon catalog (no redemption flow enabled yet).
create table if not exists public.coupon_catalog (
  code text primary key,
  name text not null,
  description text not null,
  partner_name text null,
  reward_kind text not null check (reward_kind in ('discount', 'free_item')),
  points_cost integer not null check (points_cost > 0),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  coupon_code text not null references public.coupon_catalog(code) on delete restrict,
  redeemed_points integer not null check (redeemed_points > 0),
  ledger_id uuid not null references public.points_ledger(id) on delete restrict,
  status text not null default 'issued' check (status in ('issued', 'used', 'expired', 'cancelled')),
  used_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ledger_id)
);

create index if not exists user_coupons_user_created_at_idx
  on public.user_coupons(user_id, created_at desc);

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_points_balances_set_updated_at on public.user_points_balances;
create trigger user_points_balances_set_updated_at
before update on public.user_points_balances
for each row execute function public.set_row_updated_at();

drop trigger if exists badge_catalog_set_updated_at on public.badge_catalog;
create trigger badge_catalog_set_updated_at
before update on public.badge_catalog
for each row execute function public.set_row_updated_at();

drop trigger if exists coupon_catalog_set_updated_at on public.coupon_catalog;
create trigger coupon_catalog_set_updated_at
before update on public.coupon_catalog
for each row execute function public.set_row_updated_at();

drop trigger if exists user_coupons_set_updated_at on public.user_coupons;
create trigger user_coupons_set_updated_at
before update on public.user_coupons
for each row execute function public.set_row_updated_at();

create or replace function public.get_report_points_reward()
returns integer
language plpgsql
stable
as $$
begin
  return 15;
end;
$$;

create or replace function public.ensure_points_balance_row(target_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_points_balances (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;
$$;

create or replace function public.apply_report_points_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_points integer;
  inserted_ledger_id uuid;
begin
  if new.user_id is null then
    return new;
  end if;

  reward_points := public.get_report_points_reward();
  perform public.ensure_points_balance_row(new.user_id);

  insert into public.points_ledger (user_id, points_delta, reason, report_id, meta)
  values (
    new.user_id,
    reward_points,
    'report_completed',
    new.id,
    jsonb_build_object('quality_status', 'pending_review')
  )
  on conflict (report_id, reason) do nothing
  returning id into inserted_ledger_id;

  if inserted_ledger_id is not null then
    update public.user_points_balances
    set
      points_balance = points_balance + reward_points,
      points_earned = points_earned + reward_points,
      updated_at = now()
    where user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists beach_reports_points_reward_trg on public.beach_reports;
create trigger beach_reports_points_reward_trg
after insert on public.beach_reports
for each row
execute function public.apply_report_points_reward();

create or replace function public.redeem_badge_points(p_user_id uuid, p_badge_code text)
returns table (
  ok boolean,
  error text,
  points_balance integer,
  points_earned integer,
  points_spent integer,
  badge_code text,
  badge_name text,
  redeemed_points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_badge public.badge_catalog%rowtype;
  updated_balance public.user_points_balances%rowtype;
  inserted_ledger_id uuid;
begin
  if p_user_id is null then
    return query
    select false, 'missing_user', null::integer, null::integer, null::integer, null::text, null::text, null::integer;
    return;
  end if;

  if p_badge_code is null or btrim(p_badge_code) = '' then
    return query
    select false, 'invalid_badge_code', null::integer, null::integer, null::integer, null::text, null::text, null::integer;
    return;
  end if;

  select *
  into selected_badge
  from public.badge_catalog
  where code = btrim(p_badge_code)
    and active = true
  limit 1;

  if not found then
    return query
    select false, 'badge_not_found', null::integer, null::integer, null::integer, null::text, null::text, null::integer;
    return;
  end if;

  perform public.ensure_points_balance_row(p_user_id);

  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || selected_badge.code));

  if exists (
    select 1
    from public.user_badges
    where user_id = p_user_id
      and badge_code = selected_badge.code
  ) then
    select *
    into updated_balance
    from public.user_points_balances
    where user_id = p_user_id;

    return query
    select
      false,
      'badge_already_owned',
      updated_balance.points_balance,
      updated_balance.points_earned,
      updated_balance.points_spent,
      selected_badge.code,
      selected_badge.name,
      selected_badge.points_cost;
    return;
  end if;

  select *
  into updated_balance
  from public.user_points_balances
  where user_id = p_user_id
  for update;

  if updated_balance.points_balance < selected_badge.points_cost then
    return query
    select
      false,
      'insufficient_points',
      updated_balance.points_balance,
      updated_balance.points_earned,
      updated_balance.points_spent,
      selected_badge.code,
      selected_badge.name,
      selected_badge.points_cost;
    return;
  end if;

  insert into public.points_ledger (
    user_id,
    points_delta,
    reason,
    badge_code,
    meta
  )
  values (
    p_user_id,
    -selected_badge.points_cost,
    'badge_redeem',
    selected_badge.code,
    jsonb_build_object('badge_code', selected_badge.code)
  )
  returning id into inserted_ledger_id;

  update public.user_points_balances
  set
    points_balance = points_balance - selected_badge.points_cost,
    points_spent = points_spent + selected_badge.points_cost,
    updated_at = now()
  where user_id = p_user_id
  returning * into updated_balance;

  insert into public.user_badges (
    user_id,
    badge_code,
    redeemed_points,
    ledger_id
  )
  values (
    p_user_id,
    selected_badge.code,
    selected_badge.points_cost,
    inserted_ledger_id
  );

  return query
  select
    true,
    null::text,
    updated_balance.points_balance,
    updated_balance.points_earned,
    updated_balance.points_spent,
    selected_badge.code,
    selected_badge.name,
    selected_badge.points_cost;
end;
$$;

revoke all on function public.ensure_points_balance_row(uuid) from public, anon, authenticated;
grant execute on function public.ensure_points_balance_row(uuid) to service_role;

revoke all on function public.redeem_badge_points(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_badge_points(uuid, text) to service_role;

alter table public.user_points_balances enable row level security;
alter table public.points_ledger enable row level security;
alter table public.badge_catalog enable row level security;
alter table public.user_badges enable row level security;
alter table public.coupon_catalog enable row level security;
alter table public.user_coupons enable row level security;

drop policy if exists "user_points_balances_select_own" on public.user_points_balances;
create policy "user_points_balances_select_own"
  on public.user_points_balances
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "points_ledger_select_own" on public.points_ledger;
create policy "points_ledger_select_own"
  on public.points_ledger
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "badge_catalog_select_all" on public.badge_catalog;
create policy "badge_catalog_select_all"
  on public.badge_catalog
  for select
  to anon, authenticated
  using (true);

drop policy if exists "user_badges_select_own" on public.user_badges;
create policy "user_badges_select_own"
  on public.user_badges
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "coupon_catalog_select_all" on public.coupon_catalog;
create policy "coupon_catalog_select_all"
  on public.coupon_catalog
  for select
  to anon, authenticated
  using (true);

drop policy if exists "user_coupons_select_own" on public.user_coupons;
create policy "user_coupons_select_own"
  on public.user_coupons
  for select
  to authenticated
  using (auth.uid() = user_id);
