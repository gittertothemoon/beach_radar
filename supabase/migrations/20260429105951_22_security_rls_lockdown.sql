-- source: scripts/sql/22_security_rls_lockdown.sql
-- synced_at: 2026-04-29T10:59:51.566Z

-- Security hardening from 2026-04-29 audit:
-- 1. Enable RLS on tables that were left unprotected (CRITICAL)
-- 2. Pin search_path on all SECURITY DEFINER functions to pg_catalog, public (HIGH)
-- 3. Revoke EXECUTE on privileged SECURITY DEFINER functions from anon/authenticated;
--    grant only to service_role (defense in depth — these are only called via API handlers).
--
-- All listed tables are written exclusively via API handlers using the service-role key,
-- which bypasses RLS. Locking down anon/authenticated access has no functional impact.

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on the 4 tables flagged as CRITICAL.
-- ---------------------------------------------------------------------------

alter table public.beach_reports enable row level security;
alter table public.business_requests enable row level security;
alter table public.user_mission_claims enable row level security;
alter table public.user_daily_mission_claims enable row level security;

-- beach_reports: writes go through /api/reports (service role); public reads
-- go through GET /api/reports (also service role). No direct anon/authenticated
-- access is needed.
drop policy if exists "beach_reports_service_role_all" on public.beach_reports;
create policy "beach_reports_service_role_all"
  on public.beach_reports
  as permissive for all
  to service_role
  using (true)
  with check (true);

-- business_requests: contains PII (email, phone, message). Service role only.
drop policy if exists "business_requests_service_role_all" on public.business_requests;
create policy "business_requests_service_role_all"
  on public.business_requests
  as permissive for all
  to service_role
  using (true)
  with check (true);

-- user_mission_claims: written exclusively by claim_weekly_mission_reward
-- (SECURITY DEFINER) called via service role. Allow user to read their own
-- claim history if a future client query needs it.
drop policy if exists "user_mission_claims_service_role_all" on public.user_mission_claims;
create policy "user_mission_claims_service_role_all"
  on public.user_mission_claims
  as permissive for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "user_mission_claims_select_own" on public.user_mission_claims;
create policy "user_mission_claims_select_own"
  on public.user_mission_claims
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- user_daily_mission_claims: same pattern as weekly.
drop policy if exists "user_daily_mission_claims_service_role_all" on public.user_daily_mission_claims;
create policy "user_daily_mission_claims_service_role_all"
  on public.user_daily_mission_claims
  as permissive for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "user_daily_mission_claims_select_own" on public.user_daily_mission_claims;
create policy "user_daily_mission_claims_select_own"
  on public.user_daily_mission_claims
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 2. Pin search_path on SECURITY DEFINER functions to pg_catalog, public.
--    Wrapped in DO blocks so the migration is safe to re-run and tolerant of
--    function-signature drift across environments.
-- ---------------------------------------------------------------------------

do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as fn_name,
      pg_get_function_identity_arguments(p.oid) as fn_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and p.proname in (
        'apply_report_points_reward',
        'ensure_points_balance_row',
        'redeem_badge_points',
        'claim_weekly_mission_reward',
        'claim_daily_mission_reward',
        'confirm_beach_report'
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = pg_catalog, public',
      fn.schema_name,
      fn.fn_name,
      fn.fn_args
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Revoke EXECUTE on privileged SECURITY DEFINER functions from public.
--    These are only called from server-side handlers using the service role.
--    Trigger functions (apply_report_points_reward) are deliberately excluded —
--    they are invoked by the database engine, not by the caller.
-- ---------------------------------------------------------------------------

do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as fn_name,
      pg_get_function_identity_arguments(p.oid) as fn_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'claim_weekly_mission_reward',
        'claim_daily_mission_reward',
        'confirm_beach_report'
      )
  loop
    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated',
      fn.schema_name,
      fn.fn_name,
      fn.fn_args
    );
    execute format(
      'grant execute on function %I.%I(%s) to service_role',
      fn.schema_name,
      fn.fn_name,
      fn.fn_args
    );
  end loop;
end $$;
