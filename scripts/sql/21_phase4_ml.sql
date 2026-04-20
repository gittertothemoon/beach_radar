-- Phase 4: Adaptive Weight Learning, Time-Series Patterns, Anomaly Detection, Prediction Accuracy

-- Per-beach adaptive filter weights, updated via EMA after each consensus decision
CREATE TABLE IF NOT EXISTS beach_filter_weights (
  beach_id TEXT PRIMARY KEY,
  w_gps REAL NOT NULL DEFAULT 0.30,
  w_reputation REAL NOT NULL DEFAULT 0.25,
  w_environmental REAL NOT NULL DEFAULT 0.20,
  w_cross_confirm REAL NOT NULL DEFAULT 0.25,
  -- Running accuracy per filter (EMA, 0–1); used to derive weights
  acc_gps REAL NOT NULL DEFAULT 0.65,
  acc_reputation REAL NOT NULL DEFAULT 0.65,
  acc_environmental REAL NOT NULL DEFAULT 0.65,
  acc_cross_confirm REAL NOT NULL DEFAULT 0.65,
  report_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_weights_sum CHECK (
    ABS(w_gps + w_reputation + w_environmental + w_cross_confirm - 1.0) < 0.01
  )
);

ALTER TABLE beach_filter_weights ENABLE ROW LEVEL SECURITY;

-- Precomputed weekly crowd patterns per beach (refreshed by ml-optimize cron)
CREATE TABLE IF NOT EXISTS beach_time_patterns (
  beach_id TEXT NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day SMALLINT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  avg_crowd_level REAL NOT NULL,
  stddev_crowd REAL NOT NULL DEFAULT 0.5,
  sample_count INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (beach_id, day_of_week, hour_of_day)
);

CREATE INDEX IF NOT EXISTS idx_time_patterns_beach ON beach_time_patterns (beach_id);

ALTER TABLE beach_time_patterns ENABLE ROW LEVEL SECURITY;

-- Short-lived anomaly events (spike / drop detected vs expected pattern)
CREATE TABLE IF NOT EXISTS beach_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  crowd_level REAL NOT NULL,
  expected_level REAL NOT NULL,
  z_score REAL NOT NULL,
  report_id TEXT,
  UNIQUE (beach_id, detected_at)
);

CREATE INDEX IF NOT EXISTS idx_anomalies_beach_expiry ON beach_anomalies (beach_id, expires_at);

ALTER TABLE beach_anomalies ENABLE ROW LEVEL SECURITY;

-- Prediction accuracy log: actual vs predicted crowd index per beach/hour
CREATE TABLE IF NOT EXISTS prediction_accuracy_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id TEXT NOT NULL,
  target_time TIMESTAMPTZ NOT NULL,
  predicted_crowd_index REAL NOT NULL,
  actual_crowd_index REAL,
  absolute_error REAL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (beach_id, target_time)
);

CREATE INDEX IF NOT EXISTS idx_accuracy_log_beach ON prediction_accuracy_log (beach_id, target_time DESC);

ALTER TABLE prediction_accuracy_log ENABLE ROW LEVEL SECURITY;
