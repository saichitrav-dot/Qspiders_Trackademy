-- ============================================================
--  RecTrack — database schema v1  (Supabase / PostgreSQL)
--  Run this whole file in: Supabase Dashboard → SQL Editor → Run
--  Safe to re-run (idempotent). Keys are UUID. Guard-rails enforced.
-- ============================================================

create extension if not exists pgcrypto;     -- gen_random_uuid()
create extension if not exists btree_gist;    -- studio/trainer clash prevention

-- ---------- ENUMS (canonical vocabularies — no synonyms) ----------
do $$ begin
  if not exists (select 1 from pg_type where typname='stage_status') then
    create type stage_status as enum ('Not Started','In Progress','Blocked','Completed'); end if;
  if not exists (select 1 from pg_type where typname='slot_status') then
    create type slot_status as enum ('Scheduled','In Progress','Completed','Missed','Rescheduled','Swapped'); end if;
  if not exists (select 1 from pg_type where typname='recording_status') then
    create type recording_status as enum ('Not Started','Recording Started','Recording In Progress','Recording Completed'); end if;
  if not exists (select 1 from pg_type where typname='editing_status') then
    create type editing_status as enum ('Not Started','In Progress','Rework','Completed'); end if;
  if not exists (select 1 from pg_type where typname='review_type') then
    create type review_type as enum ('Shooting Review','Final Review'); end if;
  if not exists (select 1 from pg_type where typname='review_status') then
    create type review_status as enum ('Pending','Approved','Rejected','Rework'); end if;
  if not exists (select 1 from pg_type where typname='quality_rating') then
    create type quality_rating as enum ('Excellent','Good','Average','Poor'); end if;
  if not exists (select 1 from pg_type where typname='person_role') then
    create type person_role as enum ('admin','trainer','editor','reviewer','manager'); end if;
  if not exists (select 1 from pg_type where typname='trainer_type') then
    create type trainer_type as enum ('Internal','External'); end if;
end $$;

-- ---------- CONFIG (rules as data, not code) ----------
create table if not exists app_config (
  key   text primary key,
  value text not null,
  notes text
);
insert into app_config(key,value,notes) values
 ('sla_window_days','2','turnaround window allowed per stage'),
 ('workday_start','08:30','first slot start'),
 ('workday_end','20:30','last slot end'),
 ('slot_length_hours','2','length of one recording slot'),
 ('on_window_target','0.85','min on-window % per person'),
 ('rework_target','0.05','max acceptable rework rate'),
 ('reminder_lead_min','15','pre-slot reminder lead time'),
 ('notify_channel','email','WhatsApp deferred to v3')
on conflict (key) do nothing;

-- ---------- REFERENCE ----------
create table if not exists studio (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort int not null default 0
);
insert into studio(name,sort) values ('Studio 1',1),('Studio 2',2),('Studio 3',3),('Studio 4',4)
on conflict (name) do nothing;

create table if not exists stage (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sequence int not null unique,
  weight numeric(4,2) not null default 0 check (weight >= 0 and weight <= 1),
  is_gate boolean not null default false,
  sla_days int not null default 2 check (sla_days >= 0)
);
insert into stage(code,name,sequence,weight,is_gate,sla_days) values
 ('PPT','PPT',1,0.20,false,2),
 ('SCRIPT','Script',2,0.20,false,2),
 ('PRESENTATION','Presentation',3,0.15,false,2),
 ('SHOOTING','Shooting',4,0.25,false,2),
 ('SHOOT_REVIEW','Shooting Review',5,0.00,true,1),
 ('EDITING','Editing',6,0.10,false,2),
 ('FINAL_REVIEW','Final Review',7,0.10,true,1)
on conflict (code) do nothing;

