-- OAuth profile completion:
-- 1. Mark auto-generated nicknames with `nickname_generated: true` in metadata
--    so the client knows the user hasn't chosen their own nickname yet.
-- 2. Add an RPC `complete_oauth_profile` that atomically updates both
--    `public.user_profiles` and `auth.users.raw_user_meta_data` and clears
--    the `nickname_generated` flag.

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  raw_nickname text;
  provided_nickname text;
  email_local_part text;
  fallback_prefix text;
  generated_candidate text;
  suffix text;
  attempt integer;
begin
  raw_nickname := coalesce(new.raw_user_meta_data ->> 'nickname', '');
  provided_nickname := btrim(raw_nickname);

  if char_length(provided_nickname) between 3 and 24
    and provided_nickname ~ '^[A-Za-z0-9._-]+$'
  then
    begin
      insert into public.user_profiles (user_id, nickname)
      values (new.id, provided_nickname);
      return new;
    exception
      when unique_violation then
        raise exception 'Nickname already in use.'
          using errcode = '23505';
    end;
  end if;

  email_local_part := lower(split_part(coalesce(new.email, ''), '@', 1));
  email_local_part := regexp_replace(email_local_part, '[^a-z0-9._-]+', '', 'g');
  email_local_part := regexp_replace(email_local_part, '^[._-]+|[._-]+$', '', 'g');
  if char_length(email_local_part) < 3 then
    email_local_part := 'user';
  end if;

  fallback_prefix := left(email_local_part, 17);
  if char_length(fallback_prefix) < 3 then
    fallback_prefix := 'user';
  end if;

  for attempt in 1..24 loop
    suffix := substr(md5(new.id::text || ':' || attempt::text), 1, 6);
    generated_candidate := fallback_prefix || '_' || suffix;

    begin
      insert into public.user_profiles (user_id, nickname)
      values (new.id, generated_candidate);

      update auth.users
      set raw_user_meta_data = jsonb_set(
        jsonb_set(
          coalesce(raw_user_meta_data, '{}'::jsonb),
          '{nickname}',
          to_jsonb(generated_candidate),
          true
        ),
        '{nickname_generated}',
        'true'::jsonb,
        true
      )
      where id = new.id;

      return new;
    exception
      when unique_violation then
        continue;
    end;
  end loop;

  raise exception 'Unable to allocate a unique nickname.'
    using errcode = '23505';
end;
$$;

create or replace function public.complete_oauth_profile(
  new_nickname text,
  new_first_name text default null,
  new_last_name text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_nickname text;
  normalized_first text;
  normalized_last text;
  current_nickname text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  normalized_nickname := btrim(coalesce(new_nickname, ''));
  normalized_first := btrim(coalesce(new_first_name, ''));
  normalized_last := btrim(coalesce(new_last_name, ''));

  if char_length(normalized_nickname) < 3 or char_length(normalized_nickname) > 24
    or normalized_nickname !~ '^[A-Za-z0-9._-]+$'
  then
    raise exception 'Invalid nickname format.'
      using errcode = '22023';
  end if;

  select nickname into current_nickname
  from public.user_profiles
  where user_id = auth.uid();

  if lower(coalesce(current_nickname, '')) <> lower(normalized_nickname) then
    if exists (
      select 1 from public.user_profiles
      where lower(nickname) = lower(normalized_nickname)
        and user_id <> auth.uid()
    ) then
      raise exception 'Nickname already in use.'
        using errcode = '23505';
    end if;
  end if;

  update public.user_profiles
  set nickname = normalized_nickname
  where user_id = auth.uid();

  if not found then
    insert into public.user_profiles (user_id, nickname)
    values (auth.uid(), normalized_nickname);
  end if;

  update auth.users
  set raw_user_meta_data = jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(raw_user_meta_data, '{}'::jsonb) - 'nickname_generated',
        '{nickname}',
        to_jsonb(normalized_nickname),
        true
      ),
      '{first_name}',
      to_jsonb(normalized_first),
      true
    ),
    '{last_name}',
    to_jsonb(normalized_last),
    true
  )
  where id = auth.uid();
end;
$$;

grant execute on function public.complete_oauth_profile(text, text, text) to authenticated;
