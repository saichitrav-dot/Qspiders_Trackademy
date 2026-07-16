-- ============================================================
--  Trackademy v28 — a mentor can have MULTIPLE managing leads
--   person.lead_id holds ONE lead. This join table lets a mentor be
--   managed by several leads (team_lead / manager). The app keeps
--   person.lead_id in sync with the FIRST selected lead for backward
--   compatibility; this table holds the full set.
--
--   Additive & safe to re-run. Run once in Supabase SQL Editor.
-- ============================================================

create table if not exists mentor_lead (
  mentor_id  uuid not null references person(id) on delete cascade,
  lead_id    uuid not null references person(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (mentor_id, lead_id)
);
create index if not exists ix_mentor_lead_lead on mentor_lead(lead_id);

alter table mentor_lead enable row level security;

-- everyone signed in can read (scoping + "assigned leads" display)
drop policy if exists ml_read on mentor_lead;
create policy ml_read on mentor_lead for select to authenticated using (true);

-- admins / managers / team leads manage the mapping
drop policy if exists ml_manage on mentor_lead;
create policy ml_manage on mentor_lead for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

notify pgrst, 'reload schema';
select 'mentor_lead (multiple managing leads) ready ✓' as ok;