-- ---------- PEOPLE ----------
create table if not exists person (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text not null unique,
  role person_role not null,
  trainer_type trainer_type,
  launch_phase int not null default 1 check (launch_phase in (1,2)),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- CURRICULUM (each child stores its parent key = FK) ----------
create table if not exists main_subject (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort int not null default 0
);
create table if not exists subject (
  id uuid primary key default gen_random_uuid(),
  main_subject_id uuid not null references main_subject(id) on delete cascade,
  name text not null, sequence int not null default 0,
  unique (main_subject_id, name)
);
create table if not exists chapter (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subject(id) on delete cascade,
  name text not null, sequence int not null default 0,
  unique (subject_id, name)
);
create table if not exists topic (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapter(id) on delete cascade,
  name text not null, sequence int not null default 0,
  unique (chapter_id, name)
);
create table if not exists subtopic (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topic(id) on delete cascade,
  name text not null, sequence int not null default 0,
  unique (topic_id, name, sequence)
);

-- ---------- SPINE: one content_item per sub-topic ----------
create table if not exists content_item (
  id uuid primary key default gen_random_uuid(),
  subtopic_id uuid not null unique references subtopic(id) on delete cascade,
  planned_trainer_id uuid references person(id) on delete set null,
  start_date date,
  target_end_date date,
  notes text,
  created_at timestamptz not null default now(),
  check (target_end_date is null or start_date is null or target_end_date >= start_date)
);

-- ---------- PIPELINE: 7 stage-rows per item (status, owner, SLA) ----------
create table if not exists item_stage (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_item(id) on delete cascade,
  stage_id uuid not null references stage(id),
  status stage_status not null default 'Not Started',
  owner_id uuid references person(id) on delete set null,
  started_on date, due_on date, completed_on date,
  breached boolean not null default false,
  delay_days int not null default 0,
  remarks text,
  unique (content_item_id, stage_id)
);

-- ---------- SLOT + the booking guard-rails you asked about ----------
create table if not exists slot (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  studio_id uuid not null references studio(id),
  trainer_id uuid references person(id) on delete set null,
  content_item_id uuid references content_item(id) on delete set null,
  slot_status slot_status not null default 'Scheduled',
  recording_status recording_status not null default 'Not Started',
  reason_missed text,
  revised_date date,
  delay_days int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references person(id) on delete set null,
  constraint slot_time_valid    check (end_time > start_time),
  constraint slot_within_hours  check (start_time >= time '08:30' and end_time <= time '20:30'),
  -- ❶ a studio can't hold two overlapping recordings
  constraint no_studio_double_book exclude using gist (
     studio_id with =, tsrange((slot_date + start_time),(slot_date + end_time)) with &&),
  -- ❷ a trainer can't be in two studios at once
  constraint no_trainer_double_book exclude using gist (
     trainer_id with =, tsrange((slot_date + start_time),(slot_date + end_time)) with &&)
     where (trainer_id is not null)
);

-- ---------- OUTPUTS ----------
create table if not exists video_version (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_item(id) on delete cascade,
  slot_id uuid references slot(id) on delete set null,
  version_no int not null default 1,
  file_link text,
  duration_min int check (duration_min is null or duration_min >= 0),
  quality_rating quality_rating,
  recorded_on date,
  created_at timestamptz not null default now(),
  unique (content_item_id, version_no)
);
create table if not exists editing_task (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references video_version(id) on delete cascade,
  editor_id uuid references person(id) on delete set null,
  status editing_status not null default 'Not Started',
  started_on date, due_on date, completed_on date
);
create table if not exists review (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references video_version(id) on delete cascade,
  review_type review_type not null,
  reviewer_id uuid references person(id) on delete set null,
  status review_status not null default 'Pending',
  decided_on date, remarks text
);

-- ---------- INDEXES ----------
create index if not exists ix_subject_main on subject(main_subject_id);
create index if not exists ix_chapter_subject on chapter(subject_id);
create index if not exists ix_topic_chapter on topic(chapter_id);
create index if not exists ix_subtopic_topic on subtopic(topic_id);
create index if not exists ix_istage_item on item_stage(content_item_id);
create index if not exists ix_slot_date on slot(slot_date);
create index if not exists ix_slot_studio_date on slot(studio_id, slot_date);
create index if not exists ix_slot_trainer_date on slot(trainer_id, slot_date);
create index if not exists ix_video_item on video_version(content_item_id);

-- ---------- AUTO: seed 7 stage-rows for each new content_item ----------
create or replace function rt_seed_item_stages() returns trigger language plpgsql as $$
begin
  insert into item_stage(content_item_id, stage_id) select new.id, s.id from stage s;
  return new;
end $$;
drop trigger if exists trg_seed_item_stages on content_item;
create trigger trg_seed_item_stages after insert on content_item
for each row execute function rt_seed_item_stages();

-- ---------- AUTO: maintain SLA window (due_on / breached / delay_days) ----------
create or replace function rt_item_stage_sla() returns trigger language plpgsql as $$
declare win int;
begin
  select sla_days into win from stage where id = new.stage_id;
  if new.started_on is not null and new.due_on is null then
     new.due_on := new.started_on + coalesce(win,2);
  end if;
  if new.status = 'Completed' then
     if new.completed_on is null then new.completed_on := current_date; end if;
     new.breached := (new.due_on is not null and new.completed_on > new.due_on);
     new.delay_days := greatest(0, coalesce(new.completed_on - new.due_on,0));
  else
     new.breached := (new.due_on is not null and current_date > new.due_on);
     new.delay_days := case when new.breached then current_date - new.due_on else 0 end;
  end if;
  return new;
end $$;
drop trigger if exists trg_item_stage_sla on item_stage;
create trigger trg_item_stage_sla before insert or update on item_stage
for each row execute function rt_item_stage_sla();

-- ---------- COMPUTED VIEWS (completion % — never stored by hand) ----------
create or replace view v_item_completion as
  select ci.id as content_item_id,
         coalesce(sum(case when ist.status='Completed' then st.weight else 0 end),0) as completion
  from content_item ci
  join item_stage ist on ist.content_item_id = ci.id
  join stage st on st.id = ist.stage_id
  group by ci.id;

create or replace view v_subject_completion as
  select s.id as subject_id, s.name,
         round(avg(vic.completion)*100,1) as completion_pct,
         count(*) as items
  from subject s
  join chapter c on c.subject_id = s.id
  join topic t on t.chapter_id = c.id
  join subtopic st on st.topic_id = t.id
  join content_item ci on ci.subtopic_id = st.id
  join v_item_completion vic on vic.content_item_id = ci.id
  group by s.id, s.name;

-- ---------- ROW-LEVEL SECURITY (so the anon key alone sees nothing) ----------
create or replace function rt_role() returns person_role
  language sql stable security definer set search_path = public as $$
  select role from person where auth_user_id = auth.uid() $$;
create or replace function rt_person_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from person where auth_user_id = auth.uid() $$;

do $$
declare t text;
begin
  foreach t in array array['app_config','studio','stage','person','main_subject','subject',
     'chapter','topic','subtopic','content_item','item_stage','slot','video_version','editing_task','review'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists rt_read on %I;', t);
    execute format('create policy rt_read on %I for select to authenticated using (true);', t);
    execute format('drop policy if exists rt_admin_all on %I;', t);
    execute format('create policy rt_admin_all on %I for all to authenticated using (rt_role()=''admin'') with check (rt_role()=''admin'');', t);
  end loop;
end $$;

-- role-specific write access (baseline — refine after review)
drop policy if exists rt_trainer_slot on slot;
create policy rt_trainer_slot on slot for update to authenticated
  using (rt_role()='trainer' and trainer_id = rt_person_id())
  with check (rt_role()='trainer' and trainer_id = rt_person_id());

drop policy if exists rt_owner_stage on item_stage;
create policy rt_owner_stage on item_stage for update to authenticated
  using (rt_role() in ('trainer','editor','reviewer') and owner_id = rt_person_id())
  with check (true);

drop policy if exists rt_editor_task on editing_task;
create policy rt_editor_task on editing_task for all to authenticated
  using (rt_role()='editor') with check (rt_role()='editor');

drop policy if exists rt_reviewer_review on review;
create policy rt_reviewer_review on review for all to authenticated
  using (rt_role()='reviewer') with check (rt_role()='reviewer');

-- ============================================================
--  Done. Guard-rails active: UUID keys · enforced foreign keys ·
--  no studio double-booking · no trainer double-booking ·
--  slots only 08:30–20:30 · valid time range · weighted completion ·
--  auto SLA window · row-level security.
-- ============================================================
