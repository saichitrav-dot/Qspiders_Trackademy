-- ============================================================
--  Trackademy v5 (CLEAN / PRODUCTION) — Asset Management + Reviewer feedback
--  Same structure as RecTrack_v5.sql but with NO sample/demo data.
--  Use this one when standing up a fresh production project.
--  Additive & safe to re-run.
-- ============================================================

-- 1) ---------- ASSET MANAGEMENT (admin-managed inventory) ----------
create table if not exists asset (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Equipment',
  location text,
  qty_total int not null default 0 check (qty_total >= 0),
  qty_damaged int not null default 0 check (qty_damaged >= 0),
  status text not null default 'Operational',
  notes text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table asset add column if not exists qty_in_use int not null default 0 check (qty_in_use >= 0);
alter table asset enable row level security;

drop policy if exists asset_read on asset;
create policy asset_read on asset for select to authenticated using (true);
do $$
begin
  drop policy if exists asset_admin on asset;
  if exists (select 1 from pg_proc where proname = 'rt_role') then
    execute 'create policy asset_admin on asset for all to authenticated using (rt_role()=''admin'') with check (rt_role()=''admin'')';
  else
    execute 'create policy asset_admin on asset for all to authenticated using (true) with check (true)';
  end if;
end $$;

-- 2) ---------- ASSET ACTIVITY LOG (date-wise events) ----------
create table if not exists asset_event (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references asset(id) on delete cascade,
  event_date date not null default current_date,
  event_type text not null,
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

-- 3) ---------- REVIEWER FEEDBACK on recordings ----------
alter table video_version add column if not exists feedback text;

-- 4) ---------- reload the API schema cache ----------
notify pgrst, 'reload schema';

-- 5) ---------- VERIFICATION (expect zeros on a fresh project) ----------
select
  (select count(*) from asset)        as asset_rows,
  (select count(*) from asset_event)  as asset_event_rows;
