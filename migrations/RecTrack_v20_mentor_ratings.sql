-- ============================================================
--  Trackademy v20 — mentor ratings + audit + program tie  (Phase 2)
--   Run once in Supabase SQL Editor. 100% ADDITIVE & SAFE:
--   only adds columns/tables — nothing existing is touched, dropped or renamed.
--   Safe to re-run.
-- ============================================================

-- 1) single-domain: a mentor's one training program
alter table person add column if not exists program_id uuid references main_subject(id) on delete set null;

-- 2) mentor_prep lifecycle / audit (who assigned, withdraw-with-reason, lead send-back remark)
alter table mentor_prep add column if not exists assigned_by    uuid references person(id) on delete set null;
alter table mentor_prep add column if not exists state          text not null default 'active';   -- 'active' | 'withdrawn'
alter table mentor_prep add column if not exists withdrawn_by    uuid references person(id) on delete set null;
alter table mentor_prep add column if not exists withdrawn_at    timestamptz;
alter table mentor_prep add column if not exists withdraw_reason text;
alter table mentor_prep add column if not exists lead_remark     text;

-- 3) tunable weighting framework (admin can re-tune the weights later)
create table if not exists rating_weight (
  category text primary key,
  label    text not null,
  kind     text not null default 'performance',  -- 'performance' | 'etiquette' | 'mock'
  weight   numeric not null default 1,
  sort     int not null default 0
);
insert into rating_weight (category, label, kind, weight, sort) values
  ('technical',        'Technical competency',         'performance', 30, 1),
  ('presentation',     'Presentation skills',          'performance', 25, 2),
  ('discipline_prof',  'Discipline & professionalism', 'performance', 25, 3),
  ('mock_performance', 'Mock training performance',    'performance', 20, 4),
  ('punctuality',      'Punctuality',                  'etiquette',    1, 5),
  ('discipline',       'Discipline',                   'etiquette',    1, 6),
  ('dedication',       'Dedication',                   'etiquette',    1, 7),
  ('attire',           'Executive attire',             'etiquette',    1, 8),
  ('mock_session',     'Mock session (daily)',         'mock',         1, 9)
on conflict (category) do nothing;

alter table rating_weight enable row level security;
drop policy if exists rw_read on rating_weight;
create policy rw_read on rating_weight for select to authenticated using (true);
drop policy if exists rw_manage on rating_weight;
create policy rw_manage on rating_weight for all to authenticated
  using (rt_role()::text = 'admin') with check (rt_role()::text = 'admin');

-- 4) the ratings log (one row per category per rating — drives the averages)
create table if not exists mentor_rating (
  id              uuid primary key default gen_random_uuid(),
  mentor_id       uuid not null references person(id) on delete cascade,
  rated_by        uuid references person(id) on delete set null,
  rated_on        date not null default current_date,
  scope_level     text not null default 'topic',   -- 'subject' | 'topic' | 'subtopic' | 'general'
  scope_id        uuid,
  category        text not null,
  score           numeric,
  weight_snapshot numeric,
  remarks         text,
  created_at      timestamptz not null default now()
);
create index if not exists ix_mentor_rating_mentor on mentor_rating(mentor_id);

alter table mentor_rating enable row level security;
drop policy if exists mr_read on mentor_rating;
create policy mr_read on mentor_rating for select to authenticated using (true);
drop policy if exists mr_manage on mentor_rating;
create policy mr_manage on mentor_rating for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

notify pgrst, 'reload schema';
select 'mentor_rating + rating_weight + prep audit + program tie ready ✓' as ok;
