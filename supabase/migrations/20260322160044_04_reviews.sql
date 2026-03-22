-- source: scripts/sql/04_reviews.sql
-- synced_at: 2026-03-22T16:00:44.464Z

create extension if not exists pgcrypto;

-- Create beach_reviews table
create table if not exists public.beach_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  beach_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add index for fast retrieval by beach_id
create index if not exists idx_beach_reviews_beach_id on public.beach_reviews(beach_id);
-- Add index for chronological ordering
create index if not exists idx_beach_reviews_created_at on public.beach_reviews(created_at desc);

-- Enable RLS
alter table public.beach_reviews enable row level security;

-- Allow anyone to read reviews
drop policy if exists "Reviews are viewable by everyone" on public.beach_reviews;
create policy "Reviews are viewable by everyone" on public.beach_reviews
  for select using (true);

-- Allow authenticated users to insert reviews
drop policy if exists "Authenticated users can create reviews" on public.beach_reviews;
create policy "Authenticated users can create reviews" on public.beach_reviews
  for insert with check (auth.uid() = user_id);

-- Allow users to delete their own reviews (optional but good practice)
drop policy if exists "Users can delete their own reviews" on public.beach_reviews;
create policy "Users can delete their own reviews" on public.beach_reviews
  for delete using (auth.uid() = user_id);
