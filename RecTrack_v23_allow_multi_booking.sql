-- ============================================================
--  Trackademy v23 — allow any number of studio bookings
--   Removes the double-booking guard rails so a studio/trainer
--   can hold more than one slot at the same time.
--   Run once in Supabase SQL Editor. Safe to re-run.
--
--   NOTE: this REMOVES a safety check by design (per request).
--   After this, the system will NOT stop overlapping bookings.
-- ============================================================
alter table slot drop constraint if exists no_studio_double_book;
alter table slot drop constraint if exists no_trainer_double_book;

-- a trainer may amend THEIR OWN slot, but only before recording starts
drop policy if exists slot_trainer_update on slot;
create policy slot_trainer_update on slot for update to authenticated
  using      (trainer_id = rt_person_id() and recording_status = 'Not Started')
  with check (trainer_id = rt_person_id());

notify pgrst, 'reload schema';
select 'multi-booking allowed + trainer self-amend enabled ✓' as ok;
