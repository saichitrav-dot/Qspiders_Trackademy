// LOCAL, throwaway mock for Weekly Goals persistence — gated by VITE_MOCK_GOALS=1.
// Lets you test the feature with NO database changes: the goals you create live in
// THIS browser's localStorage only. Topics / recordings / edits still come from the
// real data, so the "achieved/pending" logic is exercised for real.
// Off by default (and on every Netlify build) → normal Supabase behavior.
export const MOCK_GOALS = import.meta.env.VITE_MOCK_GOALS === '1'

const KEY = 'rt_mock_weekly_goals'
export type MockGoal = { id: string; program_id: string; week_start: string; kind: string; topicIds: string[] }

function readAll(): MockGoal[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function writeAll(rows: MockGoal[]) { localStorage.setItem(KEY, JSON.stringify(rows)) }

export function mockListGoals(weekStart: string): MockGoal[] {
  return readAll().filter(g => g.week_start === weekStart)
}
// upsert by (program_id, week_start, kind) — mirrors the v26 unique constraint
export function mockSaveGoal(program_id: string, week_start: string, kind: string, topicIds: string[]): void {
  const rows = readAll()
  const i = rows.findIndex(g => g.program_id === program_id && g.week_start === week_start && g.kind === kind)
  if (i >= 0) rows[i] = { ...rows[i], topicIds }
  else rows.push({ id: 'mock_' + Math.random().toString(36).slice(2), program_id, week_start, kind, topicIds })
  writeAll(rows)
}

// ----- per-sub-topic mentor 4-step progress (mirrors the v27 table) -----
// Lets you test the Mentor Preparation Board's per-sub-topic progress with NO DB change.
export const MOCK_MENTOR_SUBTOPIC = import.meta.env.VITE_MOCK_MENTOR_SUBTOPIC === '1'
const MKEY = 'rt_mock_mentor_subtopic_prep'
export type MockSub = { mentor_id: string; subtopic_id: string; watched: boolean; notes_done: boolean; practice_done: boolean; presentation_done: boolean }

function readSub(): MockSub[] {
  try { return JSON.parse(localStorage.getItem(MKEY) || '[]') } catch { return [] }
}
export function mockListSubProg(mentorIds: string[]): MockSub[] {
  return readSub().filter(r => mentorIds.includes(r.mentor_id))
}
export function mockSaveSubProg(mentor_id: string, subtopic_id: string, f: any): void {
  const rows = readSub()
  const row: MockSub = { mentor_id, subtopic_id, watched: !!f.watched, notes_done: !!f.notes_done, practice_done: !!f.practice_done, presentation_done: !!f.presentation_done }
  const i = rows.findIndex(r => r.mentor_id === mentor_id && r.subtopic_id === subtopic_id)
  if (i >= 0) rows[i] = row; else rows.push(row)
  localStorage.setItem(MKEY, JSON.stringify(rows))
}

// ----- mentor ratings (same flag) so testing "Save rating" never writes to production -----
const RKEY = 'rt_mock_mentor_ratings'
export type MockRating = { mentor_id: string; rated_by: string | null; rated_on: string; category: string; score: number; weight_snapshot: number; remarks: string | null; scope_id?: string | null; scope_level?: string }
function readRatings(): MockRating[] {
  try { return JSON.parse(localStorage.getItem(RKEY) || '[]') } catch { return [] }
}
export function mockListRatings(mentorIds: string[]): MockRating[] {
  return readRatings().filter(r => mentorIds.includes(r.mentor_id))
}
export function mockSaveRatings(rows: MockRating[]): void {
  const all = readRatings(); all.push(...rows); localStorage.setItem(RKEY, JSON.stringify(all))
}
// daily etiquette is once-a-day: drop any existing general-scoped rows for this mentor+date+cats first
export function mockRemoveDailyRatings(mentorId: string, date: string, categories: string[]): void {
  const kept = readRatings().filter(r => !(r.mentor_id === mentorId && (r.scope_id == null) && String(r.rated_on).slice(0, 10) === date && categories.includes(r.category)))
  localStorage.setItem(RKEY, JSON.stringify(kept))
}

// ----- mentor → multiple leads (mirrors the v28 table), same flag -----
const LKEY = 'rt_mock_mentor_lead'
function readLeads(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(LKEY) || '{}') } catch { return {} }
}
export function mockListMentorLeads(mentorId: string): string[] {
  return readLeads()[mentorId] || []
}
export function mockAllMentorLeads(): Record<string, string[]> {
  return readLeads()
}
export function mockSaveMentorLeads(mentorId: string, leadIds: string[]): void {
  const all = readLeads(); all[mentorId] = leadIds; localStorage.setItem(LKEY, JSON.stringify(all))
}

