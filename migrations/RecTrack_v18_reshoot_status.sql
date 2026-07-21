-- ============================================================
--  Trackademy v18 — add "Reshoot" stage status
--   Adds Reshoot to the stage_status enum so it can be saved.
--   Run once in Supabase SQL Editor. Additive & safe to re-run.
-- ============================================================
alter type stage_status add value if not exists 'Reshoot';

notify pgrst, 'reload schema';
select 'Reshoot status added ✓' as ok;
