# Trackademy (RecTrack-UX) — Handoff

> Portable handoff for continuing this project under a **new email / new access**.
> Everything needed to build, deploy, and maintain the app is here. Keep this file updated.

---

## 1. What this is
**Trackademy** — a recording-production tracking SaaS for QSpiders. It tracks curriculum
content, studio recording slots, editing, mentor preparation/review, ratings, team
performance, weekly goals, mentor attendance/holidays, and release planning.

- **Frontend:** React 18 + TypeScript + Vite 5 + Ant Design v6 + Recharts + react-router-dom v6 + dayjs + xlsx.
- **Backend:** Supabase (Postgres + Auth + Row-Level Security + PostgREST). No custom server.
- Almost the entire UI is **one file**: `app/src/App.tsx` (~440 KB / ~4.7k lines).

---

## 2. The working folder (IMPORTANT — nested path)
The real project root is the **inner, repeated** folder:

```
C:\Users\User\Music\Trackademy code\RecTrack-UX\RecTrack-UX\      ← PROJECT ROOT (use this)
├── app\                              ← the React/Vite app
│   ├── src\
│   │   ├── App.tsx                   ← the whole UI (main code you edit)
│   │   ├── mockGoals.ts              ← local-only test mocks (localStorage)
│   │   ├── supabase.ts               ← Supabase client
│   │   ├── main.tsx, index.css
│   │   ├── .env                      ← Supabase URL + anon key (baked into build)
│   │   └── .env.production
│   ├── dist\                         ← BUILT OUTPUT → this is what you deploy
│   ├── public\  (has _redirects for SPA routing)
│   ├── package.json, vite.config.ts, tsconfig.json
├── RecTrack_v10 … RecTrack_v33 *.sql ← DB migrations (run in Supabase)
├── RecTrack_schema.sql, *_import/_data*.sql
├── MIGRATION_RUNBOOK.md, MIGRATION_RACI.md, PRODUCTION_SETUP.md
└── HANDOFF.md  (this file)
```

> The **outer** `…\Trackademy code\RecTrack-UX\` only contains a `.claude` folder + the inner
> project. Always work in the **inner** `…\RecTrack-UX\RecTrack-UX\`.
> The project brief also lives one level up: `…\Trackademy code\CLAUDE.md`.

---

## 3. Access to re-grant on the new email
When you switch accounts, you need access to these **external services** (the code itself is
just files in the folder above — no repo host required):

1. **Supabase** (the database + auth). Get added to the Supabase project (or transfer ownership).
   - The app connects using `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, currently baked into
     `app/.env` / `app/.env.production`. If you move to a **new Supabase project**, update those
     two values and rebuild.
   - After any new deploy URL, add it to **Supabase → Auth → URL Configuration** (redirect URLs).
2. **Netlify** (hosting). Get access to the Netlify site (or create a new one and drag `app/dist`).
3. That's it — no GitHub/GitLab is required to build or deploy; it's drag-and-drop.

---

## 4. Build & deploy (drag-and-drop, no server)
**Prereq:** Node 18+ (this machine used a portable Node 20 at
`C:\Users\User\node20-portable\node-v20.20.2-win-x64\node.exe` because system Node was v16).

```sh
# from the project root:  …\RecTrack-UX\RecTrack-UX

# 1. type-check (catches errors; tsconfig has noUnusedLocals)
npx --prefix app tsc --noEmit -p app/tsconfig.json

# 2. build  → outputs app/dist
npm --prefix app run build

# 3. DEPLOY = drag the app/dist folder onto Netlify.  Done.
```

- Each build compiles the **whole** app, so the latest `app/dist` always contains **all** changes.
- `app/public/_redirects` (`/* /index.html 200`) must end up inside `dist` (it does automatically) —
  it enables SPA routing on Netlify.
- **Before building for production, delete `app/.env.local` if present** (it's a local-test mock
  toggle — the build should not include it).

### Local dev / testing (optional)
```sh
npm --prefix app run dev        # http://localhost:5173
```
- Create `app/.env.local` with `VITE_MOCK_MENTOR_SUBTOPIC=1` to run **mock mode** — all mentor
  ratings / attendance / release-planning / deployments / holidays save to the **browser's
  localStorage only**, so testing never writes to production. **Delete this file before a prod build.**
- ⚠️ Without that flag, the dev server talks to **LIVE PRODUCTION Supabase** — reads are fine,
  but avoid driving writes/deletes.

---

## 5. Database migrations (run in Supabase SQL Editor)
SQL files live in the project root as `RecTrack_vNN_*.sql`. All are **idempotent / safe to re-run**
(`create table if not exists`, `add column if not exists`, `drop policy if exists`). The app and the
SQL are independent — order doesn't matter, but both must eventually be applied.

