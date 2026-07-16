# Trackademy — Migration Guide (Cloud → Our Own Server)
### Written so a non-technical owner can follow and guide the infra team

> **If you (the reader) are using ChatGPT to help:** This document is self-contained. Here's the situation in one paragraph —
> *"Trackademy" is a web application. Its data and logins currently live on **Supabase** (a cloud service on the public internet). Management wants the data moved onto **our own private server** so it's not on the public internet. The app is BUILT for Supabase, so the target must be **"self-hosted Supabase"** (the same Supabase software, just running on our server) — NOT a plain database, or the app stops working. The plan below copies all the data to the new server, tests it, and only then switches the app over — while never touching the live system until we're sure. Please help interpret steps and error messages in that context. Never share real passwords or secret keys.*

---

## 🏠 The whole thing in plain words (the "moving house" picture)
Think of it like **moving your family from a rented apartment on a busy public street to your own private house.**
- The **apartment** = the current cloud (Supabase online). Works fine, but it's on a public street (the internet) — management wants privacy.
- The **house** = our own server.
- **The rule:** we **pack everything into labelled boxes first** (backups), keep **spare copies**, set up the new house **completely**, **test that the lights, water and locks work** (data + logins + security), and **only then change our address**. We **keep paying the apartment rent** for a while so we can move back instantly if needed.
- Nobody loses anything, because we never throw away the apartment until the house is proven.

---

## 👤 Who does what
- **You (Program Owner):** you don't type commands. You **keep the order**, **enforce the safety checks ("gates")**, and **say "go" / "stop."**
- **Infra team:** they run the technical commands (they do this kind of thing for many apps).
- **The 3 GATES below are YOUR job** — don't let the team move past a gate until its check passes.

---

## ✅ The 3 safety gates (your main responsibility)
1. **GATE 1 — "Boxes are packed and copied."** Backups exist, and a *second copy* is on another drive. *Until this is true, no one moves anything.*
2. **GATE 2 — "Everything arrived and works."** The new server has the **same number of records** as the cloud, and **logins + security + saving** all work. *Until this passes, we do NOT trust the new server.*
3. **GATE 3 — "Keep the old place as backup."** After we switch over, the **old cloud stays running for 1–2 weeks** so we can jump back instantly. *Don't let anyone delete the cloud early.*

---

# THE STEPS

## Part A — Get ready
**A1. Set up the new server.** *(Infra)*
🟢 *Plain words:* prepare the new "house" — a computer with enough space and the basic software (Docker) installed. Needs roughly 4 GB memory, 50 GB disk.

**A2. Look up two facts about the current cloud.** *(Infra, in the Supabase admin screen)*
🟢 *Plain words:* note the **version number** of the current database (so the new one matches), and check if any **files** are stored there (our app uses web links for videos, so probably none).
*Technical:* run `select version();`; check the Storage tab.

**A3. Put the moving tools on a laptop.** *(Infra)*
🟢 *Plain words:* install the small programs that copy a database (`pg_dump`, `psql`) on a laptop that can reach the internet.

## Part B — Pack the boxes (copy everything — this only READS the cloud, it changes nothing)
**B4. Get the correct "address" of the cloud database.** *(Infra)*
🟢 *Plain words:* in the Supabase admin screen, copy the connection details. There are two kinds — use the **direct** one (port 5432). *Tell the team:* "Don't use port 6543, it breaks the copy."

**B5. Make the backups (5 boxes).** *(Infra)*
🟢 *Plain words:* copy the cloud into 5 files — the structure, all the records, the logins, and one full snapshot. This is **reading only**; the live system is untouched.
*Technical:* the 5 `pg_dump` / `supabase db dump` commands.

**B6. 🚦 GATE 1 — check the boxes and make a spare copy.** *(Infra does it, YOU confirm)*
🟢 *Plain words:* confirm the 5 files aren't empty, then **copy all 5 to a second place** (another laptop or drive). **Once this is done, the data can never be lost — even if everything else fails.** *Do not allow the next part until you've personally confirmed the second copy exists.*

