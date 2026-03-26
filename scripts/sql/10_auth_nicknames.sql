-- App nickname profiles
-- Adds unique nickname constraints for anonymous in-app identities.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now(),
  constraint user_profiles_nickname_len_chk
    check (char_length(btrim(nickname)) between 3 and 24),
  constraint user_profiles_nickname_format_chk
    check (btrim(nickname) ~ '^[A-Za-z0-9._-]+$')
);

create unique index if not exists user_profiles_nickname_ci_uidx
  on public.user_profiles ((lower(nickname)));

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
  on public.user_profiles
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own"
  on public.user_profiles
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own"
  on public.user_profiles
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_profiles_delete_own" on public.user_profiles;
create policy "user_profiles_delete_own"
  on public.user_profiles
  for delete
  using ((select auth.uid()) = user_id);

create or replace function public.is_nickname_available(nickname_input text)
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $$
  select case
    when nickname_input is null then false
    when char_length(btrim(nickname_input)) < 3 then false
    when char_length(btrim(nickname_input)) > 24 then false
    when btrim(nickname_input) !~ '^[A-Za-z0-9._-]+$' then false
    else not exists (
      select 1
      from public.user_profiles up
      where lower(up.nickname) = lower(btrim(nickname_input))
    )
  end;
$$;

grant execute on function public.is_nickname_available(text) to anon, authenticated;

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  raw_nickname text;
  sanitized_nickname text;
begin
  raw_nickname := coalesce(new.raw_user_meta_data ->> 'nickname', '');
  sanitized_nickname := btrim(raw_nickname);

  if char_length(sanitized_nickname) < 3
    or char_length(sanitized_nickname) > 24
    or sanitized_nickname !~ '^[A-Za-z0-9._-]+$'
  then
    raise exception 'Nickname must be 3-24 chars and use letters, numbers, dot, underscore or hyphen.'
      using errcode = '22023';
  end if;

  insert into public.user_profiles (user_id, nickname)
  values (new.id, sanitized_nickname);

  return new;
exception
  when unique_violation then
    raise exception 'Nickname already in use.'
      using errcode = '23505';
end;
$$;

drop trigger if exists on_auth_user_profile on auth.users;
create trigger on_auth_user_profile
  after insert on auth.users
  for each row
  execute function public.handle_auth_user_profile();
