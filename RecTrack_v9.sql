-- ============================================================
--  Trackademy v9 — studio slots are Program-Head-only
--   Slots: everyone signed in can VIEW; only the Program Head (admin) books/changes them.
--   Removes the earlier trainer "edit-own-once" rule and its auto-lock trigger.
--  Additive & safe to re-run.
-- ============================================================

drop policy if exists rt_slot_trainer on slot;   -- trainers can no longer edit any slot
drop trigger  if exists trg_slot_lock  on slot;   -- auto-lock no longer needed

-- Remaining slot policies (from v8) stay as-is:
--   rt_slot_read  → any signed-in user can SEE the board
--   rt_slot_admin → only the Program Head can insert/update/delete slots

notify pgrst, 'reload schema';

select (select count(*) from slot) as slots;
