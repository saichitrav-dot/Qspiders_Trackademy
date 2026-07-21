-- ============================================================
--  Trackademy v21 — predictive signals for mentors  (Phase 3)
--   Adds the two data points the Mentor Risk Index needs:
--     • last_progress_at — stamped when a prep step completes (stall/velocity)
--     • send_back_count   — how many times a step was returned (QC failures)
--   Run once in Supabase SQL Editor. 100% ADDITIVE & SAFE — re-runnable.
-- ============================================================
alter table mentor_prep add column if not exists last_progress_at timestamptz;
alter table mentor_prep add column if not exists send_back_count  int not null default 0;

notify pgrst, 'reload schema';
select 'mentor_prep predictive columns ready ✓' as ok;