// ----- program → multiple trainers (mirrors the v29 table), same flag -----
const PTKEY = 'rt_mock_program_trainer'
function readProgTrainers(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(PTKEY) || '{}') } catch { return {} }
}
export function mockAllProgramTrainers(): Record<string, string[]> {
  return readProgTrainers()
}
export function mockSaveProgramTrainers(programId: string, trainerIds: string[]): void {
  const all = readProgTrainers(); all[programId] = trainerIds; localStorage.setItem(PTKEY, JSON.stringify(all))
}

// ----- mentor deployments (mirrors the v30 table), same flag -----
const DKEY = 'rt_mock_mentor_deployment'
export type MockDeployment = { id: string; mentor_id: string; subject?: string | null; deployment_type: string; from_date: string | null; to_date: string | null; details: string | null; status: string; requested_by: string | null; approved_by: string | null }
function readDeploy(): MockDeployment[] {
  try { return JSON.parse(localStorage.getItem(DKEY) || '[]') } catch { return [] }
}
export function mockListDeployments(): MockDeployment[] { return readDeploy() }
// returns the new deployment id so callers can link child records (e.g. the online batch)
export function mockAddDeployment(d: Omit<MockDeployment, 'id'>): string {
  const all = readDeploy(); const id = 'mockd_' + Math.random().toString(36).slice(2)
  all.push({ ...d, id }); localStorage.setItem(DKEY, JSON.stringify(all)); return id
}

// ----- online batch details (mirrors the v35 table), same flag -----
const OBKEY = 'rt_mock_online_batch'
export type MockOnlineBatch = { id: string; deployment_id: string; mentor_id: string; subject: string | null; batch_code: string | null; time_slot: string | null; start_date: string | null; end_date: string | null; remarks: string | null }
function readBatch(): MockOnlineBatch[] { try { return JSON.parse(localStorage.getItem(OBKEY) || '[]') } catch { return [] } }
// a deployment can carry MANY batches (same trainer, same day, different codes/slots)
export function mockListOnlineBatches(): MockOnlineBatch[] { return readBatch() }
export function mockAddOnlineBatch(b: Omit<MockOnlineBatch, 'id'>): void {
  const all = readBatch(); all.push({ ...b, id: 'mockob_' + Math.random().toString(36).slice(2) }); localStorage.setItem(OBKEY, JSON.stringify(all))
}
export function mockUpdateOnlineBatch(id: string, patch: Partial<MockOnlineBatch>): void {
  const all = readBatch(); const i = all.findIndex((x) => x.id === id); if (i >= 0) { all[i] = { ...all[i], ...patch }; localStorage.setItem(OBKEY, JSON.stringify(all)) }
}
export function mockDeleteOnlineBatch(id: string): void {
  localStorage.setItem(OBKEY, JSON.stringify(readBatch().filter((x) => x.id !== id)))
}
export function mockUpdateDeployment(id: string, patch: Partial<MockDeployment>): void {
  const all = readDeploy(); const i = all.findIndex(x => x.id === id); if (i >= 0) { all[i] = { ...all[i], ...patch }; localStorage.setItem(DKEY, JSON.stringify(all)) }
}

// ----- mentor holidays (mirrors the v31 table), same flag -----
const HKEY = 'rt_mock_mentor_holiday'
export type MockHoliday = { id: string; mentor_id: string; from_date: string; to_date: string; reason: string | null }
function readHoliday(): MockHoliday[] {
  try { return JSON.parse(localStorage.getItem(HKEY) || '[]') } catch { return [] }
}
export function mockListHolidays(): MockHoliday[] { return readHoliday() }
export function mockAddHoliday(h: Omit<MockHoliday, 'id'>): void {
  const all = readHoliday(); all.push({ ...h, id: 'mockh_' + Math.random().toString(36).slice(2) }); localStorage.setItem(HKEY, JSON.stringify(all))
}
export function mockUpdateHoliday(id: string, patch: Partial<MockHoliday>): void {
  const all = readHoliday(); const i = all.findIndex(h => h.id === id); if (i >= 0) { all[i] = { ...all[i], ...patch }; localStorage.setItem(HKEY, JSON.stringify(all)) }
}
export function mockDeleteHoliday(id: string): void {
  localStorage.setItem(HKEY, JSON.stringify(readHoliday().filter(h => h.id !== id)))
}

