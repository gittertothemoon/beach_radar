-- source: scripts/sql/05_reviews_hardening.sql
-- synced_at: 2026-03-22T16:35:51.911Z

-- Reviews hardening: reduce data exposure and tighten write validation.

create extension if not exists pgcrypto;

-- Expose only public-safe columns to client reads.
create or replace view public.beach_reviews_public as
select
  id,
  beach_id,
  author_name,
  content,
  rating,
  created_at
from public.beach_reviews;

grant select on table public.beach_reviews_public to anon, authenticated, service_role;

-- Prevent direct reads of internal columns (e.g. user_id) from client roles.
revoke select on table public.beach_reviews from anon, authenticated;
grant select on table public.beach_reviews to service_role;
grant select (id, beach_id, author_name, content, rating, created_at)
  on table public.beach_reviews to authenticated;

-- Keep write access only where needed.
revoke all on table public.beach_reviews from anon;
grant insert, delete on table public.beach_reviews to authenticated;
grant select, insert, update, delete on table public.beach_reviews to service_role;

-- Prevent spoofed identity on insert.
drop policy if exists "Authenticated users can create reviews" on public.beach_reviews;
create policy "Authenticated users can create reviews" on public.beach_reviews
  for insert
  with check (auth.uid() = user_id);

-- Clean existing payloads before constraints.
update public.beach_reviews
set
  author_name = btrim(regexp_replace(author_name, '[<>]', '', 'g')),
  content = btrim(regexp_replace(content, '[<>]', '', 'g'))
where author_name ~ '[<>]' or content ~ '[<>]';

alter table public.beach_reviews
  drop constraint if exists beach_reviews_author_name_len_chk,
  drop constraint if exists beach_reviews_author_name_safe_chk,
  drop constraint if exists beach_reviews_content_len_chk,
  drop constraint if exists beach_reviews_content_safe_chk,
  drop constraint if exists beach_reviews_rating_range_chk;

alter table public.beach_reviews
  add constraint beach_reviews_author_name_len_chk
    check (char_length(btrim(author_name)) between 1 and 80),
  add constraint beach_reviews_author_name_safe_chk
    check (author_name !~ '[<>]'),
  add constraint beach_reviews_content_len_chk
    check (char_length(btrim(content)) between 1 and 1000),
  add constraint beach_reviews_content_safe_chk
    check (content !~ '[<>]'),
  add constraint beach_reviews_rating_range_chk
    check (rating between 1 and 5);
