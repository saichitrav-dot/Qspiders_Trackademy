-- ============================================================
--  Trackademy v22 — mentor review workflow  (closed loop)
--   Adds the 3-status review lifecycle on mentor_prep:
--     review_status: 'open' → 'ready_for_review' → 'completed'
--   plus per-section lead feedback fields.
--   Run once in Supabase SQL Editor. 100% ADDITIVE & SAFE — re-runnable.
-- ============================================================
alter table mentor_prep add column if not exists review_status text not null default 'open'; -- open | ready_for_review | completed
alter table mentor_prep add column if not exists submitted_at  timestamptz;
alter table mentor_prep add column if not exists completed_at   timestamptz;
alter table mentor_prep add column if not exists fb_notes        text;  -- lead feedback per section
alter table mentor_prep add column if not exists fb_practice     text;
alter table mentor_prep add column if not exists fb_presentation text;

notify pgrst, 'reload schema';
select 'mentor_prep review workflow ready ✓' as ok;
