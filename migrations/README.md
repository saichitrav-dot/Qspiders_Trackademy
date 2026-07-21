# Database migrations — self-hosted Supabase (`trackademy.onqtrack.com`)

The frontend is a static site; **all data lives in Postgres**. If a feature's tables/columns
aren't in the database, that screen shows **no data** (or a "Run RecTrack_vNN.sql" hint) even
though the UI itself deploys fine. That is the usual cause of "Weekly Goals / Mentor Management
data not showing" on the server.

> ⚠️ Locally these features may look populated because dev runs in **mock mode**
> (`.env.local` with `VITE_MOCK_MENTOR_SUBTOPIC=1` / `VITE_MOCK_GOALS=1`) — that data lives in the
> browser's localStorage, **not** in the database. The deployed build has no mock mode, so it reads
> the real Postgres. Data must actually exist there.

All scripts are **idempotent** (`create ... if not exists`, `add column if not exists`,
`drop policy if exists`) — safe to re-run. Run them in the **Supabase SQL editor** (or `psql`).

## 1. Check what's already applied (run this first)

```sql
select
  to_regclass('public.person')               as person,
  to_regclass('public.weekly_goal')          as weekly_goal,         -- v26
  to_regclass('public.weekly_goal_item')     as weekly_goal_item,    -- v26
  to_regclass('public.mentor_prep')          as mentor_prep,         -- v17
  to_regclass('public.mentor_rating')        as mentor_rating,       -- v20
  to_regclass('public.mentor_subtopic_prep') as mentor_subtopic_prep,-- v27
  to_regclass('public.mentor_lead')          as mentor_lead,         -- v28
  to_regclass('public.mentor_deployment')    as mentor_deployment,   -- v30
  to_regclass('public.mentor_attendance')    as mentor_attendance,   -- v33
  to_regclass('public.mentor_status_history')as mentor_status_hist,  -- v34
  to_regclass('public.mentor_online_batch')  as mentor_online_batch; -- v35
```
Any column that returns `NULL` = that migration is **not applied**.

## 2. Run the missing ones, in order

Fresh database → run everything in order:
```
RecTrack_schema.sql        -- base tables + rt_role() + base RLS
RecTrack_v3_editing.sql ... RecTrack_v25_mentor_removal.sql
RecTrack_v26_weekly_goals.sql          <-- Weekly Goals
RecTrack_v27_mentor_subtopic_prep.sql
RecTrack_v28_mentor_multi_lead.sql
RecTrack_v29_program_multi_trainer.sql
RecTrack_v30_mentor_deployment.sql
RecTrack_v31_mentor_holiday.sql
RecTrack_v32_release_plan.sql
RecTrack_v33_mentor_attendance.sql
RecTrack_v34_mentor_lifecycle.sql
RecTrack_v35_mentor_details_online_batch.sql
```

Existing database that's just behind → run only the ones the check in step 1 reported as `NULL`
(they carry their own dependencies where needed). At minimum for the two reported screens:

| Screen | Needs |
|---|---|
| **Weekly Goals** | `RecTrack_v26_weekly_goals.sql` |
| **Mentor Management** | `v17, v20, v22, v27, v28, v29, v30, v31, v33, v34, v35` |

## 3. After migrating
The tables start **empty** — enter data through the app (it now writes to the real DB, not mock).
Also, after any Auth/JWT change on the self-hosted stack, make sure the frontend's baked
`VITE_SUPABASE_ANON_KEY` still matches, or every request 401s and no data loads.
