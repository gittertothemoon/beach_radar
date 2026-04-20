-- Phase 2 columns for beach_reports.
-- water_condition and beach_condition were added directly via Supabase dashboard (already exist in prod).
-- expires_at is required by the confirm_beach_report() stored procedure (migration 17).

alter table public.beach_reports
  add column if not exists water_condition smallint check (water_condition between 1 and 4),
  add column if not exists beach_condition smallint check (beach_condition between 1 and 3),
  add column if not exists expires_at timestamptz;
