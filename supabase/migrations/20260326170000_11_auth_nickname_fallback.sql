-- source: scripts/sql/11_auth_nickname_fallback.sql
-- synced_at: 2026-03-26T15:53:46.793Z

-- Auth nickname hardening:
-- Keep strict behavior for explicit valid nicknames (duplicate -> error),
-- but avoid signup failures for clients that omit/garble nickname metadata.

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

  -- Preserve existing strict path: if caller supplied a valid nickname,
  -- either insert it or fail with duplicate error.
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

  -- Fallback path for missing/invalid nickname metadata.
  email_local_part := lower(split_part(coalesce(new.email, ''), '@', 1));
  email_local_part := regexp_replace(email_local_part, '[^a-z0-9._-]+', '', 'g');
  email_local_part := regexp_replace(email_local_part, '^[._-]+|[._-]+$', '', 'g');
  if char_length(email_local_part) < 3 then
    email_local_part := 'user';
  end if;

  -- 17 + "_" + 6 keeps max length <= 24.
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
        coalesce(raw_user_meta_data, '{}'::jsonb),
        '{nickname}',
        to_jsonb(generated_candidate),
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
