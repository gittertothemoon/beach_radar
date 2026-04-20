-- source: scripts/sql/20_consensus_engine.sql
-- synced_at: 2026-04-20T20:47:41.503Z

-- Phase 2 Consensus Engine: GPS/reputation/environmental/cross-confirm filters.

-- New columns on beach_reports for GPS input and consensus output.
ALTER TABLE public.beach_reports
  ADD COLUMN IF NOT EXISTS reporter_lat  double precision,
  ADD COLUMN IF NOT EXISTS reporter_lng  double precision,
  ADD COLUMN IF NOT EXISTS beach_lat     double precision,
  ADD COLUMN IF NOT EXISTS beach_lng     double precision,
  ADD COLUMN IF NOT EXISTS consensus_score  real,
  ADD COLUMN IF NOT EXISTS consensus_status text
    CHECK (consensus_status IN ('verified', 'rejected', 'pending'));

-- User reputation table: tracks per-user credibility for the consensus engine.
CREATE TABLE IF NOT EXISTS public.user_reputation (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  score          integer NOT NULL DEFAULT 50
                   CHECK (score >= 0 AND score <= 100),
  streak         integer NOT NULL DEFAULT 0,
  total_reports  integer NOT NULL DEFAULT 0,
  verified_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_reputation_score_idx
  ON public.user_reputation (score DESC);

ALTER TABLE public.user_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_reputation_service_all"
  ON public.user_reputation FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "user_reputation_own_read"
  ON public.user_reputation FOR SELECT TO authenticated
  USING (user_id = auth.uid());
