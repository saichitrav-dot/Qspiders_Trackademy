-- ============================================================
--  Trackademy v10 — TAT analytics groundwork
--   • Per-stage TAT already exists as stage.sla_days (set in Manage → TAT).
--   • Program-level DUE DATE (absolute target; auto-suggested in UI, override-able).
--   • Assignment TIMESTAMPS — the overall TAT clock for an item starts the
--     moment a trainer is assigned (your chosen anchor). Stamped by rt_set_owner,
--     preserved on re-assignment, cleared on un-assignment.
--  Additive & safe to re-run. Admin (Program Head) writes are already allowed
--  by the rt_admin_all policy on main_subject / stage.
-- ============================================================

-- 1) Program-level due date + how it was set (manual override vs auto-suggested)
alter table main_subject add column if not exists due_date date;
alter table main_subject add column if not exists due_date_manual boolean not null default false;

-- 2) "assigned at" timestamp at every assignment level (mirrors default_trainer_id from v7)
alter table main_subject add column if not exists assigned_at timestamptz;
alter table subject      add column if not exists assigned_at timestamptz;
alter table chapter      add column if not exists assigned_at timestamptz;
alter table topic        add column if not exists assigned_at timestamptz;
alter table content_item add column if not exists assigned_at timestamptz;

-- 3) rt_set_owner now stamps assigned_at: set on first assignment, kept on
--    re-assignment (clock does NOT reset), cleared when the owner is removed.
create or replace function rt_set_owner(scope text, ref_id uuid, trainer uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not rt_can_assign() then
    raise exception 'Not allowed: your role cannot assign topics.';
  end if;
  if trainer is not null and not exists (select 1 from person where id = trainer) then
    raise exception 'Unknown trainer.';
  end if;
  case scope
    when 'program'  then update main_subject set default_trainer_id = trainer,
                            assigned_at = case when trainer is null then null else coalesce(assigned_at, now()) end where id = ref_id;
    when 'subject'  then update subject      set default_trainer_id = trainer,
                            assigned_at = case when trainer is null then null else coalesce(assigned_at, now()) end where id = ref_id;
    when 'chapter'  then update chapter      set default_trainer_id = trainer,
                            assigned_at = case when trainer is null then null else coalesce(assigned_at, now()) end where id = ref_id;
    when 'topic'    then update topic        set default_trainer_id = trainer,
                            assigned_at = case when trainer is null then null else coalesce(assigned_at, now()) end where id = ref_id;
    when 'subtopic' then update content_item set planned_trainer_id = trainer,
                            assigned_at = case when trainer is null then null else coalesce(assigned_at, now()) end where id = ref_id;
    else raise exception 'Bad scope: %', scope;
  end case;
end $$;
grant execute on function rt_set_owner(text, uuid, uuid) to authenticated;

-- 4) effective owner + WHEN it was assigned (most-specific wins) — for future analytics
--    drop+recreate (not "create or replace") so a changed column list is allowed;
--    grants are re-applied below. Nothing in the DB depends on this view.
drop view if exists v_item_owner;
create view v_item_owner as
  select ci.id as content_item_id,
         coalesce(ci.planned_trainer_id, t.default_trainer_id, c.default_trainer_id, s.default_trainer_id, ms.default_trainer_id) as trainer_id,
         case
           when ci.planned_trainer_id is not null then 'Sub-topic'
           when t.default_trainer_id  is not null then 'Topic'
           when c.default_trainer_id  is not null then 'Chapter'
           when s.default_trainer_id  is not null then 'Subject'
           when ms.default_trainer_id is not null then 'Program'
           else null end as level,
         case
           when ci.planned_trainer_id is not null then ci.assigned_at
           when t.default_trainer_id  is not null then t.assigned_at
           when c.default_trainer_id  is not null then c.assigned_at
           when s.default_trainer_id  is not null then s.assigned_at
           when ms.default_trainer_id is not null then ms.assigned_at
           else null end as assigned_at
  from content_item ci
  join subtopic st  on st.id = ci.subtopic_id
  join topic t      on t.id  = st.topic_id
  join chapter c    on c.id  = t.chapter_id
  join subject s    on s.id  = c.subject_id
  join main_subject ms on ms.id = s.main_subject_id;
grant select on v_item_owner to authenticated, anon;

notify pgrst, 'reload schema';

-- verification — expect a row of numbers
select
  (select sum(sla_days) from stage)                                  as total_stage_tat_days,
  (select count(*) from main_subject where due_date is not null)     as programs_with_due_date,
  (select count(*) from v_item_owner where assigned_at is not null)  as items_with_assigned_at;
