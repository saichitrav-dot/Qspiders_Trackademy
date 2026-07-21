-- ============================================================
--  Trackademy v17 — Mentor Generation
--   Adds the "mentor" role + the mentor_prep table that tracks each
--   mentor through 4 gated steps per topic (watch video → notes →
--   practice → presentation). Run once in Supabase SQL Editor.
--   Additive & safe to re-run.
-- ============================================================

-- 1) new role
alter type person_role add value if not exists 'mentor';

-- 2) prep tracking: one row per mentor × topic
create table if not exists mentor_prep (
  id                 uuid primary key default gen_random_uuid(),
  mentor_id          uuid not null references person(id) on delete cascade,
  topic_id           uuid not null references topic(id)  on delete cascade,
  video_link         text,
  watched            boolean not null default false,
  notes_text         text,
  notes_done         boolean not null default false,
  practice_text      text,
  practice_done      boolean not null default false,
  ppt_link           text,
  feedback_text      text,
  presentation_done  boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (mentor_id, topic_id)
);

alter table mentor_prep enable row level security;

drop policy if exists mp_read on mentor_prep;
create policy mp_read on mentor_prep for select to authenticated using (true);

-- admins / managers / team leads assign + manage everything
drop policy if exists mp_manage on mentor_prep;
create policy mp_manage on mentor_prep for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

-- a mentor may update their OWN prep rows (work the 4 steps)
drop policy if exists mp_mentor_update on mentor_prep;
create policy mp_mentor_update on mentor_prep for update to authenticated
  using      (rt_role()::text = 'mentor' and mentor_id = rt_person_id())
  with check (rt_role()::text = 'mentor' and mentor_id = rt_person_id());

notify pgrst, 'reload schema';
select 'mentor role + mentor_prep ready ✓' as ok;