// ----- release plans (mirrors the v32 tables), same flag -----
const RPKEY = 'rt_mock_release_plan'
const RPSKEY = 'rt_mock_release_plan_subject'
const RPTKEY = 'rt_mock_release_plan_topic'
const RPIKEY = 'rt_mock_release_plan_item'
export type MockRelease = { id: string; name: string; release_date: string | null }
function readReleases(): MockRelease[] { try { return JSON.parse(localStorage.getItem(RPKEY) || '[]') } catch { return [] } }
function readRelSub(): Record<string, string> { try { return JSON.parse(localStorage.getItem(RPSKEY) || '{}') } catch { return {} } } // subject_id -> plan_id
function readRelTopic(): Record<string, string> { try { return JSON.parse(localStorage.getItem(RPTKEY) || '{}') } catch { return {} } } // topic_id -> plan_id
function readRelItem(): Record<string, string> { try { return JSON.parse(localStorage.getItem(RPIKEY) || '{}') } catch { return {} } } // content_item_id -> plan_id
export function mockListReleases(): MockRelease[] { return readReleases() }
export function mockAddRelease(name: string, release_date: string | null): void {
  const all = readReleases(); all.push({ id: 'mockr_' + Math.random().toString(36).slice(2), name, release_date }); localStorage.setItem(RPKEY, JSON.stringify(all))
}
export function mockDeleteRelease(id: string): void {
  localStorage.setItem(RPKEY, JSON.stringify(readReleases().filter(r => r.id !== id)))
  const m = readRelSub(); Object.keys(m).forEach(sid => { if (m[sid] === id) delete m[sid] }); localStorage.setItem(RPSKEY, JSON.stringify(m))
  const t = readRelTopic(); Object.keys(t).forEach(tid => { if (t[tid] === id) delete t[tid] }); localStorage.setItem(RPTKEY, JSON.stringify(t))
  const ci = readRelItem(); Object.keys(ci).forEach(cid => { if (ci[cid] === id) delete ci[cid] }); localStorage.setItem(RPIKEY, JSON.stringify(ci))
}
export function mockReleaseItems(): Record<string, string> { return readRelItem() } // content_item_id -> plan_id
export function mockSetReleaseItem(ciId: string, planId: string | null): void {
  const m = readRelItem(); if (planId) m[ciId] = planId; else delete m[ciId]; localStorage.setItem(RPIKEY, JSON.stringify(m))
}
export function mockReleaseSubjects(): Record<string, string> { return readRelSub() } // subject_id -> plan_id
export function mockSetReleaseSubject(subjectId: string, planId: string | null): void {
  const m = readRelSub(); if (planId) m[subjectId] = planId; else delete m[subjectId]; localStorage.setItem(RPSKEY, JSON.stringify(m))
}
export function mockReleaseTopics(): Record<string, string> { return readRelTopic() } // topic_id -> plan_id
export function mockSetReleaseTopic(topicId: string, planId: string | null): void {
  const t = readRelTopic(); if (planId) t[topicId] = planId; else delete t[topicId]; localStorage.setItem(RPTKEY, JSON.stringify(t))
}

// ----- mentor training-lifecycle status (mirrors the v34 columns), same flag -----
const MSKEY = 'rt_mock_mentor_status'
export type MockMentorStatus = { status: string; reason: string | null; at: string }
function readMentorStatus(): Record<string, MockMentorStatus> {
  try { return JSON.parse(localStorage.getItem(MSKEY) || '{}') } catch { return {} }
}
export function mockAllMentorStatus(): Record<string, MockMentorStatus> { return readMentorStatus() }
export function mockSetMentorStatus(mentorId: string, status: string, reason: string | null): void {
  const all = readMentorStatus(); all[mentorId] = { status, reason: reason ?? null, at: new Date().toISOString() }
  localStorage.setItem(MSKEY, JSON.stringify(all))
}

// ----- daily mentor attendance (mirrors the v33 table), same flag -----
const ATKEY = 'rt_mock_mentor_attendance'
export type MockAttendance = { mentor_id: string; att_date: string; status: string; note: string | null }
function readAtt(): MockAttendance[] { try { return JSON.parse(localStorage.getItem(ATKEY) || '[]') } catch { return [] } }
export function mockListAttendance(date: string): MockAttendance[] { return readAtt().filter(a => a.att_date === date) }
export function mockAllAttendance(): MockAttendance[] { return readAtt() }
export function mockSetAttendance(mentor_id: string, att_date: string, status: string, note: string | null): void {
  const all = readAtt(); const i = all.findIndex(a => a.mentor_id === mentor_id && a.att_date === att_date)
  const row: MockAttendance = { mentor_id, att_date, status, note: note ?? null }
  if (i >= 0) all[i] = row; else all.push(row); localStorage.setItem(ATKEY, JSON.stringify(all))
}
