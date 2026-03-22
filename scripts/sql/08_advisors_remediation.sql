-- Supabase Advisors remediation:
-- - SECURITY DEFINER view warning
-- - auth_rls_initplan warnings
-- - function_search_path_mutable warning

-- Ensure the public reviews view runs with caller permissions.
alter view if exists public.beach_reviews_public
  set (security_invoker = true);

-- Optimize RLS policies by wrapping auth.uid() in a scalar subquery so it is
-- planned once per statement instead of re-evaluated per row.
drop policy if exists "Authenticated users can create reviews" on public.beach_reviews;
create policy "Authenticated users can create reviews" on public.beach_reviews
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own reviews" on public.beach_reviews;
create policy "Users can delete their own reviews" on public.beach_reviews
  for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "user_favorites_select_own" on public.user_favorites;
create policy "user_favorites_select_own"
  on public.user_favorites
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "user_favorites_insert_own" on public.user_favorites;
create policy "user_favorites_insert_own"
  on public.user_favorites
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_favorites_delete_own" on public.user_favorites;
create policy "user_favorites_delete_own"
  on public.user_favorites
  for delete
  using ((select auth.uid()) = user_id);

-- Fix mutable search_path on trigger helper if present.
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_updated_at'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    execute 'alter function public.set_updated_at() set search_path = pg_catalog, public';
  end if;
end $$;
