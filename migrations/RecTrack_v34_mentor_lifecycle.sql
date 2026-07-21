-- ============================================================
--  Trackademy v34 — mentor training-side lifecycle status
--   Adds an explicit TRAINING-side status to each mentor, plus a
--   history/audit log of every transition (who / when / why).
--
--   Lifecycle (training side):
--     in_training  ─▶ ready_to_deploy ─▶ (deploy: handled by
--                     mentor_deployment, v30) ─▶ back to bench ─▶
--                     re-deploy  OR  upskilling ─▶ ready_to_deploy
--     A mentor in_training may exit via:
--        terminated  (performance)      — soft, reversible
--        dropout     (left mid-training) — soft, reversible
--
--   NOTE: "deployed" and "back to bench" are NOT stored here — they
--   are still derived from mentor_deployment (v30). This column only
--   tracks the training-side state so the app can show Ready-to-deploy,
--   Terminated, Dropout and Upskilling buckets that aren't derivable.
--
--   Additive & safe to re-run. Run once in Supabase SQL Editor.
-- ============================================================

-- 1) status columns on person (mentors only; harmless on other roles) -------
alter table person add column if not exists mentor_status        text;
alter table person add column if not exists mentor_status_reason text;
alter table person add column if not exists mentor_status_at      timestamptz;
alter table person add column if not exists mentor_status_by      uuid references person(id) on delete set null;

-- default existing mentors to 'in_training' so the buckets are populated
update person set mentor_status = 'in_training'
  where role = 'mentor' and mentor_status is null;

-- guard the allowed values (drop first so re-runs don't error)
alter table person drop constraint if exists person_mentor_status_chk;
alter table person add  constraint person_mentor_status_chk
  check (mentor_status is null or mentor_status in
    ('in_training','ready_to_deploy','upskilling','terminated','dropout'));

-- 2) transition history (audit) --------------------------------------------
create table if not exists mentor_status_history (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null references person(id) on delete cascade,
  status      text not null,
  reason      text,
  changed_by  uuid references person(id) on delete set null,
  changed_at  timestamptz not null default now()
);
create index if not exists ix_mentor_status_hist_mentor on mentor_status_history(mentor_id);

alter table mentor_status_history enable row level security;

-- everyone signed in can read (buckets + a mentor seeing their own history)
drop policy if exists msh_read on mentor_status_history;
create policy msh_read on mentor_status_history for select to authenticated using (true);

-- admins / managers / team leads record transitions
drop policy if exists msh_manage on mentor_status_history;
create policy msh_manage on mentor_status_history for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

notify pgrst, 'reload schema';
select 'mentor lifecycle status (v34) ready ✓' as ok;
