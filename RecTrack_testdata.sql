-- ============================================================
--  RecTrack — test data (safe to re-run)
--  Sets KNOWN stage statuses on 5 sub-topics + 3 slots for today,
--  so you can validate every screen tallies. Run in SQL Editor.
-- ============================================================
begin;

-- Print  → all 7 stages Completed  (fully done, 100%)
update item_stage ist set status = 'Completed'
  from content_item ci join subtopic st on st.id = ci.subtopic_id
  where ist.content_item_id = ci.id and st.name = 'Print';

-- Values  → stages 1-5 done (PPT,Script,Presentation,Shooting,Shoot Review) → ready for EDITING (80%)
update item_stage ist set status = (case when s.sequence <= 5 then 'Completed' else 'Not Started' end)::stage_status
  from content_item ci join subtopic st on st.id = ci.subtopic_id, stage s
  where ist.content_item_id = ci.id and ist.stage_id = s.id and st.name = 'Values';

-- Variable  → stages 1-4 done → pending SHOOT REVIEW (80%)
update item_stage ist set status = (case when s.sequence <= 4 then 'Completed' else 'Not Started' end)::stage_status
  from content_item ci join subtopic st on st.id = ci.subtopic_id, stage s
  where ist.content_item_id = ci.id and ist.stage_id = s.id and st.name = 'Variable';

-- Keywords and Identifiers  → stages 1-6 done → pending FINAL REVIEW (90%)
update item_stage ist set status = (case when s.sequence <= 6 then 'Completed' else 'Not Started' end)::stage_status
  from content_item ci join subtopic st on st.id = ci.subtopic_id, stage s
  where ist.content_item_id = ci.id and ist.stage_id = s.id and st.name = 'Keywords and Identifiers';

-- Operator introduction  → stages 1-2 done → at PRESENTATION (40%)
update item_stage ist set status = (case when s.sequence <= 2 then 'Completed' else 'Not Started' end)::stage_status
  from content_item ci join subtopic st on st.id = ci.subtopic_id, stage s
  where ist.content_item_id = ci.id and ist.stage_id = s.id and st.name = 'Operator introduction';

-- Operator introduction's Presentation stage IN PROGRESS, started 4 days ago → BREACHES the 2-day window
update item_stage ist set status = 'In Progress', started_on = current_date - 4, due_on = null
  from content_item ci join subtopic st on st.id = ci.subtopic_id, stage s
  where ist.content_item_id = ci.id and ist.stage_id = s.id and s.code = 'PRESENTATION' and st.name = 'Operator introduction';

-- 3 slots for TODAY (clear old test slots for these first → re-runnable)
delete from slot where content_item_id in (
  select ci.id from content_item ci join subtopic st on st.id = ci.subtopic_id
  where st.name in ('Print','Variable','Values','If statement'));

insert into slot (slot_date,start_time,end_time,studio_id,trainer_id,content_item_id,slot_status,recording_status)
select current_date,'08:30','10:30',
  (select id from studio where name='Studio 1'),
  (select id from person where full_name='Madhu'),
  (select ci.id from content_item ci join subtopic st on st.id=ci.subtopic_id where st.name='Print'),
  'Completed','Recording Completed';

insert into slot (slot_date,start_time,end_time,studio_id,trainer_id,content_item_id,slot_status,recording_status)
select current_date,'10:30','12:30',
  (select id from studio where name='Studio 2'),
  (select id from person where full_name='Akash'),
  (select ci.id from content_item ci join subtopic st on st.id=ci.subtopic_id where st.name='Variable'),
  'In Progress','Recording In Progress';

insert into slot (slot_date,start_time,end_time,studio_id,trainer_id,content_item_id,slot_status,recording_status)
select current_date,'12:30','14:30',
  (select id from studio where name='Studio 3'),
  (select id from person where full_name='Leo'),
  (select ci.id from content_item ci join subtopic st on st.id=ci.subtopic_id where st.name='Values'),
  'Scheduled','Not Started';

-- a MISSED slot today → a defaulter (with reason captured)
insert into slot (slot_date,start_time,end_time,studio_id,trainer_id,content_item_id,slot_status,recording_status,reason_missed)
select current_date,'14:30','16:30',
  (select id from studio where name='Studio 4'),
  (select id from person where full_name='Amy'),
  (select ci.id from content_item ci join subtopic st on st.id=ci.subtopic_id where st.name='If statement'),
  'Missed','Not Started','Given other training';

commit;

-- ===== what you should now see (validate the tally) =====
select 'Command Center: fully done'  as screen, count(*) as expect_1 from item_stage ist
  join content_item ci on ci.id=ist.content_item_id join subtopic st on st.id=ci.subtopic_id
  where st.name='Print' group by st.name;
