-- ============================================================
--  Trackademy v4 — role menu-access + custom fields (additive, safe to re-run)
--  Run in Supabase SQL Editor.
-- ============================================================

-- 1) Menu access by role
create table if not exists role_access (
  role person_role not null,
  menu_key text not null,
  allowed boolean not null default true,
  primary key (role, menu_key)
);
alter table role_access enable row level security;
drop policy if exists ra_read on role_access;
create policy ra_read on role_access for select to authenticated using (true);
drop policy if exists ra_admin on role_access;
create policy ra_admin on role_access for all to authenticated using (rt_role()='admin') with check (rt_role()='admin');

-- 2) Custom fields (attached to sub-topics)
create table if not exists custom_field (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  field_type text not null default 'text',   -- text | number | dropdown
  options text[],
  sort int not null default 0,
  created_at timestamptz default now()
);
alter table custom_field enable row level security;
drop policy if exists cf_read on custom_field;
create policy cf_read on custom_field for select to authenticated using (true);
drop policy if exists cf_admin on custom_field;
create policy cf_admin on custom_field for all to authenticated using (rt_role()='admin') with check (rt_role()='admin');

-- store custom values per sub-topic
alter table content_item add column if not exists custom jsonb not null default '{}'::jsonb;
