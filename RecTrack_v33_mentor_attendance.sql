-- ============================================================
--  Trackademy v33 — Daily mentor attendance
--   One row per mentor per day with a status (Present / Absent /
--   Half day / Leave). Complements mentor_holiday (v31): holidays
--   are planned leave spans; attendance is the day-by-day record.
--
--   Only the Program Head / managers / leads write; everyone signed
--   in can read.
--
--   Run once in Supabase SQL Editor. Additive & safe to re-run.
-- ============================================================

-- employee / staff ID on the person record (shown in attendance + reports)
alter table person add column if not exists employee_id text;

create table if not exists mentor_attendance (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references person(id) on delete cascade,
  att_date   date not null,
  status     text not null,                 -- Present | Absent | Half day | Leave
  note       text,
  marked_by  uuid references person(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (mentor_id, att_date)              -- one record per mentor per day (upsert)
);

alter table mentor_attendance enable row level security;

drop policy if exists ma_read on mentor_attendance;
create policy ma_read on mentor_attendance for select to authenticated using (true);

drop policy if exists ma_admin on mentor_attendance;
create policy ma_admin on mentor_attendance for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

notify pgrst, 'reload schema';
select 'mentor_attendance ready ✓' as ok;
