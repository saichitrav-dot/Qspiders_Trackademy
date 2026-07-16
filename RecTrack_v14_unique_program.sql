-- ============================================================
--  Trackademy v14 — no duplicate PROGRAMS (program level only)
--   Run ONCE in Supabase → SQL Editor → New query → Run.
--
--   Makes it impossible to create two programs with the same name
--   (case-insensitive) — for uploads, manual creation, even two people
--   at once. Any attempt is rejected with an error. Does NOT touch
--   subject/chapter/topic/sub-topic levels, and does NOT block adding
--   content UNDER an existing program (that reuses it, no new row).
--   Additive & 100% safe to re-run — no data is changed.
-- ============================================================

-- STEP 1 — check for existing duplicates FIRST. If this returns any rows,
--          the unique rule below cannot be created until you merge/rename them.
--          (Expected: zero rows — your 17 programs are all distinct.)
select lower(trim(name)) as program_key, count(*) as copies, string_agg(name, '  |  ') as variants
from main_subject
group by lower(trim(name))
having count(*) > 1;

-- STEP 2 — enforce one program per name (case-insensitive, trim-insensitive).
--          If STEP 1 returned rows this line errors harmlessly (nothing changes) —
--          fix the duplicates, then re-run.
create unique index if not exists ux_main_subject_name_ci on main_subject (lower(trim(name)));

notify pgrst, 'reload schema';

select 'program-name uniqueness enforced ✓' as ok;
