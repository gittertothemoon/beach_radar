-- Create beach_reviews table
CREATE TABLE public.beach_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  beach_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add index for fast retrieval by beach_id
CREATE INDEX idx_beach_reviews_beach_id ON public.beach_reviews(beach_id);
-- Add index for chronological ordering
CREATE INDEX idx_beach_reviews_created_at ON public.beach_reviews(created_at DESC);

-- Enable RLS
ALTER TABLE public.beach_reviews ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read reviews
CREATE POLICY "Reviews are viewable by everyone" ON public.beach_reviews
  FOR SELECT USING (true);

-- Allow authenticated users to insert reviews
CREATE POLICY "Authenticated users can create reviews" ON public.beach_reviews
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to delete their own reviews (optional but good practice)
CREATE POLICY "Users can delete their own reviews" ON public.beach_reviews
  FOR DELETE USING (auth.uid() = user_id);
