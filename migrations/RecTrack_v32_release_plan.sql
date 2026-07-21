-- ============================================================
--  Trackademy v32 — Release planning
--   A "release plan" is a named batch (e.g. "Release 1") with a
--   target release date. Completed subjects are mapped to a release
--   so you can plan what ships and when.
--     • release_plan          → id, name, release_date
--     • release_plan_subject  → maps a subject to a release (one row
--                                per subject+release; the app keeps a
--                                subject in a single release)
--
--   Only the Program Head / managers / leads write; everyone signed
--   in can read to see the plan.
--
--   Run once in Supabase SQL Editor. Additive & safe to re-run.
-- ============================================================

create table if not exists release_plan (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  release_date date,
  created_by   uuid references person(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists release_plan_subject (
  plan_id    uuid not null references release_plan(id) on delete cascade,
  subject_id uuid not null references subject(id) on delete cascade,
  primary key (plan_id, subject_id)
);

-- map an individual TOPIC to a release (finer-grained than whole-subject)
create table if not exists release_plan_topic (
  plan_id  uuid not null references release_plan(id) on delete cascade,
  topic_id uuid not null references topic(id) on delete cascade,
  primary key (plan_id, topic_id)
);

-- map an individual SUB-TOPIC (content_item) to a release — the finest grain; unmapped
-- sub-topics stay available to be planned into a different release
create table if not exists release_plan_item (
  plan_id         uuid not null references release_plan(id) on delete cascade,
  content_item_id uuid not null references content_item(id) on delete cascade,
  primary key (plan_id, content_item_id)
);

-- ---------- RLS ----------
alter table release_plan         enable row level security;
alter table release_plan_subject enable row level security;
alter table release_plan_topic   enable row level security;
alter table release_plan_item    enable row level security;

drop policy if exists rp_read on release_plan;
create policy rp_read on release_plan for select to authenticated using (true);
drop policy if exists rp_admin on release_plan;
create policy rp_admin on release_plan for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

drop policy if exists rps_read on release_plan_subject;
create policy rps_read on release_plan_subject for select to authenticated using (true);
drop policy if exists rps_admin on release_plan_subject;
create policy rps_admin on release_plan_subject for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

drop policy if exists rpt_read on release_plan_topic;
create policy rpt_read on release_plan_topic for select to authenticated using (true);
drop policy if exists rpt_admin on release_plan_topic;
create policy rpt_admin on release_plan_topic for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

drop policy if exists rpi_read on release_plan_item;
create policy rpi_read on release_plan_item for select to authenticated using (true);
drop policy if exists rpi_admin on release_plan_item;
create policy rpi_admin on release_plan_item for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

notify pgrst, 'reload schema';
select 'release_plan + release_plan_subject ready ✓' as ok;
