-- ============================================================================
--  Trackademy v42 — upcoming college trainings
--
--  The College view takes the college NAME from a deployment's Remarks (details),
--  groups ongoing trainings by college, and tracks UPCOMING colleges (planned, no
--  mentor deployed yet) in this small table so they can be added and watched.
--
--  Idempotent / safe to re-run. Run once in the Supabase SQL editor.
-- ============================================================================

create table if not exists mentor_upcoming_college (
  id uuid primary key default gen_random_uuid(),
  college text not null,
  expected_date date,
  note text,
  created_by uuid,
  created_at timestamptz default now()
);

alter table mentor_upcoming_college enable row level security;
drop policy if exists muc_all on mentor_upcoming_college;
create policy muc_all on mentor_upcoming_college for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
select 'mentor_upcoming_college ready ✓' as ok;
