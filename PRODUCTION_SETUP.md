# Trackademy — Production Setup (fresh, zero-data project)

Your **dev** project (`zzizxrxwymdblkqlnhha`) stays exactly as-is. This stands up a
**separate, empty production** project. Nothing here deletes any data.

---

## 1. Create the production project
1. supabase.com → **New project** (name it e.g. `trackademy-prod`). Pick a strong DB password and save it.
2. Wait for it to finish provisioning (~2 min).

## 2. Turn OFF email confirmation (one-time, important)
Trackademy signs people in with a shared password + their email. If email
confirmation is on, first sign-in fails.
- **Authentication → Sign In / Providers → Email →** turn **OFF** "Confirm email" → Save.

## 3. Run the schema + migrations (Supabase → SQL Editor)
Run these **in this exact order**, one at a time. After each, the last result should be
a row of values (not an error). All are safe to re-run.

1. `RecTrack_schema.sql`
2. `RecTrack_v3_editing.sql`
3. `RecTrack_v4.sql`
4. `RecTrack_v5_clean.sql`   ← clean version (no demo data)
5. `RecTrack_v6.sql`
6. `RecTrack_v7.sql`
7. `RecTrack_v8.sql`
8. `RecTrack_v9.sql`
9. `RecTrack_v10.sql`

**Do NOT run:** `RecTrack_v5.sql` (has demo data), `RecTrack_import.sql`,
`RecTrack_testdata.sql`, `RecTrack_moredata.sql`, `RecTrack_auth_link.sql`.
Those are dev/sample files.

## 4. Create the first admin
- Open `RecTrack_prod_bootstrap.sql`, replace the **name + email** with your wife's real
  work email (lowercase), then run it. The result should show one admin row.

## 5. Point the app at production
- Open `app/.env.production` and paste the new project's **Project URL** and **anon/public key**
  (Supabase → Project Settings → API).
- (`app/.env` keeps the dev values — don't change it.)

## 6. Build & deploy
```
cd C:\Users\praks\Music\RecTrack-UX\app
npm run build        # uses .env.production automatically → points at prod
```
- Deploy the generated `app/dist/` folder to Netlify (drag-and-drop, or connect the repo).

## 7. First login
- Open the deployed URL, sign in with the admin email from step 4.
- You'll see an **empty** system. Go to **Manage**:
  - set **Turnaround Time (TAT)** per stage,
  - add **Team** members,
  - (optional) set **Menu access** per role,
  - upload the **curriculum Excel** template to load real programs/subjects/topics.

---

## Ongoing: dev → production
- **Develop & test in dev:** `npm run dev` (always hits the dev DB) + your dev Supabase project.
- **Ship code:** `npm run build` → redeploy `dist/` to Netlify.
- **Ship a DB change:** write a new migration `.sql`, run it on **dev** to test, then run the
  **same file** on **prod**.
- **Data never crosses over** — dev test data stays in dev; real data lives only in prod.
