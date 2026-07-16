-- ============================================================
--  Trackademy v24 — a trainer can MANAGE their own studio slot
--   Lets the assigned trainer update THEIR OWN slot through the
--   whole recording lifecycle (slot status, recording status,
--   subject/sub-topic, missed reason, etc.) — not just before
--   recording starts (which v23 restricted).
--
--   They still CANNOT:
--     • add (insert) a slot        → no insert policy for trainers
--     • delete a slot              → no delete policy for trainers
--     • touch someone else's slot  → using/with-check = own rows only
--     • reassign a slot to another trainer → with-check keeps it theirs
--   The Program Head (admin) keeps full control via rt_slot_admin.
--
--   Run once in Supabase SQL Editor. Safe to re-run.
--   Supersedes the slot_trainer_update policy from v23.
-- ============================================================
drop policy if exists slot_trainer_update on slot;
create policy slot_trainer_update on slot for update to authenticated
  using      (trainer_id = rt_person_id())
  with check (trainer_id = rt_person_id());

notify pgrst, 'reload schema';
select 'trainer can manage their own slot (any recording status) ✓' as ok;
