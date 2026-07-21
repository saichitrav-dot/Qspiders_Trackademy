-- ============================================================
--  Trackademy — PRODUCTION bootstrap (run LAST, on the fresh project only)
--  Creates the first Program Head (admin) so someone can sign in to the
--  otherwise-empty system. Everyone else is added in-app via Manage → Team.
--
--  >>> EDIT the two values below before running. <<<
--      Use the REAL work email your wife will sign in with (lowercase).
-- ============================================================

insert into person (full_name, email, role, is_active)
values (
  'Program Head',                              -- <-- her display name
  'replace-with-real-email@qspiders.com'       -- <-- her login email (lowercase)
, 'admin', true)
on conflict (email) do update
  set role = 'admin', is_active = true, full_name = excluded.full_name;

-- confirm exactly one admin exists
select id, full_name, email, role from person where role = 'admin';