**Latest / must-apply for current features:**
| File | Adds |
|---|---|
| `RecTrack_v26_weekly_goals.sql` | Weekly goals (+ `weekly_goal_item` sub-topic granularity) |
| `RecTrack_v27_mentor_subtopic_prep.sql` | per-sub-topic mentor 4-step progress |
| `RecTrack_v28_mentor_multi_lead.sql` | multiple managing leads per mentor |
| `RecTrack_v29_program_multi_trainer.sql` | multiple trainers per program |
| `RecTrack_v30_mentor_deployment.sql` | mentor deployments (+ subject) |
| `RecTrack_v31_mentor_holiday.sql` | mentor holidays |
| `RecTrack_v32_release_plan.sql` | **Release planning** — `release_plan`, `release_plan_subject`, `release_plan_topic`, `release_plan_item` (+ RLS). Re-run current version for the sub-topic table. |
| `RecTrack_v33_mentor_attendance.sql` | **Daily attendance** table + `person.employee_id` column |

Earlier `v10`–`v25` + `RecTrack_schema.sql` are the base; if setting up a fresh Supabase project,
run `RecTrack_schema.sql` first, then the numbered migrations in order. See `PRODUCTION_SETUP.md`.

---

## 6. Roles & key behaviours
- **Roles:** `admin` = Program Head (full control); `manager` / `team_lead` (scoped to programs
  they own via `default_trainer_id`); `trainer`; `mentor`; `editor`.
- **Menu access** is configurable per role in **Manage → Menu access**; admin always sees everything.
- **Mentor Management:** topics assigned to mentors; 4-step prep; ratings split into **Technical**
  (per sub-topic: depth, presentation, mock) and **Daily corporate etiquette** (once/day per mentor,
  its own tab). Mentor **Analytics** shows rating history (paginated past the 1000-row cap).
- **Attendance & Holidays** (Mentor Mgmt): Daily attendance (Present/Absent/Half day/Leave per
  mentor per day, "Mark all present", Employee ID, **Download report (full register till date)**)
  + Holidays (add/edit/delete).
- **Weekly Goals:** per-program recording/editing targets; a sub-topic is Achieved in the week its
  Shooting/Shooting-Review (recording) or Editing (editing) completes; unfinished items auto-carry
  to the next week's picker; completed sub-topics are hidden from future goals. Shows per-trainer
  performance.
- **Program Command Center → Release details:** named **release versions** (create/delete — delete
  is **admin-only**); pick a "Planning release", then tick sub-topics (or a whole topic) to map them
  — ticks reflect the persisted mapping and survive refresh; each sub-topic sits in one release;
  unmapped sub-topics stay free for another release; readiness chart by subject with a version filter.
- **Editing Queue → Final output** options: Pending · In Progress · Reshoot · Editing completed ·
  Output completed (last two = editing done → enters Reviews). **Reviews** shows each sub-topic's
  editor final-output status.
- **Teams Performance** (`/teams`): trainers ranked by sub-topics completed through Editing.

---

## 7. Critical safety constraints (do not violate)
1. The dev/preview server connects to **LIVE PRODUCTION Supabase**. Verify changes with a clean
   `tsc` + build, or use **mock mode** (`.env.local`). Never drive the preview for writes/deletes.
2. Migrations are additive/idempotent — review before running. Don't touch production data casually.
3. Free Supabase plan = **no automatic backups** — back up before risky DB work.
4. Past outage note: if **all logins fail with 422 / "account not found"**, it's usually Supabase
   Auth (Email provider / autoconfirm disabled), **not** a code bug — check Auth settings first.

---

## 8. Companion docs
- `PRODUCTION_SETUP.md` — production setup notes.
- `MIGRATION_RUNBOOK.md` / `MIGRATION_RACI.md` — plan to move Supabase cloud → self-hosted Supabase.
- `…\Trackademy code\CLAUDE.md` — original project brief.

---

## 9. Quick start for the new owner
1. Copy the whole `…\RecTrack-UX\RecTrack-UX\` folder to the new machine/account.
2. Get **Supabase** + **Netlify** access on the new email (Section 3).
3. Install Node 18+.
4. `npm --prefix app install` (restore dependencies), then `npm --prefix app run build`.
5. Drag `app/dist` to Netlify. Add the site URL to Supabase → Auth → URL Configuration.
6. Ensure migrations **v26–v33** are applied in Supabase.
7. To develop: edit `app/src/App.tsx`, `tsc`, build, redeploy.
