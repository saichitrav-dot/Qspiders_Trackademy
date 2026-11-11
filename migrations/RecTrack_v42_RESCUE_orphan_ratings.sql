-- ============================================================================
--  Trackademy v42 — RESCUE orphaned ratings (recover the SCORES, not the names)
--
--  Use this INSTEAD OF RecTrack_v42_cleanup_orphan_ratings.sql when you want to
--  keep the ratings that were orphaned by a course delete+re-add.
--
--  How it works: each orphaned rating still records the OLD topic's id in
--  node_id. This re-creates a placeholder syllabus row with that exact old id, so
--  the ratings re-attach and become visible again WITH their scores and remarks.
--  The original topic NAMES were deleted and cannot be recovered, so the rows come
--  back under a "⚠ Recovered" subject with generic topic labels (a remark is used
--  as a hint when present). Re-file each onto the correct real topic, then delete
--  the "⚠ Recovered" subject from the Course tab (that also clears these rows).
--
--  Idempotent / safe to re-run (only creates rows for ids not already present).
--  Run once in the Supabase SQL editor. Do NOT also run the cleanup script.
-- ============================================================================

-- how many orphaned topics (distinct) and ratings will be recovered:
select count(distinct node_id) as orphan_topics, count(*) as orphan_ratings
  from pj_rating r where not exists (select 1 from pj_syllabus s where s.id = r.node_id);

-- re-create a placeholder topic per orphaned node id (keeps its old id).
insert into pj_syllabus (id, subject_id, subject, chapter, topic, subtopic, ord)
select n.node_id, n.subject_id, '⚠ Recovered', '—',
       coalesce(nullif(trim(n.hint), ''), 'Topic ' || left(n.node_id::text, 8)), '—', null
  from (
    select r.node_id,
           (array_agg(r.subject_id) filter (where r.subject_id is not null))[1] as subject_id,
           (array_agg(r.remark)     filter (where r.remark is not null))[1]     as hint
      from pj_rating r
     where not exists (select 1 from pj_syllabus s where s.id = r.node_id)
     group by r.node_id
  ) n
 where n.subject_id is not null
   and not exists (select 1 from pj_syllabus s where s.id = n.node_id);

select 'orphaned ratings re-attached under “⚠ Recovered” ✓ — re-file them, then delete that subject' as ok;
