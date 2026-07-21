-- ============================================================
--  Trackademy v26 — Weekly Goals (trainers & editors)
--   A weekly goal is a per-PROGRAM set of Subjects → Topics that
--   should be completed in a given week. Two kinds:
--     • 'recording' → the trainer side (a topic is met when its
--        sub-topics have a recording logged that week)
--     • 'editing'   → the editor side (a topic is met when its
--        sub-topics' edits are marked Completed that week)
--
--   Only the Program Head (admin) creates/edits goals; everyone
--   signed in can read them to see progress.
--
--   Also adds editing_task.completed_at so editor completion can be
--   bounded to the goal week (the app sets it when Final output →
--   Completed). Existing completed edits have a null completed_at
--   until they are next touched — this feature is forward-looking.
--
--   Run once in Supabase SQL Editor. Additive & safe to re-run.
-- ============================================================

-- one goal per program + week + kind
create table if not exists weekly_goal (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references main_subject(id) on delete cascade,
  week_start  date not null,                         -- Monday of the target week
  kind        text not null check (kind in ('recording','editing')),
  created_by  uuid references person(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (program_id, week_start, kind)
);

-- the topics selected for that goal
create table if not exists weekly_goal_topic (
  goal_id   uuid not null references weekly_goal(id) on delete cascade,
  topic_id  uuid not null references topic(id) on delete cascade,
  primary key (goal_id, topic_id)
);

-- the SUB-TOPICS (content_items) selected for that goal — track goals at sub-topic granularity
create table if not exists weekly_goal_item (
  goal_id         uuid not null references weekly_goal(id) on delete cascade,
  content_item_id uuid not null references content_item(id) on delete cascade,
  primary key (goal_id, content_item_id)
);

-- editor completion timestamp (forward-looking)
alter table editing_task add column if not exists completed_at timestamptz;

-- ---------- RLS ----------
alter table weekly_goal       enable row level security;
alter table weekly_goal_topic enable row level security;
alter table weekly_goal_item  enable row level security;
drop policy if exists wgi_read on weekly_goal_item;
create policy wgi_read on weekly_goal_item for select to authenticated using (true);
drop policy if exists wgi_admin on weekly_goal_item;
create policy wgi_admin on weekly_goal_item for all to authenticated
  using (rt_role()::text = 'admin') with check (rt_role()::text = 'admin');

-- everyone signed in can read (so trainers/editors/leads see progress)
drop policy if exists wg_read on weekly_goal;
create policy wg_read on weekly_goal for select to authenticated using (true);

drop policy if exists wgt_read on weekly_goal_topic;
create policy wgt_read on weekly_goal_topic for select to authenticated using (true);

-- only the Program Head (admin) writes
drop policy if exists wg_admin on weekly_goal;
create policy wg_admin on weekly_goal for all to authenticated
  using (rt_role()::text = 'admin') with check (rt_role()::text = 'admin');

drop policy if exists wgt_admin on weekly_goal_topic;
create policy wgt_admin on weekly_goal_topic for all to authenticated
  using (rt_role()::text = 'admin') with check (rt_role()::text = 'admin');

notify pgrst, 'reload schema';
select 'weekly_goal + weekly_goal_topic + editing_task.completed_at ready ✓' as ok;