## Part C — Practice run (strongly recommended)
**C7. Do a full rehearsal on a throwaway computer first.** *(Infra)*
🟢 *Plain words:* set up the whole thing once on a scratch machine, check it works, then throw it away. This catches surprises with **zero risk**, before we do it for real. *Encourage the team not to skip this.*

## Part D — Set up the new house
**D8. Install "self-hosted Supabase" on the server.** *(Infra)*
🟢 *Plain words:* install the same Supabase software on our server, and set strong new **passwords/keys** (the team creates these). *Important:* it must be **Supabase**, not a plain database.

**D9. Turn on email logins in the settings.** *(Infra)*
🟢 *Plain words:* flip the setting that lets people log in with email + password. **This is the exact setting that caused our login problem a few days ago** — setting it here once means it can't happen again.
*Technical:* `ENABLE_EMAIL_SIGNUP=true`, `ENABLE_EMAIL_AUTOCONFIRM=true`.

**D10. Start it and check it's running.** *(Infra)*
🟢 *Plain words:* switch the new system on; the team confirms all parts show "healthy" and they can open the admin screen.

## Part E — Move the data in
**E11. Load the structure and all the records.** *(Infra)*
🟢 *Plain words:* pour the boxes into the new house — first the shelves (structure), then the contents (records).

**E12. Move the logins.** *(Infra)*
🟢 *Plain words:* bring over everyone's accounts so they can sign in. If the quick way has trouble, the team uses the **same password method we already used successfully** for the Program Head — so this is a solved problem, not a new risk.

## Part F — Connect the app to the new house
**F13. Tell the app the new address.** *(You + Infra)*
🟢 *Plain words:* change **two settings** in the app so it points at the new server instead of the cloud, then rebuild the app.
*Technical:* set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then `npm run build`.

**F14. Publish the app on the server.** *(Infra)*
🟢 *Plain words:* put the rebuilt app on the server so people can open it in their browser, with secure (https) access.

## Part G — Test before trusting it
**G15. 🚦 GATE 2 — prove everything arrived and works.** *(Infra runs, YOU witness and sign off)*
🟢 *Plain words:* the most important check. Confirm:
- **Same number of records** on the new server as the cloud (programs, mentors, etc. — the numbers must match exactly).
- **Logins work** — sign in as the Program Head, a Team Lead, and a Mentor.
- **Security works** — a Team Lead sees only **their** program (e.g. Navya sees only Python).
- **Saving works** — assign a topic, rate a mentor, mark something completed.
*Until all of these pass, do NOT switch the team over.*

## Part H — Go live and keep a safety net
**H16. Switch the team to the new server.** *(You)*
🟢 *Plain words:* tell everyone to use the new address. They won't notice a difference — same app, new home.

**H17. 🚦 GATE 3 — keep the old cloud running for 1–2 weeks.** *(You enforce)*
🟢 *Plain words:* **do not delete the cloud yet.** If anything feels wrong, we change the two settings back and we're instantly on the old system again. Retire the cloud only after a couple of calm weeks.

**H18. Set up automatic daily backups on the new server.** *(Infra)*
🟢 *Plain words:* the cloud used to back itself up automatically; our server won't unless we set it up. Have the team schedule a **daily backup** so we're always protected going forward.

---

## 🆘 If something goes wrong at any point
- **Stay calm — nothing is lost.** The live cloud is still running and the team is still working on it. We have 5 backups in 2 places.
- **Never delete or change the cloud** while sorting out a problem.
- **To undo instantly:** change the app's two settings back to the cloud and rebuild — you're back on the old system in minutes.
- **To get help:** paste the step number and the exact error message into ChatGPT (or to the infra team). **Replace any password or key with the word `[HIDDEN]` first.**

## 📌 Your one-line job
*"Make them pack and copy the boxes first (Gate 1), make the record counts match and logins work before trusting the new house (Gate 2), and keep the old cloud as a safety net for two weeks (Gate 3). Never let anyone touch the cloud until then."*
