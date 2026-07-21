-- ============================================================
--  Trackademy v27 — per-SUB-TOPIC mentor progress
--   The Mentor Preparation Board now lists each assigned topic's
--   SUB-TOPICS, and a mentor works the 4 gated steps (watch video →
--   notes → practice → presentation) per sub-topic.
--
--   mentor_prep stays the assignment unit (one row per mentor × topic,
--   carrying status/review/ratings). This table adds the granular
--   per-sub-topic progress, additively — nothing in v17 changes.
--
--   Run once in Supabase SQL Editor. Additive & safe to re-run.
-- ============================================================

create table if not exists mentor_subtopic_prep (
  id                 uuid primary key default gen_random_uuid(),
  mentor_id          uuid not null references person(id)   on delete cascade,
  subtopic_id        uuid not null references subtopic(id) on delete cascade,
  watched            boolean not null default false,
  notes_done         boolean not null default false,
  practice_done      boolean not null default false,
  presentation_done  boolean not null default false,
  updated_at         timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  unique (mentor_id, subtopic_id)
);

alter table mentor_subtopic_prep enable row level security;

-- everyone signed in can read progress (leads see their mentors' work)
drop policy if exists msp_read on mentor_subtopic_prep;
create policy msp_read on mentor_subtopic_prep for select to authenticated using (true);

-- admins / managers / team leads manage everything
drop policy if exists msp_manage on mentor_subtopic_prep;
create policy msp_manage on mentor_subtopic_prep for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

-- a mentor may create/update/delete progress on their OWN sub-topics
-- ("for all" so the first tick can INSERT the row, then UPDATE it)
drop policy if exists msp_mentor_write on mentor_subtopic_prep;
create policy msp_mentor_write on mentor_subtopic_prep for all to authenticated
  using      (rt_role()::text = 'mentor' and mentor_id = rt_person_id())
  with check (rt_role()::text = 'mentor' and mentor_id = rt_person_id());

notify pgrst, 'reload schema';
select 'mentor_subtopic_prep ready ✓' as ok;
