-- ============================================================
--  Trackademy v29 — multiple trainers per PROGRAM
--   main_subject.default_trainer_id holds ONE primary owner (it still
--   drives the v_item_owner inheritance, so nothing existing changes).
--   This join table lets several trainers/leads be co-assigned to a
--   program; the app keeps default_trainer_id = the FIRST selected, and
--   uses this table to widen who can see/work the program's content.
--
--   Additive & safe to re-run. Run once in Supabase SQL Editor.
-- ============================================================

create table if not exists program_trainer (
  main_subject_id uuid not null references main_subject(id) on delete cascade,
  trainer_id      uuid not null references person(id)       on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (main_subject_id, trainer_id)
);
create index if not exists ix_program_trainer_trainer on program_trainer(trainer_id);

alter table program_trainer enable row level security;

-- everyone signed in can read (content scoping + the Assignments display)
drop policy if exists pt_read on program_trainer;
create policy pt_read on program_trainer for select to authenticated using (true);

-- whoever can assign owners manages the mapping (admins / managers / team leads)
drop policy if exists pt_manage on program_trainer;
create policy pt_manage on program_trainer for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

notify pgrst, 'reload schema';
select 'program_trainer (multiple trainers per program) ready ✓' as ok;
