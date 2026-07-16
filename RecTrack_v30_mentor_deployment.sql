-- ============================================================
--  Trackademy v30 — mentor deployment tracking
--   Powers the "Mentors deployed" and "Mentors Back to bench" tabs.
--   A mentor who has finished training can be deployed to a Branch /
--   Online training / College / Corporate training for a date range,
--   with details. Deployment needs a MANAGER's prior approval
--   (status: pending → approved). When a deployment ends (or is
--   rejected), the mentor is available again ("back to bench").
--
--   Additive & safe to re-run. Run once in Supabase SQL Editor.
-- ============================================================

create table if not exists mentor_deployment (
  id              uuid primary key default gen_random_uuid(),
  mentor_id       uuid not null references person(id) on delete cascade,
  subject         text,
  deployment_type text not null check (deployment_type in ('Branch','Online training','College','Corporate training')),
  from_date       date,
  to_date         date,
  details         text,
  status          text not null default 'pending' check (status in ('pending','approved','rejected','completed')),
  requested_by    uuid references person(id) on delete set null,
  approved_by     uuid references person(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- subject added after first release — safe if the table already existed
alter table mentor_deployment add column if not exists subject text;
create index if not exists ix_mentor_deployment_mentor on mentor_deployment(mentor_id);

alter table mentor_deployment enable row level security;

-- everyone signed in can read (the tabs + a mentor seeing their own deployment)
drop policy if exists md_read on mentor_deployment;
create policy md_read on mentor_deployment for select to authenticated using (true);

-- admins / managers / team leads create & manage deployment records
-- (the APP enforces that only a Manager/Program Head can APPROVE)
drop policy if exists md_manage on mentor_deployment;
create policy md_manage on mentor_deployment for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

notify pgrst, 'reload schema';
select 'mentor_deployment ready ✓' as ok;
