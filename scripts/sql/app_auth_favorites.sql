-- App accounts and favorites (Supabase Auth + public.user_favorites)
-- Prerequisites:
-- 1) Supabase Auth enabled
-- 2) Frontend configured with VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
-- 3) Email confirmation disabled if you want immediate in-app login after sign-up

create table if not exists public.user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  beach_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, beach_id)
);

create index if not exists user_favorites_created_at_idx
  on public.user_favorites(created_at desc);

alter table public.user_favorites enable row level security;

drop policy if exists "user_favorites_select_own" on public.user_favorites;
create policy "user_favorites_select_own"
  on public.user_favorites
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_favorites_insert_own" on public.user_favorites;
create policy "user_favorites_insert_own"
  on public.user_favorites
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_favorites_delete_own" on public.user_favorites;
create policy "user_favorites_delete_own"
  on public.user_favorites
  for delete
  using (auth.uid() = user_id);
