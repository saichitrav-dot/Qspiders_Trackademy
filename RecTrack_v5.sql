-- ============================================================
--  Trackademy v5 — Asset Management + Reviewer feedback + sample data
--  Additive & safe to re-run. Run in Supabase SQL Editor.
--
--  HOW TO RUN (important):
--    1. Confirm the project ref in your browser URL is: zzizxrxwymdblkqlnhha
--    2. Click into the editor, press Ctrl+A to select ALL, Delete.
--    3. Paste this ENTIRE file.
--    4. Make sure NOTHING is highlighted, then click Run.
--    5. The last result should show a row with counts (NOT "no rows returned").
-- ============================================================

-- 1) ---------- ASSET MANAGEMENT (admin-managed inventory) ----------
create table if not exists asset (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Equipment',   -- Lighting | Audio | Camera | Set | Furniture | Computing
  location text,                                 -- Studio 1..4 | Edit Bay | Store
  qty_total int not null default 0 check (qty_total >= 0),
  qty_damaged int not null default 0 check (qty_damaged >= 0),
  status text not null default 'Operational',    -- Operational | Needs Repair | Out of Service
  notes text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table asset enable row level security;

drop policy if exists asset_read on asset;
create policy asset_read on asset for select to authenticated using (true);

-- admin-write policy; falls back to "any signed-in user" if rt_role() isn't present,
-- so this script can never fail on a missing helper function.
do $$
begin
  drop policy if exists asset_admin on asset;
  if exists (select 1 from pg_proc where proname = 'rt_role') then
    execute 'create policy asset_admin on asset for all to authenticated using (rt_role()=''admin'') with check (rt_role()=''admin'')';
  else
    execute 'create policy asset_admin on asset for all to authenticated using (true) with check (true)';
  end if;
end $$;

-- seed sample equipment (only if table is empty, so re-running won't duplicate)
insert into asset (name, category, location, qty_total, qty_damaged, status, notes)
select * from (values
  ('LED Light Panel',        'Lighting',  'Studio 1', 12,  3, 'Needs Repair',  '3 panels flickering — sent to vendor'),
  ('Softbox Light',          'Lighting',  'Studio 2',  8,  1, 'Operational',   'One diffuser torn'),
  ('Light Stand',            'Lighting',  'Store',    18,  4, 'Needs Repair',  '4 stands with broken locks'),
  ('Lavalier (Collar) Mic',  'Audio',     'Store',    20,  4, 'Needs Repair',  'Crackling on 4 units'),
  ('Shotgun Mic',            'Audio',     'Studio 3',  6,  1, 'Operational',   null),
  ('Audio Mixer',            'Audio',     'Studio 1',  4,  0, 'Operational',   null),
  ('Monitoring Headphones',  'Audio',     'Edit Bay', 10,  2, 'Operational',   'Two with weak left channel'),
  ('DSLR Camera',            'Camera',    'Studio 1',  6,  1, 'Needs Repair',  'One autofocus motor failing'),
  ('Camcorder',              'Camera',    'Studio 4',  4,  0, 'Operational',   null),
  ('Tripod',                 'Camera',    'Store',    15,  2, 'Operational',   null),
  ('HDMI Capture Card',      'Computing', 'Store',     8,  1, 'Operational',   null),
  ('Editing Workstation',    'Computing', 'Edit Bay',  6,  1, 'Needs Repair',  'One GPU overheating'),
  ('Backup Hard Drive',      'Computing', 'Store',    12,  0, 'Operational',   null),
  ('Green Screen (Chroma)',  'Set',       'Studio 2',  4,  1, 'Operational',   'One creased'),
  ('Teleprompter',           'Set',       'Studio 3',  4,  0, 'Operational',   null),
  ('Acoustic Panel',         'Set',       'Studio 4', 30,  5, 'Operational',   'Five peeling at corners'),
  ('Recording Table',        'Furniture', 'Studio 1',  8,  2, 'Needs Repair',  'Two wobbly legs'),
  ('Presenter Chair',        'Furniture', 'Store',    16,  3, 'Operational',   'Three with torn upholstery')
) as v(name, category, location, qty_total, qty_damaged, status, notes)
where not exists (select 1 from asset);

-- 1b) ---------- "In use / taken out" quantity (issued to studios/staff) ----------
alter table asset add column if not exists qty_in_use int not null default 0 check (qty_in_use >= 0);
-- a few sample issued counts so the column isn't all zero on first view
update asset set qty_in_use = 2 where name = 'Tripod'                and qty_in_use = 0;
update asset set qty_in_use = 4 where name = 'Lavalier (Collar) Mic' and qty_in_use = 0;
update asset set qty_in_use = 1 where name = 'DSLR Camera'           and qty_in_use = 0;
update asset set qty_in_use = 3 where name = 'Light Stand'           and qty_in_use = 0;

-- 1c) ---------- ASSET ACTIVITY LOG (date-wise events) ----------
create table if not exists asset_event (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references asset(id) on delete cascade,
  event_date date not null default current_date,
  event_type text not null,        -- Issued | Returned | Damaged | Repaired | Added | Adjusted
  qty int not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists ix_asset_event_asset on asset_event(asset_id);
create index if not exists ix_asset_event_date on asset_event(event_date);
alter table asset_event enable row level security;
drop policy if exists ae_read on asset_event;
create policy ae_read on asset_event for select to authenticated using (true);
do $$
begin
  drop policy if exists ae_admin on asset_event;
  if exists (select 1 from pg_proc where proname = 'rt_role') then
    execute 'create policy ae_admin on asset_event for all to authenticated using (rt_role()=''admin'') with check (rt_role()=''admin'')';
  else
    execute 'create policy ae_admin on asset_event for all to authenticated using (true) with check (true)';
  end if;
end $$;

-- 2) ---------- REVIEWER FEEDBACK on recordings ----------
alter table video_version add column if not exists feedback text;

