-- ============================================================
--  Trackademy v6 — edit rights follow the Menu-Access matrix + editor feedback
--
--  MODEL: each role can SAVE on a screen exactly when the Menu-Access matrix
--  grants that role access to the screen. Program Head (admin) always has access.
--  A role with no explicit row for a menu = allowed (the same default the app uses);
--  uncheck it in Manage → Menu access to take the right away.
--
--  Sensitive config stays Program-Head-only (so nobody can self-promote):
--  people & their roles, the access matrix, studios, and the curriculum structure.
--
--  Additive & safe to re-run.
-- ============================================================

-- helper: does the current user's role have access to a given menu?
create or replace function rt_can(menu text) returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when rt_role() = 'admin' then true
    when rt_role() is null then false
    else coalesce((select allowed from role_access where role = rt_role() and menu_key = menu), true)
  end;
$$;

-- ---- clean up earlier/narrower policies so this file is the single source ----
do $$
declare t text;
begin
  foreach t in array array['item_stage','content_item','video_version','editing_task','review','slot','asset','asset_event'] loop
    execute format('drop policy if exists rt_team_write on %I;', t);
  end loop;
end $$;
drop policy if exists rt_owner_stage    on item_stage;
drop policy if exists rt_editor_task     on editing_task;
drop policy if exists rt_reviewer_review on review;
drop policy if exists rt_trainer_slot    on slot;

-- ---- write policies, aligned to the screen each table is edited from ----

-- Pipeline status — edited on Content / Editing / Reviews
drop policy if exists rt_acc_stage on item_stage;
create policy rt_acc_stage on item_stage for all to authenticated
  using (rt_can('/content') or rt_can('/editing') or rt_can('/reviews'))
  with check (rt_can('/content') or rt_can('/editing') or rt_can('/reviews'));

-- Content-item details / custom fields — edited on Content
drop policy if exists rt_acc_content on content_item;
create policy rt_acc_content on content_item for all to authenticated
  using (rt_can('/content') or rt_can('/manage'))
  with check (rt_can('/content') or rt_can('/manage'));

-- Recording quality + feedback — Reviews
drop policy if exists rt_acc_video on video_version;
create policy rt_acc_video on video_version for all to authenticated
  using (rt_can('/reviews')) with check (rt_can('/reviews'));

-- Editing capture — Editing
drop policy if exists rt_acc_task on editing_task;
create policy rt_acc_task on editing_task for all to authenticated
  using (rt_can('/editing')) with check (rt_can('/editing'));

-- Review records — Reviews
drop policy if exists rt_acc_review on review;
create policy rt_acc_review on review for all to authenticated
  using (rt_can('/reviews')) with check (rt_can('/reviews'));

-- Slots (booking + recording status) — Studio Board / My Day
drop policy if exists rt_acc_slot on slot;
create policy rt_acc_slot on slot for all to authenticated
  using (rt_can('/studio') or rt_can('/myday'))
  with check (rt_can('/studio') or rt_can('/myday'));

-- Asset inventory + activity log — Assets
drop policy if exists rt_acc_asset on asset;
create policy rt_acc_asset on asset for all to authenticated
  using (rt_can('/assets')) with check (rt_can('/assets'));
drop policy if exists rt_acc_asset_event on asset_event;
create policy rt_acc_asset_event on asset_event for all to authenticated
  using (rt_can('/assets')) with check (rt_can('/assets'));

-- NOTE: person, role_access, custom_field, studio, and the curriculum tables
-- (main_subject/subject/chapter/topic/subtopic) intentionally stay admin-only
-- via the existing rt_admin_all policy — these are Program-Head functions.

-- ---- editor feedback column ----
alter table editing_task add column if not exists editor_feedback text;

-- reload API cache
notify pgrst, 'reload schema';

-- verification (you should see a row of numbers)
select
  (select count(*) from item_stage)  as item_stage_rows,
  (select count(*) from editing_task) as editing_tasks,
  (select count(*) from role_access)  as access_rules;
