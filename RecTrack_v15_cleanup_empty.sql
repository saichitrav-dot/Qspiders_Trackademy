-- ============================================================
--  Trackademy v15 — remove EMPTY curriculum branches (one-time cleanup)
--   Cleans up programs/subjects/chapters/topics that have NO content
--   left under them (e.g. "Mobile testing" after its sub-topics were
--   deleted). These empty shells are what still showed in Assignments.
--
--   The app's delete now cleans these up automatically going forward
--   (v-build). This script clears the ones already sitting there.
--
--   ⚠️ Run STEP 1 FIRST and READ the list. Only when you're happy with
--      it, uncomment STEP 2 and run again to actually delete.
-- ============================================================

-- STEP 1 — PREVIEW: everything below has NO content under it and would be removed.
select 'program' as level, m.id, m.name from main_subject m where not exists (select 1 from subject  s where s.main_subject_id = m.id)
union all
select 'subject',  s.id, s.name from subject  s where not exists (select 1 from chapter  c where c.subject_id      = s.id)
union all
select 'chapter',  c.id, c.name from chapter  c where not exists (select 1 from topic    t where t.chapter_id      = c.id)
union all
select 'topic',    t.id, t.name from topic    t where not exists (select 1 from subtopic st where st.topic_id      = t.id)
order by level, name;

-- STEP 2 — DELETE empty branches (bottom-up, only rows with no children).
--   Remove the /*  and  */ to enable, then re-run. Safe: nothing with content is touched.
/*
delete from topic    t where not exists (select 1 from subtopic st where st.topic_id      = t.id);
delete from chapter  c where not exists (select 1 from topic    t  where t.chapter_id      = c.id);
delete from subject  s where not exists (select 1 from chapter  c  where c.subject_id      = s.id);
delete from main_subject m where not exists (select 1 from subject s where s.main_subject_id = m.id);
notify pgrst, 'reload schema';
select 'empty branches removed ✓' as ok;
*/
