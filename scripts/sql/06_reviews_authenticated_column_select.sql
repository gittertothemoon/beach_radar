-- Allow authenticated inserts with RETURNING on safe columns only.

grant select (id, beach_id, author_name, content, rating, created_at)
  on table public.beach_reviews to authenticated;
