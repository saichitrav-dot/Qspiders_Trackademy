-- ============================================================
--  Trackademy v16 — editor allocation (Editing tab)
--   Links an editor (person) to a subject. Run once in Supabase SQL Editor.
--   Additive & safe to re-run.
-- ============================================================
create table if not exists editor_allocation (
  id         uuid primary key default gen_random_uuid(),
  editor_id  uuid not null references person(id)  on delete cascade,
  subject_id uuid not null references subject(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (editor_id, subject_id)
);

alter table editor_allocation enable row level security;

drop policy if exists ea_read on editor_allocation;
create policy ea_read on editor_allocation for select to authenticated using (true);

drop policy if exists ea_manage on editor_allocation;
create policy ea_manage on editor_allocation for all to authenticated
  using      (rt_role()::text in ('admin','manager','team_lead'))
  with check (rt_role()::text in ('admin','manager','team_lead'));

notify pgrst, 'reload schema';
select 'editor_allocation ready ✓' as ok;