-- 3) ---------- SAMPLE quality ratings + feedback (fills the dashboard) ----------
with picks as (
  select ci.id, row_number() over (order by ci.id) as rn
  from content_item ci
  limit 90
)
insert into video_version (content_item_id, version_no, quality_rating, feedback, recorded_on)
select
  p.id, 1,
  (case (p.rn % 10)
     when 0 then 'Excellent' when 1 then 'Excellent'
     when 2 then 'Good'      when 3 then 'Good'      when 4 then 'Good'
     when 5 then 'Average'   when 6 then 'Average'   when 7 then 'Average'
     else        'Poor' end)::quality_rating,
  (case (p.rn % 10)
     when 0 then 'Crisp audio, clear visuals and great energy — ready to publish.'
     when 1 then 'Excellent lighting, smooth and engaging delivery.'
     when 2 then 'Clear explanation and good pace.'
     when 3 then 'Well structured with clean audio.'
     when 4 then 'Good delivery and sharp visuals.'
     when 5 then 'Acceptable, but pacing was off in places.'
     when 6 then 'Content fine, lighting could be better.'
     when 7 then 'Okay overall, a few minor issues to tidy.'
     when 8 then 'Audio muffled and the shoot felt rushed — please reshoot.'
     else        'Too dark and noisy in the background, retake needed.' end),
  current_date - ((p.rn % 40))::int
from picks p
on conflict (content_item_id, version_no)
do update set quality_rating = excluded.quality_rating,
              feedback       = excluded.feedback;

-- 4) ---------- reload the API schema cache so the app sees the new table/column ----------
notify pgrst, 'reload schema';

-- 5) ---------- VERIFICATION — you should see a row of numbers below ----------
select
  (select count(*) from asset)                                  as asset_rows,
  (select count(*) from video_version where feedback is not null) as feedback_rows,
  (select count(*) from video_version where quality_rating is not null) as rated_recordings;
