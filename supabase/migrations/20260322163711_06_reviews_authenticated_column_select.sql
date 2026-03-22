-- source: scripts/sql/06_reviews_authenticated_column_select.sql
-- synced_at: 2026-03-22T16:37:11.085Z

-- Allow authenticated inserts with RETURNING on safe columns only.

grant select (id, beach_id, author_name, content, rating, created_at)
  on table public.beach_reviews to authenticated;
