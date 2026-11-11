-- ============================================================================
--  Trackademy v42 — clean up orphaned ratings / progress (SCOPED to one course)
--
--  Deleting a course hard-deletes its topics but not the ratings (node_id has no
--  FK), so a delete+re-add (e.g. the Python course) leaves ratings pointing at
--  topics that no longer exist. This removes those orphans — but ONLY inside the
--  one workspace you name, so no other course is touched.
--
--  The orphaned ratings cannot be re-linked (the topic they pointed at is gone),
--  so after cleanup, re-rate the re-added topics in the app.
--
--  Run STEP 1, read the result, then run STEP 2 with that workspace's id.
--  Idempotent / safe to re-run.
-- ============================================================================

-- STEP 1 — see which workspace(s) the orphans are in (expect only Python here):
select coalesce(s.name, '(unknown)') as workspace, r.subject_id, count(*) as orphan_ratings
  from pj_rating r
  left join pj_subject s on s.id = r.subject_id
 where not exists (select 1 from pj_syllabus y where y.id = r.node_id)
 group by s.name, r.subject_id
 order by orphan_ratings desc;

-- STEP 2 — delete orphans ONLY in that workspace. Paste the Python subject_id
--          from STEP 1 into BOTH lines below (replace PASTE_PYTHON_SUBJECT_ID),
--          then run these two statements.
-- delete from pj_rating   r
--  where not exists (select 1 from pj_syllabus s where s.id = r.node_id)
--    and r.subject_id = 'PASTE_PYTHON_SUBJECT_ID';
-- delete from pj_progress p
--  where not exists (select 1 from pj_syllabus s where s.id = p.node_id)
--    and p.subject_id = 'PASTE_PYTHON_SUBJECT_ID';
