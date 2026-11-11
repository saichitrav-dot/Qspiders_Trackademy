-- ============================================================================
--  Trackademy v42 — clean up orphaned ratings / progress
--
--  pj_rating.node_id and pj_progress.node_id reference a syllabus row but have
--  NO foreign key, so deleting a course (e.g. the Python course by mistake) left
--  ratings/progress pointing at topics that no longer exist. Re-adding the course
--  created brand-new topic ids, so those old ratings can't re-attach — they show
--  as ratings with a blank topic. This removes those orphans.
--
--  NOTE: the orphaned ratings cannot be re-linked to the re-added topics (the
--  topic they pointed at was deleted and carried no text on the rating). After
--  running this, re-enter the affected ratings against the new topics.
--
--  Idempotent / safe to re-run. Run once in the Supabase SQL editor.
-- ============================================================================

-- 1) See the damage first (how many orphans, by nothing-but-count):
select 'orphan ratings' as what, count(*) as rows
  from pj_rating r where not exists (select 1 from pj_syllabus s where s.id = r.node_id)
union all
select 'orphan progress', count(*)
  from pj_progress p where not exists (select 1 from pj_syllabus s where s.id = p.node_id);

-- 2) Remove the orphans.
delete from pj_rating   r where not exists (select 1 from pj_syllabus s where s.id = r.node_id);
delete from pj_progress p where not exists (select 1 from pj_syllabus s where s.id = p.node_id);

select 'orphan ratings/progress cleaned ✓' as ok;
