-- ============================================================
--  Trackademy v7 — trainer assignment across the FULL tree
--  Program > Subject > Chapter > Topic > Sub-topic — inheritance + override.
--  Most-specific assignment wins. A delegable "Can assign" permission controls
--  who may set/override it (Program Head always; others only if granted).
--  Additive & safe to re-run.
-- ============================================================

-- 1) delegable permission: who may assign / reassign
alter table person add column if not exists can_assign boolean not null default false;

-- 2) a "default trainer" at each level (sub-topic already has content_item.planned_trainer_id)
alter table main_subject add column if not exists default_trainer_id uuid references person(id) on delete set null;
alter table subject      add column if not exists default_trainer_id uuid references person(id) on delete set null;
alter table chapter      add column if not exists default_trainer_id uuid references person(id) on delete set null;
alter table topic        add column if not exists default_trainer_id uuid references person(id) on delete set null;

-- 3) who can assign?  admin OR person.can_assign
create or replace function rt_can_assign() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' or can_assign from person where auth_user_id = auth.uid()), false);
$$;

-- 4) the ONLY way an assignment is written — permission-checked, runs as definer
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
    when 'program'  then update main_subject set default_trainer_id = trainer where id = ref_id;
    when 'subject'  then update subject      set default_trainer_id = trainer where id = ref_id;
    when 'chapter'  then update chapter       set default_trainer_id = trainer where id = ref_id;
    when 'topic'    then update topic         set default_trainer_id = trainer where id = ref_id;
    when 'subtopic' then update content_item  set planned_trainer_id = trainer where id = ref_id;
    else raise exception 'Bad scope: %', scope;
  end case;
end $$;
grant execute on function rt_can_assign()                  to authenticated;
grant execute on function rt_set_owner(text, uuid, uuid)   to authenticated;

-- 5) effective owner per sub-topic (most specific wins) + which level it came from
create or replace view v_item_owner as
  select ci.id as content_item_id,
         coalesce(ci.planned_trainer_id, t.default_trainer_id, c.default_trainer_id, s.default_trainer_id, ms.default_trainer_id) as trainer_id,
         case
           when ci.planned_trainer_id is not null then 'Sub-topic'
           when t.default_trainer_id  is not null then 'Topic'
           when c.default_trainer_id  is not null then 'Chapter'
           when s.default_trainer_id  is not null then 'Subject'
           when ms.default_trainer_id is not null then 'Program'
           else null end as level
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
  (select count(*) from person where can_assign)                       as delegated_assigners,
  (select count(*) from v_item_owner where trainer_id is not null)     as items_with_owner;
