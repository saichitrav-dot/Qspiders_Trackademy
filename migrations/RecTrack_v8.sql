-- ============================================================
--  Trackademy v8 — access control (data visibility + studio-slot rules)
--   • per-person "full_visibility" flag (managed in Manage → Team):
--       on  = sees everything;  off = sees only what's assigned to them.
--       (admin/Program Head always sees everything regardless.)
--   • Trainers may update only THEIR OWN slot, and only ONCE (auto-locks).
--   • Trainers can never touch another trainer's slot.
--   • Only the Program Head (admin) can book/change slots freely.
--  Additive & safe to re-run.
-- ============================================================

-- data visibility flag — set per teammate in Manage → Team
alter table person add column if not exists full_visibility boolean not null default false;

-- one-time lock flag
alter table slot add column if not exists trainer_locked boolean not null default false;

-- auto-lock: the moment a TRAINER saves a slot, it locks for them (admin edits never lock)
create or replace function rt_slot_lock() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if rt_role() = 'trainer' then new.trainer_locked := true; end if;
  return new;
end $$;
drop trigger if exists trg_slot_lock on slot;
create trigger trg_slot_lock before update on slot for each row execute function rt_slot_lock();

-- reset ALL slot policies to a known-good set (clears any broad policy left by earlier migrations)
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'slot' loop
    execute format('drop policy if exists %I on slot;', p.policyname);
  end loop;
end $$;

-- everyone signed in can SEE the board
create policy rt_slot_read on slot for select to authenticated using (true);
-- Program Head: book / change any slot
create policy rt_slot_admin on slot for all to authenticated using (rt_role() = 'admin') with check (rt_role() = 'admin');
-- Trainer: UPDATE only their OWN slot, only while NOT locked (=> exactly one update, then view-only)
create policy rt_slot_trainer on slot for update to authenticated
  using (rt_role() = 'trainer' and trainer_id = rt_person_id() and not coalesce(trainer_locked, false))
  with check (rt_role() = 'trainer' and trainer_id = rt_person_id());
-- (managers/editors/reviewers get no slot-write policy => read-only.)
-- (managers/editors/reviewers get no slot-write policy => they cannot change slots.)

notify pgrst, 'reload schema';

select (select count(*) from slot) as slots, (select count(*) from slot where trainer_locked) as locked_slots;
