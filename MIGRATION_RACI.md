# Trackademy Migration — RACI Plan
*Companion to MIGRATION_RUNBOOK.md (the runbook has the exact commands; this says WHO does WHAT, WHERE, HOW).*

## Roles
- **PO** — Program Owner (wife): guides the sequence, **enforces the safety rules**, witnesses tests, gives sign-off at the gates.
- **INFRA** — Infra team: runs all technical commands.
- **SPON** — Sponsor (you): overall owner, provides access + final decisions, owns the UI build/cutover.
- **CLAUDE** — me: consulted for guidance + troubleshooting (paste errors, redact secrets).
- **TEAM** — end users: informed only.

## RACI legend
**R** = does the work · **A** = owns it / signs off (one per row) · **C** = consulted · **I** = kept informed

---

## The plan

| # | Task (WHAT) | WHERE | HOW (brief) | R | A | C | I |
|---|-------------|-------|-------------|---|---|---|---|
| 1 | Provision server + Docker | New server | Linux ≥4GB/2CPU/50GB; install Docker + Compose | INFRA | SPON | CLAUDE | PO |
| 2 | Record cloud PG version; check Storage/edge usage | Supabase Studio | `select version();`; check Storage tab; is `mentor-ai` used? | INFRA | PO | CLAUDE | SPON |
| 3 | Install client tools on export machine | A laptop | `pg_dump`, `psql`, Supabase CLI — **same major version** as cloud | INFRA | PO | CLAUDE | — |
| 4 | Get the **right** DB connection string | Supabase → Settings → Database | Direct (5432) **or** Session pooler (5432) if IPv4-only. **Never 6543.** Wake the DB. | INFRA | PO | CLAUDE | — |
| **5** | **Take the 5 backups** | Export laptop | roles + schema + data + auth + full `.dump` (runbook B7–B11) | INFRA | PO | CLAUDE | SPON |
| **6** | ✅ **GATE 1: verify backups + copy to 2nd location** | Export laptop + 2nd drive | grep checks (B12); copy all 5 files off-box. **No further step until done.** | INFRA | **PO** | CLAUDE | SPON |
| 7 | **Dry run** the whole migration to a throwaway instance | Scratch VM / laptop | Run Phases C–G on disposable target; validate; discard | INFRA | PO | CLAUDE | — |
| 8 | Install self-hosted Supabase | New server | `git clone` supabase/docker; set NEW secrets in `.env` (POSTGRES_PASSWORD, JWT_SECRET, ANON/SERVICE keys, dashboard creds, URLs) | INFRA | SPON | CLAUDE | PO |
| 9 | Set auth config (prevents the past 422) | `.env` | `ENABLE_EMAIL_SIGNUP=true`, `ENABLE_EMAIL_AUTOCONFIRM=true`; pin PG image to cloud's version | INFRA | PO | CLAUDE | — |
| 10 | Start the stack | New server | `docker compose pull && up -d`; `docker compose ps` all healthy; open Studio | INFRA | SPON | — | PO |
| 11 | Restore DB: roles → schema → data | New server | `psql` the 3 files in order; then `notify pgrst,'reload schema';` | INFRA | PO | CLAUDE | — |
| 12 | Migrate logins | New server | Option A: restore `04_auth_data.sql`. If it errors → Option B: re-create + `crypt()` SQL | INFRA | PO | CLAUDE | — |
| 13 | Point the UI at the new server + build | Build machine | Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; `npm run build` | SPON | SPON | CLAUDE | INFRA |
| 14 | Deploy the UI | New server | Serve `app/dist` via nginx with SPA fallback, HTTPS | INFRA | SPON | CLAUDE | PO |
| **15** | ✅ **GATE 2: validation matrix** | Both DBs + the app | Row counts match cloud **exactly**; login (PH/Lead/Mentor); RLS scoping; write test (runbook §9) | INFRA | **PO** | CLAUDE | SPON |
| 16 | Go-live: switch team to new URL | — | Announce to team | SPON | SPON | PO | TEAM |
| 17 | **Keep cloud live & untouched 1–2 weeks** (rollback) | Supabase cloud | Do nothing to it. Rollback = revert the 2 env vars | PO | SPON | CLAUDE | INFRA |
| 18 | Set up daily backups on new server | New server | cron `pg_dump -Fc` to retained off-box location | INFRA | SPON | CLAUDE | PO |

---

## The 3 decision gates (PO signs off — do not pass without these)
- **GATE 1 (step 6):** 5 backups exist in 2 places → *only now* is touching anything safe.
- **GATE 2 (step 15):** row counts match + logins + scoping + write all pass → *only now* trust the new server.
- **GATE 3 (step 16→17):** team switched, **cloud kept as rollback** → *only after weeks of confidence* may the cloud be retired.

## Golden rules (PO enforces all migration long)
1. Production is **never written to** — exports are read-only.
2. **Don't pass a gate** until its checks pass.
3. **Don't delete/change the cloud** until Gate 3 + confidence window.
4. Target = **self-hosted Supabase**, not bare Postgres.
5. **Redact secrets** before pasting anything to Claude.

## How to get help on the day
Open **Claude Code in this project folder** → say which step # you're on → paste the error/output (secrets redacted) → I diagnose and give the fix. INFRA executes; CLAUDE advises; PO decides at the gates.
