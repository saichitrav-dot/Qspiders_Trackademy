-- ============================================================================
--  Trackademy v42 — college name on a mentor deployment
--
--  Adds a dedicated `college` field so College deployments can be grouped by
--  college (college first, then the mentors mapped to it). The existing `details`
--  field is reused as the per-deployment remarks.
--
--  Idempotent / safe to re-run. Run once in the Supabase SQL editor.
-- ============================================================================

alter table mentor_deployment add column if not exists college text;

notify pgrst, 'reload schema';
select 'mentor_deployment.college ready ✓' as ok;
