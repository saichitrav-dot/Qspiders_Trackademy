-- ============================================================
--  Trackademy v31 — mentor holiday / leave tracking
--   A simple log of a mentor's holidays (from → to, with a reason).
--   Powers the "Holidays" tab under Mentor Management.
--
--   Additive & safe to re-run. Run once in Supabase SQL Editor.
-- ============================================================

create table if not exists mentor_holiday (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null references person(id) on delete cascade,
  from_date   date not null,
  to_date     date not null,
  reason      text,
  logged_by   uuid references person(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists ix_mentor_holiday_mentor on mentor_holiday(mentor_id);

alter table mentor_holiday enable row level security;

drop policy if exists mh_read on mentor_holiday;
create policy mh_read on mentor_holiday for select to authenticated using (true);

drop policy if exists mh_manage on mentor_holiday;
create policy mh_manage on mentor_holiday for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

notify pgrst, 'reload schema';
select 'mentor_holiday ready ✓' as ok;
