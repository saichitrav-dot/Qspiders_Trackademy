-- ============================================================
--  RecTrack v3 — editing-team capture fields (additive, safe to re-run)
--  Run in Supabase SQL Editor.
-- ============================================================
alter table editing_task alter column video_id drop not null;
alter table editing_task add column if not exists content_item_id uuid references content_item(id) on delete cascade;
alter table editing_task add column if not exists date_of_shoot date;
alter table editing_task add column if not exists file_transfer_min int;
alter table editing_task add column if not exists proxy_min int;
alter table editing_task add column if not exists clip_duration_min numeric(6,1);
alter table editing_task add column if not exists edit_min int;
alter table editing_task add column if not exists review_min int;
alter table editing_task add column if not exists final_output text default 'Pending';
create unique index if not exists ux_editing_task_item on editing_task(content_item_id);
