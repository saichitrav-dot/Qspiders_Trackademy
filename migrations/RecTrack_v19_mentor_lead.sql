-- ============================================================
--  Trackademy v19 — mentor's managing Lead  (Phase 1)
--   One mentor → one Lead. Adds a single nullable column that
--   points a mentor at the SME Lead who trains, assigns and rates them.
--   Run once in Supabase SQL Editor.
--
--   100% ADDITIVE & SAFE:
--     • adds ONE nullable column — no existing data is touched
--     • nullable + no default = metadata-only change (instant, non-locking,
--       no table rewrite, no downtime even while the team is working)
--     • drops nothing, renames nothing, deletes nothing
--   Safe to re-run.
-- ============================================================
alter table person add column if not exists lead_id uuid references person(id) on delete set null;

notify pgrst, 'reload schema';
select 'person.lead_id added ✓' as ok;
