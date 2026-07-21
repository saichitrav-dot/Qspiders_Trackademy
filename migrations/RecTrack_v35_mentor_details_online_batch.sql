-- ============================================================
--  Trackademy v35 — mentor joining/contact details, "College grooming"
--                   deployment type, and online-batch tracking
--
--   1) person.date_of_joining + person.contact_number  (People → Add/Edit)
--   2) mentor_deployment.deployment_type gains 'College grooming'
--   3) mentor_online_batch — when a deployment is "Online training", the
--      batch is tracked here (batch code / time slot / dates / remarks) and
--      shown against the mentor who availed that training.
--
--   Additive & safe to re-run. Run once in Supabase SQL Editor.
-- ============================================================

-- 1) joining date + contact details -----------------------------------------
alter table person add column if not exists date_of_joining date;
alter table person add column if not exists contact_number  text;

-- 2) allow the new 'College grooming' deployment type ------------------------
--    (drop + recreate the check so re-runs are safe and old rows still pass)
alter table mentor_deployment drop constraint if exists mentor_deployment_deployment_type_check;
alter table mentor_deployment add  constraint mentor_deployment_deployment_type_check
  check (deployment_type in ('Branch','Online training','College','Corporate training','College grooming'));

-- 3) online batch details ----------------------------------------------------
create table if not exists mentor_online_batch (
  id            uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references mentor_deployment(id) on delete cascade,
  mentor_id     uuid not null references person(id) on delete cascade,
  subject       text,
  batch_code    text,
  time_slot     text,
  start_date    date,
  end_date      date,
  remarks       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ix_mentor_online_batch_mentor     on mentor_online_batch(mentor_id);
create index if not exists ix_mentor_online_batch_deployment on mentor_online_batch(deployment_id);

alter table mentor_online_batch enable row level security;

-- everyone signed in can read (the batch table + a mentor seeing their own)
drop policy if exists mob_read on mentor_online_batch;
create policy mob_read on mentor_online_batch for select to authenticated using (true);

-- admins / managers / team leads manage batch rows
drop policy if exists mob_manage on mentor_online_batch;
create policy mob_manage on mentor_online_batch for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

notify pgrst, 'reload schema';
select 'mentor details + college grooming + online batch (v35) ready ✓' as ok;
