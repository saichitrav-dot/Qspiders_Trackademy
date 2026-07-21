-- ============================================================
--  DATA FIX (one-time) — mark EVERY stage Completed (incl. Final Review)
--  for all sub-topics under the "Software Testing" program (Non-ELP).
--
--  ⚠️ This UPDATES PRODUCTION DATA. Review first. Back up if unsure.
--  Adjust the program name in the WHERE clause if it differs.
--  Run in Supabase SQL Editor.
-- ============================================================

-- 1) sanity check — see what will be affected BEFORE updating:
select ms.name as program, count(distinct ci.id) as sub_topics, count(is2.id) as stage_rows
from main_subject ms
join subject      s   on s.main_subject_id = ms.id
join chapter      ch  on ch.subject_id = s.id
join topic        t   on t.chapter_id = ch.id
join subtopic     st  on st.topic_id = t.id
join content_item ci  on ci.subtopic_id = st.id
join item_stage   is2 on is2.content_item_id = ci.id
where lower(ms.name) like '%software testing%'
group by ms.name;

-- 2) the update — all stages (Shooting, Shooting Review, Editing, Final Review, …) → Completed
update item_stage
set status = 'Completed',
    completed_on = coalesce(completed_on, current_date)
where content_item_id in (
  select ci.id
  from main_subject ms
  join subject      s  on s.main_subject_id = ms.id
  join chapter      ch on ch.subject_id = s.id
  join topic        t  on t.chapter_id = ch.id
  join subtopic     st on st.topic_id = t.id
  join content_item ci on ci.subtopic_id = st.id
  where lower(ms.name) like '%software testing%'
);

select 'Software Testing — all stages set to Completed ✓' as ok;
