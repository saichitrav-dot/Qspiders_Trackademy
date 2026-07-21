-- ============================================================
--  Trackademy v25 — documented "remove mentor" (soft / retained)
--   Lets the Program Head remove a person WITHOUT losing history.
--   The app will: (1) withdraw all their topic assignments so the
--   topics return to the unassigned bucket, and (2) deactivate the
--   account while STORING the reason below — so the record, their
--   ratings and the reason stay available for future reference.
--
--   This is NOT a hard delete: nothing is erased. Reactivating is
--   just flipping is_active back on.
--
--   Run once in Supabase SQL Editor. Safe to re-run.
-- ============================================================
alter table person add column if not exists removed_reason text;
alter table person add column if not exists removed_at     timestamptz;
alter table person add column if not exists removed_by     uuid references person(id) on delete set null;

notify pgrst, 'reload schema';
select 'person removal-reason columns ready ✓' as ok;
