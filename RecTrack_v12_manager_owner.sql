-- ============================================================
--  Trackademy v12 — managers as scoped subject owners
--   Run ONCE in Supabase → SQL Editor → New query → Run.
--
--   A manager assigned to a level (Program/Subject/Chapter/Topic/Sub-topic)
--   via the Assignments page becomes the OWNER of everything under it.
--   This lets such a manager EDIT stage status for items they own — and
--   ONLY those items (no access to other subjects). Visibility scoping is
--   handled in the app; this adds the matching write permission in the DB.
--  Additive & safe to re-run.
-- ============================================================

-- Does the CURRENT user (by linked person id) own this content item at ANY level?
create or replace function rt_owns_item(p_item uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from content_item ci
    join subtopic st     on st.id = ci.subtopic_id
    join topic t         on t.id  = st.topic_id
    join chapter c       on c.id  = t.chapter_id
    join subject s       on s.id  = c.subject_id
    join main_subject ms on ms.id = s.main_subject_id
    where ci.id = p_item
      and rt_person_id() in (
        ci.planned_trainer_id, t.default_trainer_id, c.default_trainer_id,
        s.default_trainer_id, ms.default_trainer_id
      )
  );
$$;
grant execute on function rt_owns_item(uuid) to authenticated;

-- A manager may update the stage rows of items they own (and nothing else).
drop policy if exists rt_manager_stage on item_stage;
create policy rt_manager_stage on item_stage for update to authenticated
  using      (rt_role() = 'manager' and rt_owns_item(content_item_id))
  with check (rt_role() = 'manager' and rt_owns_item(content_item_id));

notify pgrst, 'reload schema';

-- verify (expects the function to exist)
select 'rt_owns_item installed' as ok
  where exists (select 1 from pg_proc where proname = 'rt_owns_item');
