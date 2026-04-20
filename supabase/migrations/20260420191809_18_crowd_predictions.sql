-- source: scripts/sql/18_crowd_predictions.sql
-- synced_at: 2026-04-20T19:18:09.346Z

-- Crowd predictions cache: pre-computed hourly crowd forecasts per beach.
-- Predictions are keyed by (beach_id, target_time) and expire after valid_until.

CREATE TABLE IF NOT EXISTS crowd_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id TEXT NOT NULL,
  target_time TIMESTAMPTZ NOT NULL,
  crowd_index SMALLINT NOT NULL CHECK (crowd_index >= 0 AND crowd_index <= 100),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  factors_json JSONB,
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index allows upsert on (beach_id, target_time)
CREATE UNIQUE INDEX IF NOT EXISTS crowd_predictions_beach_target_idx
  ON crowd_predictions (beach_id, target_time);

-- For pruning expired rows efficiently
CREATE INDEX IF NOT EXISTS crowd_predictions_valid_until_idx
  ON crowd_predictions (valid_until);

-- Row Level Security: public read, writes only via service role
ALTER TABLE crowd_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crowd_predictions_read_public" ON crowd_predictions;
CREATE POLICY "crowd_predictions_read_public"
  ON crowd_predictions FOR SELECT
  USING (true);
