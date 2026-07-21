import { useEffect, useState, useRef, createContext, useContext, Fragment } from 'react'
import * as XLSX from 'xlsx'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ConfigProvider, Layout, Menu, Card, Progress, Table, Tag, Drawer, Select, Button,
  Avatar, Spin, Input, Row, Col, Empty, Modal, Form, DatePicker, message, Segmented, InputNumber, Statistic, Checkbox, Popconfirm, Popover, AutoComplete, Switch, Breadcrumb, Slider, Tabs, Tree, Timeline, Tooltip as ATooltip, App as AntApp,
} from 'antd'
import {
  DashboardOutlined, ApartmentOutlined, CalendarOutlined, BellOutlined, SearchOutlined,
  TeamOutlined, BookOutlined, AppstoreOutlined, ReadOutlined, PlusOutlined,
  ScissorOutlined, SafetyCertificateOutlined, IdcardOutlined, FieldTimeOutlined, ScheduleOutlined, SettingOutlined, BarChartOutlined,
  ContainerOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, HistoryOutlined, ProfileOutlined, PartitionOutlined, StarOutlined, InfoCircleOutlined, AimOutlined, TrophyOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { FunnelChart, Funnel, LabelList, PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, Treemap } from 'recharts'
import { supabase } from './supabase'
import { MOCK_GOALS, mockListGoals, mockSaveGoal, MOCK_MENTOR_SUBTOPIC, mockListSubProg, mockSaveSubProg, mockListRatings, mockSaveRatings, mockRemoveDailyRatings, mockListMentorLeads, mockAllMentorLeads, mockSaveMentorLeads, mockAllProgramTrainers, mockSaveProgramTrainers, mockListDeployments, mockAddDeployment, mockUpdateDeployment, mockListHolidays, mockAddHoliday, mockUpdateHoliday, mockDeleteHoliday, mockListReleases, mockAddRelease, mockDeleteRelease, mockReleaseItems, mockSetReleaseItem, mockListAttendance, mockAllAttendance, mockSetAttendance, mockAllMentorStatus, mockSetMentorStatus, mockListOnlineBatches, mockAddOnlineBatch, mockUpdateOnlineBatch, mockDeleteOnlineBatch } from './mockGoals'

const { Sider, Header, Content } = Layout

// ---- Brand theme (switchable; defaults to QSpiders). Change in Manage → Appearance. ----
const THEMES: Record<string, { primary: string; logo: string; label: string }> = {
  qspiders: { primary: '#F2641E', logo: 'linear-gradient(135deg,#F2641E,#F09819)', label: 'QSpiders (orange)' },
  indigo: { primary: '#4f46e5', logo: 'linear-gradient(135deg,#6366f1,#0d9488)', label: 'Classic (indigo)' },
}
const ACTIVE_THEME = ((): string => { try { return localStorage.getItem('rt_theme') || 'qspiders' } catch { return 'qspiders' } })()
const BRAND = THEMES[ACTIVE_THEME] || THEMES.qspiders
const PRIMARY = BRAND.primary
// translucent brand tint (e.g. for the active sidebar item) from the active PRIMARY
function hexA(hex: string, a: number) {
  const h = hex.replace('#', ''); const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(f, 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
// due-date chip helper (overdue / due-soon / on-track) — shared by Command Center + Manage
function dueMeta(due?: string | null) {
  if (!due) return null
  const days = dayjs(due).startOf('day').diff(dayjs().startOf('day'), 'day')
  const color = days < 0 ? '#dc2626' : days <= 7 ? '#c2790a' : '#16a34a'
  const text = days < 0 ? `overdue ${-days}d` : days === 0 ? 'due today' : `due in ${days}d`
  return { days, color, text, label: dayjs(due).format('DD MMM YYYY') }
}

const STAGE_COLORS: Record<number, string> = { 1: '#6366f1', 2: '#8b5cf6', 3: '#0ea5e9', 4: '#0d9488', 5: '#f59e0b', 6: '#ec4899', 7: '#16a34a', 99: '#16a34a' }
const STATUS_OPTS = ['Not Started', 'In Progress', 'Blocked', 'Reshoot', 'Completed']
const SLOT_STATUS_OPTS = ['Scheduled', 'In Progress', 'Completed', 'Missed', 'Rescheduled', 'Swapped']
const REC_OPTS = ['Not Started', 'Recording Started', 'Recording In Progress', 'Recording Completed']
const REASONS = ['Given other training', 'No-show', 'Late start', 'Swapped by others', 'Tech issue', 'Trainer on leave']
const QUALITY_OPTS = ['Excellent', 'Good', 'Average', 'Poor']
const FINAL_OUTPUT_OPTS = ['Pending', 'In Progress', 'Reshoot', 'Editing completed', 'Output completed']
// editor states that mean editing is finished (advance the pipeline / count as done). 'Completed' = legacy value.
const FO_DONE = ['Editing completed', 'Output completed', 'Completed']
const SLOTS_PER_DAY = 6
const qualityColor: any = { Excellent: '#16a34a', Good: '#2563eb', Average: '#c2790a', Poor: '#dc2626' }
const ROLES = ['admin', 'trainer', 'editor', 'reviewer', 'manager', 'team_lead', 'mentor']
const roleLabel = (r: string) => r === 'admin' ? 'Program Head' : r === 'team_lead' ? 'Team Lead' : r.charAt(0).toUpperCase() + r.slice(1)
const roleColor: any = { admin: 'purple', trainer: 'blue', editor: 'magenta', reviewer: 'gold', manager: 'green', team_lead: 'cyan', mentor: 'volcano' }
// the four gated prep steps a mentor completes per topic before they're deploy-ready
const MENTOR_STEPS = [
  { key: 'watched', label: 'Watch video', icon: '▶' },
  { key: 'notes_done', label: 'Notes', icon: '✎' },
  { key: 'practice_done', label: 'Practice', icon: '◎' },
  { key: 'presentation_done', label: 'Presentation', icon: '▤' },
]
const MENTOR_SLA_DAYS = 5 // a mentor has this many days from assignment to deploy-ready
// Mentor rating — segregated into three sections. Stored in mentor_rating (category = key),
// date-stamped, weight 1 each → a simple average. No schema change (uses the v20 table).
const RATING_GROUPS: { kind: string; title: string; scope: 'topic' | 'general'; cats: { key: string; label: string }[] }[] = [
  { kind: 'presentation', title: 'Presentation', scope: 'topic', cats: [
    { key: 'depth_of_topic', label: 'Depth of topic' },
    { key: 'presentation_skill', label: 'Presentation skill' },
  ] },
  { kind: 'mock', title: "Today's Mock interview", scope: 'topic', cats: [
    { key: 'mock_interview', label: 'Mock interview' },
  ] },
  { kind: 'etiquette', title: 'Daily corporate etiquette', scope: 'general', cats: [
    { key: 'punctuality', label: 'Punctuality' },
    { key: 'discipline', label: 'Discipline' },
    { key: 'dedication', label: 'Dedication' },
    { key: 'executive_attire', label: 'Executive attire' },
    { key: 'leadership', label: 'Leadership' },
  ] },
]
const RATING_CATS = RATING_GROUPS.flatMap(g => g.cats.map(c => ({ ...c, kind: g.kind, scope: g.scope })))
// which categories are per-sub-topic Technical vs once-a-day etiquette — used to split ratings by
// CATEGORY (not by whether a scope_id happens to be present, which older/mixed data can't be trusted on).
const TECH_CAT_KEYS = new Set(RATING_CATS.filter(c => c.scope === 'topic').map(c => c.key))
const DAILY_CAT_KEYS = new Set(RATING_CATS.filter(c => c.scope === 'general').map(c => c.key))
// deployment feedback categories — rated on the "Mentors Back to bench" tab (stored in mentor_rating, scope 'deployment')
const FEEDBACK_CATS = [
  { key: 'student_feedback', label: 'Student feedback' },
  { key: 'external_coordinator_feedback', label: 'External coordinator feedback' },
  { key: 'reporting_lead_feedback', label: 'Reporting lead feedback' },
]
const RATING_CAT_LABEL: Record<string, string> = Object.fromEntries([...RATING_CATS, ...FEEDBACK_CATS].map(c => [c.key, c.label]))
// roles assigned a slice of the tree via the Assignments page (oversee everything under it).
// Editors are NOT here — they're assigned individual videos via the Editing tab checkboxes.
const OWNER_ROLES = ['manager', 'team_lead']
// roles that may add/edit teammates
const PEOPLE_MANAGER_ROLES = ['manager', 'team_lead']
// label used in owner pickers so you can tell a lead/manager apart from a trainer
const ownerOptLabel = (p: any) => OWNER_ROLES.includes(p.role) ? `${p.full_name} (${roleLabel(p.role).toLowerCase()})` : p.full_name
const TRAINER_TYPES = ['Internal', 'External']
const SENTI = ['Positive', 'Neutral', 'Concern']
const sentiColor: any = { Positive: '#16a34a', Neutral: '#c2790a', Concern: '#dc2626' }
const PIE_COLORS = [PRIMARY, '#0ea5e9', '#16a34a', '#f59e0b', '#ec4899', '#8b5cf6', '#0d9488', '#dc2626', '#2563eb', '#c2790a']
async function setItemStage(id: string, status: string) {
  const patch: any = { status }
  if (status === 'In Progress') patch.started_on = dayjs().format('YYYY-MM-DD')
  // record WHEN a stage finishes (used by Weekly Goals to bound completion to a week); clear it if reopened
  patch.completed_on = status === 'Completed' ? dayjs().format('YYYY-MM-DD') : null
  const { data, error } = await supabase.from('item_stage').update(patch).eq('id', id).select('id')
  if (error) throw error
  // RLS-denied updates return 0 rows with no error — surface that instead of silently reverting
  if (!data || data.length === 0) throw new Error("Couldn't save — your role doesn't have edit access to this screen. The Program Head can grant it in Manage → Menu access.")
  return data
}
const TIMES = ['08:30', '10:30', '12:30', '14:30', '16:30', '18:30']
const END_OF: Record<string, string> = { '08:30': '10:30', '10:30': '12:30', '12:30': '14:30', '14:30': '16:30', '16:30': '18:30', '18:30': '20:30' }
const SLOT_COLORS: Record<string, string> = { Scheduled: '#6b7280', 'In Progress': '#2563eb', Completed: '#16a34a', Missed: '#dc2626', Rescheduled: '#7c3aed', Swapped: '#c2790a' }

function StageBadge({ name, seq }: { name: string; seq: number }) {
  const c = STAGE_COLORS[seq] || '#6b7280'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: c + '1e', color: c, fontWeight: 600, fontSize: 12, padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />{name}
    </span>
  )
}

/* ===================== auth ===================== */
const AuthCtx = createContext<any>(null)
const useAuth = () => useContext(AuthCtx)
const DEVPW = 'RecTrack-shared-2026!'
// Only this account has its own private password — the login form asks for it when this email is typed.
const PH_EMAIL = 'saichitrav@qspiders.com'

// Re-run a page's loader on a gentle interval and when the user returns to the tab — but ONLY when
// the page is idle, so it never interrupts active work. A refresh is skipped while a dialog/drawer is
// open, a dropdown is open, or the cursor is in a text field. It only updates the background list data
// (table rows) — it never touches open forms, filters, search text, or your selection.
function isPageBusy(): boolean {
  const visible = (sel: string) => Array.from(document.querySelectorAll(sel)).some((e) => (e as HTMLElement).offsetParent !== null)
  if (visible('.ant-modal') || visible('.ant-drawer-content')) return true        // a dialog/drawer is open
  if (document.querySelector('.ant-select-open, .ant-picker-focused')) return true // a dropdown/date picker is open
  const el = document.activeElement as HTMLElement | null                          // user is typing
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return true
  return false
}
function useAutoRefresh(fn: () => void, intervalMs = 60000) {
  const ref = useRef(fn); ref.current = fn
  useEffect(() => {
    const run = () => { if (document.visibilityState === 'visible' && !isPageBusy()) ref.current() }
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)
    const id = window.setInterval(run, intervalMs)
    return () => { window.removeEventListener('focus', run); document.removeEventListener('visibilitychange', run); window.clearInterval(id) }
  }, [intervalMs])
}

function AuthProvider({ children }: { children: any }) {
  const [session, setSession] = useState<any>(null)
  const [person, setPerson] = useState<any>(null)
  const [access, setAccess] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) { setPerson(null); setAccess(null); setLoading(false); return }
    ;(async () => {
      let { data } = await supabase.from('person').select('*').eq('auth_user_id', session.user.id).maybeSingle()
      // fallback: match by email if the account isn't linked yet, then self-heal the link
      if (!data && session.user.email) {
        const byEmail = await supabase.from('person').select('*').ilike('email', session.user.email).maybeSingle()
        data = byEmail.data
        if (data && !data.auth_user_id) { try { await supabase.from('person').update({ auth_user_id: session.user.id }).eq('id', data.id) } catch (e) { /* read still works */ } }
      }
      setPerson(data); setLoading(false)
      // load this role's menu-access rights so the UI matches what RLS will allow
      if (data?.role) {
        const ra = await supabase.from('role_access').select('menu_key, allowed').eq('role', data.role)
        const m: any = {}; (ra.data || []).forEach((r: any) => { m[r.menu_key] = r.allowed }); setAccess(m)
      } else setAccess({})
    })()
  }, [session])
  // admin always; otherwise allowed unless the matrix explicitly turned it off (default = allowed)
  const can = (key: string) => person?.role === 'admin' || !access || access[key] !== false
  // admin + team leads can always (re)assign; managers/trainers only if granted the per-person flag
  const canAssign = person?.role === 'admin' || person?.role === 'team_lead' || !!person?.can_assign
  // admin always sees all; everyone else (managers + team leads included) honors their per-person "Sees all content" toggle.
  const seesAll = person?.role === 'admin' || !!person?.full_visibility
  return <AuthCtx.Provider value={{ session, person, loading, can, canAssign, seesAll, signOut: () => supabase.auth.signOut() }}>{children}</AuthCtx.Provider>
}

/* ===================== login ===================== */
function Login() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const nav = useNavigate(); const { session } = useAuth()
  useEffect(() => { if (session) nav('/') }, [session])
  const clean = email.trim().toLowerCase()
  const needsPw = clean === PH_EMAIL // only the Program Head account is asked for a password
  async function submit() {
    if (needsPw && !pw) { setErr('Enter the Program Head password.'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: clean, password: needsPw ? pw : DEVPW })
    setBusy(false)
    if (error) { setErr(needsPw ? 'Incorrect Program Head password.' : 'Account not found. Ask the Program Head to add you in Manage → Team.'); return }
    nav('/')
  }
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'radial-gradient(1100px 560px at 50% -12%, #1c2142, #0b0d12)', padding: 16 }}>
      <Card style={{ width: 370 }} styles={{ body: { padding: 28 } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: BRAND.logo, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800 }}>Q</div>
          <b style={{ fontSize: 18 }}>Trackademy</b>
        </div>
        <h2 style={{ margin: '0 0 4px', fontWeight: 800 }}>Sign in</h2>
        <p style={{ color: '#69707d', marginTop: 0, marginBottom: 18, fontSize: 13 }}>Enter your work email to continue</p>
        <Input size="large" placeholder="you@example.com" value={email} autoFocus onChange={e => setEmail(e.target.value)} onPressEnter={submit} style={{ marginBottom: 14 }} />
        {needsPw && <Input.Password size="large" placeholder="Program Head password" value={pw} onChange={e => setPw(e.target.value)} onPressEnter={submit} style={{ marginBottom: 14 }} />}
        {err && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <Button type="primary" size="large" block loading={busy} disabled={!email.trim() || (needsPw && !pw)} onClick={submit}>Continue</Button>
      </Card>
    </div>
  )
}

/* ===================== shell ===================== */
function Shell({ children }: { children: any }) {
  const { person, signOut, canAssign } = useAuth()
  const loc = useLocation(); const nav = useNavigate()
  const [allowed, setAllowed] = useState<any>(null)
  useEffect(() => {
    if (!person) return
    supabase.from('role_access').select('menu_key, allowed').eq('role', person.role).then(({ data }: any) => {
      const m: any = {}; (data || []).forEach((r: any) => { m[r.menu_key] = r.allowed }); setAllowed(m)
    })
  }, [person])
  const items = [
    { key: '/dashboard', icon: <BarChartOutlined />, label: 'Dashboard' },
    { key: '/', icon: <DashboardOutlined />, label: 'Command Center' },
    { key: '/studio', icon: <CalendarOutlined />, label: 'Studio Board' },
    { key: '/myday', icon: <ScheduleOutlined />, label: 'My Day' },
    { key: '/mywork', icon: <ProfileOutlined />, label: 'My Work' },
    { key: '/content', icon: <ApartmentOutlined />, label: 'Content' },
    { key: '/assignments', icon: <PartitionOutlined />, label: 'Assignments' },
    { key: '/editing', icon: <ScissorOutlined />, label: 'Editing' },
    { key: '/goals', icon: <AimOutlined />, label: 'Weekly Goals' },
    { key: '/mentor', icon: <ReadOutlined />, label: 'Mentor Management' },
    { key: '/reviews', icon: <SafetyCertificateOutlined />, label: 'Reviews' },
    { key: '/sla', icon: <FieldTimeOutlined />, label: 'SLA & Delays' },
    { key: '/management', icon: <BarChartOutlined />, label: 'Management' },
    { key: '/teams', icon: <TrophyOutlined />, label: 'Teams Performance' },
    { key: '/people', icon: <IdcardOutlined />, label: 'People' },
    { key: '/assets', icon: <ContainerOutlined />, label: 'Assets' },
    { key: '/manage', icon: <SettingOutlined />, label: 'Manage' },
  ]
  // leads/managers/mentors get a consolidated "My Work" — so fold away the duplicate menus
  const consolidated = OWNER_ROLES.includes(person?.role) || person?.role === 'mentor'
  const canSeeMgmt = person?.role === 'admin' || OWNER_ROLES.includes(person?.role) // Management = PH/managers/leads only
  const foldedAway = (k: string) => (consolidated && (k === '/mentor' || k === '/myday' || (OWNER_ROLES.includes(person?.role) && k === '/content'))) || ((k === '/management' || k === '/teams') && !canSeeMgmt)
  const visibleItems = items.filter((it) => (it.key !== '/assignments' || canAssign) && (it.key !== '/dashboard' || DASH_ROLES.includes(person?.role)) && !foldedAway(it.key) && (person?.role === 'admin' || !allowed || allowed[it.key] !== false))
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={236} style={{ background: '#12141d' }} breakpoint="lg" collapsedWidth={0}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 18px 14px' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: BRAND.logo, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800 }}>Q</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Trackademy</div>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[loc.pathname]} items={visibleItems} onClick={e => nav(e.key)} style={{ background: 'transparent', borderInlineEnd: 0 }} />
        <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.06)', borderRadius: 10, padding: '8px 10px' }}>
          <Avatar style={{ background: '#a855f7', flexShrink: 0 }}>{(person?.full_name || '?')[0]}</Avatar>
          <div style={{ lineHeight: 1.25, overflow: 'hidden' }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{person?.full_name || '—'}</div>
            <div style={{ color: '#777d8c', fontSize: 11, textTransform: 'capitalize' }}>{person?.role === 'admin' ? 'Program Head' : (person?.role || 'no profile')}</div>
          </div>
        </div>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', borderBottom: '1px solid #eef0f3', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>
          <Input prefix={<SearchOutlined style={{ color: '#9aa1ad' }} />} placeholder="Search…" variant="filled" style={{ maxWidth: 340 }} />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <BellOutlined style={{ fontSize: 16, color: '#69707d' }} />
            <Button type="text" onClick={signOut}>Sign out</Button>
          </div>
        </Header>
        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  )
}

function PageHead({ title, sub, extra }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 18 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{title}</h1>
        {sub && <p style={{ color: '#69707d', marginTop: 4, marginBottom: 0, fontSize: 13 }}>{sub}</p>}
      </div>
      <div style={{ marginLeft: 'auto' }}>{extra}</div>
    </div>
  )
}

/* ===================== command center ===================== */
function KpiCard({ icon, tint, label, value, onClick }: any) {
  return (
    <Card hoverable={!!onClick} onClick={onClick} styles={{ body: { padding: 18 } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#69707d', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .3 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: tint + '22', color: tint }}>{icon}</span>{label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 10, letterSpacing: -1 }}>{value}</div>
    </Card>
  )
}
function LiveTile({ color, label, value, onClick }: any) {
  return <Card hoverable={!!onClick} onClick={onClick} styles={{ body: { padding: 16 } }}><div style={{ fontSize: 11, color: '#69707d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .3 }}>{label}</div><div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color }}>{value}</div></Card>
}
function CommandCenter() {
  const { person, seesAll } = useAuth()
  const nav = useNavigate()
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('')
  async function load() {
    const people = await supabase.from('person').select('id', { count: 'exact', head: true })
    const programsC = await supabase.from('main_subject').select('id', { count: 'exact', head: true })
    const subjectsC = await supabase.from('subject').select('id', { count: 'exact', head: true })
    const chaptersC = await supabase.from('chapter').select('id', { count: 'exact', head: true })
    const topicsC = await supabase.from('topic').select('id', { count: 'exact', head: true })
    const subtopicsC = await supabase.from('subtopic').select('id', { count: 'exact', head: true })
    const subj = await supabase.from('v_subject_completion').select('*')
    const prog = await supabase.from('main_subject').select('name').limit(1).maybeSingle()
    const dueRes = await supabase.from('main_subject').select('name,due_date')
    const dueByProg: Record<string, string | null> = {}; (dueRes.data || []).forEach((r: any) => { dueByProg[r.name] = r.due_date })
    let items = await fetchAllItems()
    if (!seesAll && person?.id) {
      const inScope = await buildScope(person)
      items = items.filter(inScope)
    }
    const dist: Record<string, number> = {}; let started = 0, done = 0, weightedDone = 0
    const subjMap: Record<string, any> = {}; const progMap: Record<string, any> = {}
    items.forEach((it: any) => {
      const stages: any[] = Object.values(it.byCode)
      const completed = stages.filter(s => s.status === 'Completed').length
      const isDone = completed === stages.length
      weightedDone += it.completion / 100
      if (isDone) done++; else if (completed > 0) started++
      dist[it.stageName] = (dist[it.stageName] || 0) + 1
      const k = it.subject || '—'
      subjMap[k] = subjMap[k] || { subject_id: k, name: k, items: 0, published: 0, sumc: 0 }
      subjMap[k].items++; subjMap[k].sumc += it.completion; if (isDone) subjMap[k].published++
      const pk = it.program || '—'
      progMap[pk] = progMap[pk] || { name: pk, items: 0, published: 0, sumc: 0 }
      progMap[pk].items++; progMap[pk].sumc += it.completion; if (isDone) progMap[pk].published++
    })
    const itemCount = items.length
    const subjectRows = Object.values(subjMap).map((s: any) => ({ subject_id: s.subject_id, name: s.name, items: s.items, published: s.published, pending: s.items - s.published, completion_pct: s.items ? Math.round(s.sumc / s.items) : 0 })).sort((a: any, b: any) => b.completion_pct - a.completion_pct)
    const programRows = Object.values(progMap).map((p: any) => ({ name: p.name, items: p.items, published: p.published, pending: p.items - p.published, completion: p.items ? Math.round(p.sumc / p.items) : 0, due_date: dueByProg[p.name] || null })).sort((a: any, b: any) => b.items - a.items)
    const stageOrder = [{ seq: 1, name: 'PPT' }, { seq: 2, name: 'Script' }, { seq: 3, name: 'Presentation' }, { seq: 4, name: 'Shooting' }, { seq: 5, name: 'Shooting Review' }, { seq: 6, name: 'Editing' }, { seq: 7, name: 'Final Review' }]
    setD({ programCount: programRows.length, scoped: !seesAll, itemCount, pending: itemCount - done, people: people.count || 0, subjects: subjectsC.count || 0, topics: topicsC.count || 0, started, done, overall: itemCount ? Math.round((weightedDone / itemCount) * 100) : 0, dist, stageOrder, subjectRows, programRows,
      // true catalog totals across the whole tree (server-side counts — not affected by the 1000-row fetch cap)
      treeTotals: { programs: programsC.count || 0, subjects: subjectsC.count || 0, chapters: chaptersC.count || 0, topics: topicsC.count || 0, subtopics: subtopicsC.count || 0 } })
  }
  useEffect(() => { load() }, [person?.id, seesAll])
  useAutoRefresh(load)
  if (err) return <Card><span style={{ color: '#dc2626' }}>Couldn’t load: {err}</span></Card>
  if (!d) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  const subjCols = [
    { title: 'Subject', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Items', dataIndex: 'items', width: 70 },
    { title: 'Done', dataIndex: 'published', width: 70, render: (v: number) => <span style={{ color: '#16a34a', fontWeight: 600 }}>{v}</span> },
    { title: 'Pending', dataIndex: 'pending', width: 80, render: (v: number) => <span style={{ color: '#c2790a', fontWeight: 600 }}>{v}</span> },
    { title: 'Completion', dataIndex: 'completion_pct', width: '35%', render: (v: number) => <Progress percent={v} size="small" strokeColor={PRIMARY} /> },
  ]
  return (
    <div>
      <PageHead title="Program Command Center" sub={d.scoped ? 'Your assigned work' : `${d.treeTotals?.programs ?? d.programCount} program${(d.treeTotals?.programs ?? d.programCount) === 1 ? '' : 's'}`} />
      <Tabs defaultActiveKey="overview" items={[{ key: 'overview', label: 'Overview', children: <>
      {!d.scoped && d.treeTotals && (
        <Card style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <PartitionOutlined style={{ color: PRIMARY }} />
            <b style={{ fontSize: 14 }}>Curriculum totals</b>
            <span style={{ color: '#9aa1ad', fontSize: 12 }}>— every level of the tree, counted live across the whole catalog</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Programs', value: d.treeTotals.programs, color: PRIMARY, to: '/content' },
              { label: 'Subjects', value: d.treeTotals.subjects, color: '#0ea5e9', to: '/content' },
              { label: 'Chapters', value: d.treeTotals.chapters, color: '#8b5cf6' },
              { label: 'Topics', value: d.treeTotals.topics, color: '#0d9488' },
              { label: 'Sub-topics', value: d.treeTotals.subtopics, color: '#16a34a', to: '/content' },
            ].map((t: any) => (
              <div key={t.label} onClick={t.to ? () => nav(t.to) : undefined}
                style={{ flex: '1 1 130px', cursor: t.to ? 'pointer' : 'default', border: '1px solid #eef0f3', borderRadius: 12, padding: '14px 16px', textAlign: 'center', background: '#fafbfc' }}>
                <div style={{ fontSize: 11, color: '#69707d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{t.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: t.color, letterSpacing: -1 }}>{t.value}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8} lg={7}>
          <Card style={{ height: '100%' }} styles={{ body: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 } }}>
            <Progress type="circle" percent={d.overall} size={140} strokeColor={PRIMARY} />
            <div style={{ textAlign: 'center', fontSize: 12, color: '#69707d' }}><b style={{ color: '#161a22' }}>{d.done}</b> done · <b style={{ color: '#161a22' }}>{d.started}</b> in progress<br />of <b style={{ color: '#161a22' }}>{d.itemCount}</b> sub-topics</div>
          </Card>
        </Col>
        <Col xs={24} md={16} lg={17}>
          <Card title="Programs" extra={<span style={{ fontSize: 11, color: '#9aa1ad' }}>click a program to open its tree →</span>} style={{ height: '100%' }}>
            {!d.programRows.length ? <Empty description="No programs yet" /> : <Row align="middle" gutter={12}>
              <Col xs={24} sm={10}>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Tooltip formatter={(v: any, n: any) => [v + ' sub-topics', n]} />
                    <Pie data={d.programRows.map((p: any) => ({ name: p.name, value: p.items }))} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={2} isAnimationActive={false} onClick={(e: any) => e && nav('/content?program=' + encodeURIComponent(e.name))}>
                      {d.programRows.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} cursor="pointer" />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </Col>
              <Col xs={24} sm={14}>
                <div style={{ maxHeight: 230, overflowY: 'auto', paddingRight: 6 }}>
                {d.programRows.map((p: any, i: number) => (
                  <div key={p.name} onClick={() => nav('/content?program=' + encodeURIComponent(p.name))} title="Open this program" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9, cursor: 'pointer' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ width: 150, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <Progress percent={p.completion} size="small" strokeColor={PRIMARY} style={{ flex: 1, margin: 0 }} />
                    <span style={{ width: 56, textAlign: 'right', fontSize: 12, color: '#69707d' }}>{p.items} items</span>
                    {(() => { const m = dueMeta(p.due_date); return m ? <span style={{ width: 80, textAlign: 'right', fontSize: 11, fontWeight: 700, color: m.color, whiteSpace: 'nowrap' }} title={'Due ' + m.label}>{m.text}</span> : <span style={{ width: 80 }} /> })()}
                  </div>
                ))}
                </div>
                {d.programRows.length > 6 && <div style={{ fontSize: 11, color: '#9aa1ad', marginTop: 4 }}>{d.programRows.length} programs · scroll to see all</div>}
              </Col>
            </Row>}
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={12} md={6}><KpiCard icon={<AppstoreOutlined />} tint={PRIMARY} label="Sub-topics" value={d.itemCount} onClick={() => nav('/content')} /></Col>
        <Col xs={12} md={6}><KpiCard icon={<FieldTimeOutlined />} tint="#c2790a" label="Pending" value={d.pending} onClick={() => nav('/content')} /></Col>
        <Col xs={12} md={6}><KpiCard icon={<SafetyCertificateOutlined />} tint="#16a34a" label="Published" value={d.done} onClick={() => nav('/content?stage=Published')} /></Col>
        <Col xs={12} md={6}><KpiCard icon={<TeamOutlined />} tint="#0ea5e9" label="People" value={d.people} onClick={() => nav('/people')} /></Col>
      </Row>
      <Card title={`Subjects (${d.subjectRows.length})`} extra={<span style={{ fontSize: 11, color: '#9aa1ad' }}>click a subject to see its sub-topics →</span>} style={{ marginTop: 16 }}>
        <Table size="middle" pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }} scroll={{ y: 420 }} columns={subjCols as any} dataSource={d.subjectRows.map((r: any) => ({ ...r, key: r.subject_id }))} locale={{ emptyText: <Empty description="No subjects yet" /> }}
          onRow={(r: any) => ({ onClick: () => nav('/content?subject=' + encodeURIComponent(r.name)), style: { cursor: 'pointer' } })} />
      </Card>
      <Card title={`Pipeline — where the ${d.itemCount} sub-topics are now`} extra={<span style={{ fontSize: 11, color: '#9aa1ad' }}>click a stage to see what’s pending →</span>} style={{ marginTop: 16 }}>
        {d.stageOrder.map((s: any) => {
          const c = d.dist[s.name] || 0
          return (
            <div key={s.seq} onClick={() => nav('/content?stage=' + encodeURIComponent(s.name))} title="See what's pending at this stage" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 11, cursor: 'pointer' }}>
              <span style={{ width: 150, fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: STAGE_COLORS[s.seq] }} />{s.name}</span>
              <Progress percent={d.itemCount ? Math.round((c / d.itemCount) * 100) : 0} showInfo={false} strokeColor={STAGE_COLORS[s.seq]} style={{ flex: 1, margin: 0 }} />
              <b style={{ width: 40, textAlign: 'right' }}>{c}</b>
            </div>
          )
        })}
        {d.done > 0 && <div style={{ color: '#16a34a', fontWeight: 600, fontSize: 12, marginTop: 6 }}>✓ {d.done} approved &amp; published to the library</div>}
      </Card>
      </> }, { key: 'release', label: 'Release details', children: <ReleaseDetails /> }]} />
    </div>
  )
}

/* ===================== release planning (Command Center → Release details) ===================== */
// Lists subjects/topics that are completed (through Shooting, and through Final Review), and lets you
// create named release batches and map each completed subject to a release with its date.
function ReleaseDetails() {
  const { person } = useAuth()
  const { message: msg } = AntApp.useApp()
  const isAdmin = person?.role === 'admin'
  const canEdit = isAdmin || OWNER_ROLES.includes(person?.role)
  const [items, setItems] = useState<any>(null)
  const [releases, setReleases] = useState<any[]>([])
  const [relItem, setRelItem] = useState<any>({}) // content_item_id -> release id (the finest mapping grain)
  const [missing, setMissing] = useState(false)
  const [add, setAdd] = useState(false)
  const [rName, setRName] = useState(''); const [rDate, setRDate] = useState<any>(null)
  const [planRel, setPlanRel] = useState<any>(null)       // the release you're currently planning into (drives the ticks)
  const [chartRel, setChartRel] = useState<string>('all') // which release version the readiness chart shows
  async function loadReleases() {
    if (MOCK_MENTOR_SUBTOPIC) { setReleases(mockListReleases()); setRelItem(mockReleaseItems()); setMissing(false); return }
    const r = await supabase.from('release_plan').select('*').order('release_date', { ascending: true })
    if (r.error) { setMissing(true); setReleases([]); return }
    setMissing(false); setReleases(r.data || [])
    const ri = await supabase.from('release_plan_item').select('plan_id, content_item_id')
    if (ri.error) setMissing(true) // item table/policies not applied yet → prompt to (re-)run v32
    const m: any = {}; (ri.data || []).forEach((x: any) => { m[x.content_item_id] = x.plan_id }); setRelItem(m)
  }
  async function load() { setItems(await fetchAllItems()); await loadReleases() }
  useEffect(() => { load() }, [])
  async function addRelease() {
    if (!rName.trim()) { msg.warning('Name the release (e.g. Release 1).'); return }
    const dstr = rDate ? rDate.format('YYYY-MM-DD') : null
    if (MOCK_MENTOR_SUBTOPIC) mockAddRelease(rName.trim(), dstr)
    else { const ins = await supabase.from('release_plan').insert({ name: rName.trim(), release_date: dstr, created_by: person?.id || null }); if (ins.error) { msg.error(/release_plan|relation|does not exist/.test(ins.error.message) ? 'Run RecTrack_v32_release_plan.sql first.' : ins.error.message); return } }
    msg.success('Release added ✓'); setAdd(false); setRName(''); setRDate(null); loadReleases()
  }
  async function delRelease(id: string) {
    if (MOCK_MENTOR_SUBTOPIC) mockDeleteRelease(id)
    else { const u = await supabase.from('release_plan').delete().eq('id', id); if (u.error) { msg.error(u.error.message); return } }
    loadReleases()
  }
  // a release-table error usually means v32 (or its updated item table/policies) isn't applied yet
  const relErr = (e: any) => /release_plan|relation|schema cache|does not exist|permission|policy|row-level/i.test(e?.message || '') ? 'Couldn’t save — run RecTrack_v32_release_plan.sql in Supabase (it creates release_plan_item + its read/write policies), then retry.' : (e?.message || 'Could not save.')
  // Set the release for a set of sub-topics (planId) or clear it (null). One release per sub-topic, so
  // we always delete the old mapping first. The tick then reflects the PERSISTED mapping → it stays.
  async function setItemsRelease(ciIds: string[], planId: string | null) {
    if (!ciIds.length) return
    if (MOCK_MENTOR_SUBTOPIC) { ciIds.forEach(id => mockSetReleaseItem(id, planId)); setRelItem(mockReleaseItems()) }
    else {
      const del = await supabase.from('release_plan_item').delete().in('content_item_id', ciIds)
      if (del.error) { msg.error(relErr(del.error)); return }
      if (planId) { const ins = await supabase.from('release_plan_item').insert(ciIds.map(id => ({ plan_id: planId, content_item_id: id }))); if (ins.error) { msg.error(relErr(ins.error)); return } }
      await loadReleases() // re-read persisted mapping so ticks survive refresh
    }
  }
  if (!items) return <div style={{ display: 'grid', placeItems: 'center', height: 240 }}><Spin /></div>
  // group content by SUBJECT → TOPIC (serial) → SUB-TOPIC (serial) with per-sub-topic completion flags
  const bySubj: any = {}
  items.forEach((it: any) => {
    if (!it.subjectId) return
    const shotDone = it.byCode.SHOOTING?.status === 'Completed' || it.byCode.SHOOT_REVIEW?.status === 'Completed'
    const finalDone = it.byCode.FINAL_REVIEW?.status === 'Completed'
    const e = bySubj[it.subjectId] = bySubj[it.subjectId] || { subjectId: it.subjectId, subject: it.subject, program: it.program, subs: [] }
    e.subs.push({ ciId: it.id, name: it.name, topicId: it.topicId || it.topic, topic: it.topic || '—', chapter: it.chapter, shotDone, finalDone })
  })
  const subjRows = (Object.values(bySubj) as any[]).map((s: any) => {
    const byTopic: any = {}
    s.subs.forEach((x: any) => { (byTopic[x.topicId] = byTopic[x.topicId] || { topicId: x.topicId, topic: x.topic, chapter: x.chapter, subs: [] }).subs.push(x) })
    const topics = (Object.values(byTopic) as any[]).sort((a: any, b: any) => String(a.topic).localeCompare(String(b.topic))).map((t: any, ti: number) => {
      const subs = t.subs.slice().sort((a: any, b: any) => String(a.name).localeCompare(String(b.name))).map((x: any, si: number) => ({ ...x, sr: `${ti + 1}.${si + 1}` }))
      return { ...t, sr: ti + 1, subs, total: subs.length, shot: subs.filter((x: any) => x.shotDone).length, final: subs.filter((x: any) => x.finalDone).length }
    })
    const total = s.subs.length, shot = s.subs.filter((x: any) => x.shotDone).length, final = s.subs.filter((x: any) => x.finalDone).length
    return { subjectId: s.subjectId, subject: s.subject, program: s.program, topics, total, shot, final, releaseReady: total > 0 && final === total }
  }).filter((s: any) => s.shot > 0).sort((a: any, b: any) => (b.releaseReady ? 1 : 0) - (a.releaseReady ? 1 : 0) || b.final - a.final || String(a.subject).localeCompare(String(b.subject)))
  const allSubs = subjRows.flatMap((s: any) => s.topics.flatMap((t: any) => t.subs))
  const readyCiIds = allSubs.filter((x: any) => x.finalDone).map((x: any) => x.ciId) // release-ready = through Final Review
  const relName = (id: string) => releases.find((r: any) => r.id === id)?.name || '—'
  const relOpts = releases.map((r: any) => ({ value: r.id, label: r.name + (r.release_date ? ' · ' + dayjs(r.release_date).format('DD MMM YYYY') : '') }))
  // chart: per subject, ready vs remaining SUB-TOPICS, scoped to the chosen release version
  const inChart = (x: any) => { if (chartRel === 'all') return true; const e = relItem[x.ciId] || null; return chartRel === 'none' ? !e : e === chartRel }
  const chartData = subjRows.map((s: any) => {
    const subs = s.topics.flatMap((t: any) => t.subs).filter(inChart)
    const ready = subs.filter((x: any) => x.finalDone).length
    return { subject: s.subject, ready, remaining: subs.length - ready, totalSubs: subs.length }
  }).filter((d: any) => d.totalSubs > 0).sort((a: any, b: any) => b.ready - a.ready || b.totalSubs - a.totalSubs)
  const fullyReady = chartData.filter((d: any) => d.totalSubs > 0 && d.ready === d.totalSubs).length
  const chartH = Math.max(160, chartData.length * 34 + 30)
  const chartRelOpts = [{ value: 'all', label: 'All releases' }, ...relOpts, { value: 'none', label: 'Unmapped sub-topics' }]
  const relCell = (rid: string | undefined) => rid ? <Tag color="geekblue">{relName(rid)}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span>
  // a sub-topic ticked = it is mapped to the release you're planning; disabled if it belongs to a DIFFERENT release
  const subTopicCols = [
    ...(canEdit ? [{ title: '', width: 44, render: (_: any, x: any) => { const other = relItem[x.ciId] && relItem[x.ciId] !== planRel; return <ATooltip title={!planRel ? 'Pick a release above first' : other ? `In ${relName(relItem[x.ciId])}` : ''}><Checkbox checked={!!planRel && relItem[x.ciId] === planRel} disabled={!planRel || !!other} onChange={(e: any) => setItemsRelease([x.ciId], e.target.checked ? planRel : null)} /></ATooltip> } }] : []),
    { title: 'Sr.', dataIndex: 'sr', width: 64 },
    { title: 'Sub-topic', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Shooting', width: 100, render: (_: any, x: any) => x.shotDone ? <Tag color="green">Done</Tag> : <Tag>—</Tag> },
    { title: 'Final review', width: 110, render: (_: any, x: any) => x.finalDone ? <Tag color="green">Done</Tag> : <Tag>—</Tag> },
    { title: 'Release', width: 160, render: (_: any, x: any) => relCell(relItem[x.ciId]) },
  ]
  const topicCols = [
    ...(canEdit ? [{ title: '', width: 44, render: (_: any, t: any) => {
      const avail = t.subs.filter((x: any) => !relItem[x.ciId] || relItem[x.ciId] === planRel) // not locked to another release
      const inThis = avail.filter((x: any) => relItem[x.ciId] === planRel)
      return <ATooltip title={!planRel ? 'Pick a release above first' : ''}><Checkbox disabled={!planRel || !avail.length} indeterminate={inThis.length > 0 && inThis.length < avail.length} checked={avail.length > 0 && inThis.length === avail.length}
        onChange={(e: any) => e.target.checked ? setItemsRelease(avail.map((x: any) => x.ciId), planRel) : setItemsRelease(inThis.map((x: any) => x.ciId), null)} /></ATooltip>
    } }] : []),
    { title: 'Sr.', dataIndex: 'sr', width: 56 },
    { title: 'Topic', render: (_: any, t: any) => <span>{t.topic}{t.chapter ? <div style={{ fontSize: 11, color: '#9aa1ad' }}>{t.chapter}</div> : null}</span> },
    { title: 'Sub-topics', dataIndex: 'total', width: 90 },
    { title: 'Through Shooting', width: 140, render: (_: any, t: any) => <Tag color={t.shot === t.total ? 'green' : 'orange'}>{t.shot}/{t.total}</Tag> },
    { title: 'Through Final Review', width: 160, render: (_: any, t: any) => <Tag color={t.final === t.total ? 'green' : t.final ? 'orange' : 'default'}>{t.final}/{t.total}</Tag> },
    { title: 'Release', width: 150, render: (_: any, t: any) => { const rs = [...new Set(t.subs.map((x: any) => relItem[x.ciId]).filter(Boolean))]; return rs.length === 0 ? <span style={{ color: '#9aa1ad' }}>—</span> : rs.length === 1 ? relCell(rs[0] as string) : <Tag color="orange">Mixed</Tag> } },
  ]
  const subjCols = [
    { title: 'Subject', render: (_: any, s: any) => <span><b>{s.subject}</b><div style={{ fontSize: 11, color: '#9aa1ad' }}>{s.program}</div></span> },
    { title: 'Topics', dataIndex: 'topics', width: 80, render: (v: any[]) => v.length },
    { title: 'Sub-topics', dataIndex: 'total', width: 100 },
    { title: 'Through Shooting', width: 150, render: (_: any, s: any) => <Tag color={s.shot === s.total ? 'green' : 'orange'}>{s.shot}/{s.total}</Tag> },
    { title: 'Through Final Review', width: 170, render: (_: any, s: any) => <Tag color={s.final === s.total ? 'green' : s.final ? 'orange' : 'default'}>{s.final}/{s.total}</Tag> },
    { title: 'Status', width: 140, render: (_: any, s: any) => s.releaseReady ? <Tag color="green">Release ready</Tag> : <Tag color="orange">In progress</Tag> },
  ]
  const topicTable = (s: any) => <Table size="small" rowKey="topicId" pagination={false} columns={topicCols as any} dataSource={s.topics}
    expandable={{ expandedRowRender: (t: any) => <Table size="small" rowKey="ciId" pagination={false} columns={subTopicCols as any} dataSource={t.subs} /> }} />
  return <div>
    {missing && <Card style={{ marginBottom: 16 }}><Empty description={<span>Run <b>RecTrack_v32_release_plan.sql</b> in Supabase to enable release planning.</span>} /></Card>}
    <Card title="Releases" style={{ marginBottom: 16 }} extra={canEdit ? <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAdd(true)}>New release</Button> : undefined}>
      {releases.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No releases yet — create one, then map sub-topics to it below." />
        : <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{releases.map((r: any) => {
          const n = Object.keys(relItem).filter((cid: string) => relItem[cid] === r.id).length
          return <div key={r.id} style={{ border: '1px solid #eef0f3', borderRadius: 10, padding: '10px 14px', minWidth: 200, background: '#fafbfc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <b>{r.name}</b>
              {isAdmin && <Popconfirm title="Delete this release? Its sub-topic mappings will be cleared." okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => delRelease(r.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>}
            </div>
            <div style={{ fontSize: 12, color: '#69707d' }}>{r.release_date ? dayjs(r.release_date).format('DD MMM YYYY') : 'No date set'}</div>
            <div style={{ fontSize: 11, color: '#9aa1ad', marginTop: 4 }}>{n} sub-topic{n === 1 ? '' : 's'} mapped</div>
          </div>
        })}</div>}
    </Card>
    <Card title="Release readiness by subject" style={{ marginBottom: 16 }}
      extra={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: '#9aa1ad' }}>{fullyReady} subject{fullyReady === 1 ? '' : 's'} fully ready</span>
        <Select size="small" style={{ minWidth: 200 }} value={chartRel} onChange={setChartRel} options={chartRelOpts} />
      </span>}>
      {chartData.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={chartRel === 'all' ? 'No subjects have reached Shooting completion yet.' : chartRel === 'none' ? 'Every sub-topic is mapped to a release.' : 'No sub-topics are mapped to this release yet.'} />
        : <>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }} barCategoryGap={10}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="subject" width={150} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any, n: any) => [`${v} sub-topic${v === 1 ? '' : 's'}`, n === 'ready' ? 'Ready for release' : 'Still in progress']} />
              <Bar dataKey="ready" stackId="a" fill="#16a34a" name="ready" radius={[3, 0, 0, 3]}>
                <LabelList dataKey="ready" position="insideRight" fill="#fff" fontSize={11} formatter={(v: any) => (v > 0 ? v : '')} />
              </Bar>
              <Bar dataKey="remaining" stackId="a" fill="#e2e8f0" name="remaining" radius={[0, 3, 3, 0]}>
                <LabelList dataKey="totalSubs" position="right" fill="#69707d" fontSize={11} formatter={(v: any) => `${v} total`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#69707d', marginTop: 4 }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#16a34a', borderRadius: 2, marginRight: 6 }} />Ready for release (sub-topics through Final Review)</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#e2e8f0', borderRadius: 2, marginRight: 6 }} />Still in progress</span>
          </div>
        </>}
    </Card>
    <Card title="Completed subjects — map topics & sub-topics to a release" extra={<span style={{ fontSize: 12, color: '#9aa1ad' }}>Pick a release, then tick sub-topics (or a topic to take all of its sub-topics). Ticks show what’s in that release and stay ticked. Unticking frees a sub-topic for another release.</span>}>
      {canEdit && (() => {
        const inPlan = planRel ? Object.keys(relItem).filter((ci: string) => relItem[ci] === planRel).length : 0
        const availReady = planRel ? readyCiIds.filter((ci: string) => !relItem[ci] || relItem[ci] === planRel) : []
        return <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap', background: planRel ? '#fff7ed' : '#f7f8fb', border: '1px solid ' + (planRel ? '#fdba74' : '#eef0f3'), borderRadius: 10, padding: '8px 12px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#69707d' }}>Planning release</span>
          <Select allowClear size="small" style={{ minWidth: 230 }} placeholder="Choose a release to plan into" value={planRel} onChange={setPlanRel} options={relOpts} notFoundContent="Add a release above first" />
          <Button size="small" type="primary" disabled={!planRel || !availReady.length} onClick={() => setItemsRelease(availReady, planRel)}>Add all release-ready sub-topics ({availReady.length})</Button>
          <span style={{ flex: 1 }} />
          {planRel ? <span style={{ fontSize: 12, color: '#69707d' }}><b>{inPlan}</b> sub-topic{inPlan === 1 ? '' : 's'} in {relName(planRel)}</span> : <span style={{ fontSize: 12, color: '#9aa1ad' }}>Pick a release to enable the tickboxes</span>}
        </div>
      })()}
      <Table size="middle" rowKey="subjectId" columns={subjCols as any} dataSource={subjRows} pagination={{ pageSize: 15 }}
        expandable={{ expandedRowRender: (s: any) => topicTable(s) }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No subjects have reached Shooting completion yet." /> }} />
    </Card>
    <Modal open={add} title="New release" okText="Add" onOk={addRelease} onCancel={() => { setAdd(false); setRName(''); setRDate(null) }} destroyOnClose>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#69707d', margin: '4px 0' }}>Release name</div>
      <Input placeholder="e.g. Release 1" value={rName} onChange={e => setRName(e.target.value)} />
      <div style={{ fontSize: 12, fontWeight: 600, color: '#69707d', margin: '10px 0 4px' }}>Release date</div>
      <DatePicker style={{ width: '100%' }} value={rDate} onChange={(v: any) => setRDate(v)} />
    </Modal>
  </div>
}

/* ===================== stage editor ===================== */
function StageEditor({ item, canAssign, trainers = [], onClose, onSaved }: any) {
  const { message: msg } = AntApp.useApp()
  const { person } = useAuth()
  const canFinalReview = person?.role === 'manager' || person?.role === 'admin' // Final Review is Manager-only (Program Head included)
  const contentItemId = item.id, name = item.name
  const [rows, setRows] = useState<any>(null)
  const [cfields, setCfields] = useState<any[]>([])
  const [cvals, setCvals] = useState<any>({})
  const [owner, setOwner] = useState<any>(null)
  const [aTrainer, setATrainer] = useState<any>(undefined)
  const [aBusy, setABusy] = useState(false)
  const [createdAt, setCreatedAt] = useState<any>(null)
  async function loadOwner() {
    const ow = await supabase.from('v_item_owner').select('trainer_id, level').eq('content_item_id', contentItemId).maybeSingle()
    if (!ow.error && ow.data) {
      const nm = ow.data.trainer_id ? (trainers.find((t: any) => t.id === ow.data.trainer_id)?.full_name || '—') : null
      setOwner({ trainerId: ow.data.trainer_id, level: ow.data.level, trainerName: nm })
      setATrainer(ow.data.trainer_id || undefined)
    } else setOwner({ trainerId: null, level: null })
  }
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('item_stage').select('id,status,started_on,due_on,completed_on, stage:stage_id(name,sequence)').eq('content_item_id', contentItemId)
      setRows((data || []).sort((a: any, b: any) => a.stage.sequence - b.stage.sequence))
      const cf = await supabase.from('custom_field').select('*').order('sort')
      setCfields(cf.data || [])
      const ci = await supabase.from('content_item').select('custom, created_at').eq('id', contentItemId).maybeSingle()
      setCvals(ci.data?.custom || {})
      setCreatedAt(ci.data?.created_at || null)
      loadOwner()
    })()
  }, [contentItemId])
  async function setStatus(id: string, status: string) {
    const prev = rows
    setRows((rs: any) => rs.map((r: any) => r.id === id ? { ...r, status } : r))
    try { await setItemStage(id, status); onSaved && onSaved() }
    catch (e: any) { setRows(prev); msg.error(e.message || 'Could not save') }
  }
  async function setCustom(label: string, val: any) {
    const nv = { ...cvals, [label]: val }
    setCvals(nv)
    const { error } = await supabase.from('content_item').update({ custom: nv }).eq('id', contentItemId)
    if (error) msg.error(error.message)
  }
  async function assignSub(trainerId: any) {
    setATrainer(trainerId); setABusy(true)
    const { error } = await supabase.rpc('rt_set_owner', { scope: 'subtopic', ref_id: item.id, trainer: trainerId || null })
    setABusy(false)
    if (error) { msg.error(/rt_set_owner|function/.test(error.message) ? 'Run RecTrack_v7.sql to enable assignment.' : error.message); return }
    msg.success(trainerId ? 'Assigned this sub-topic ✓' : 'Cleared'); loadOwner(); onSaved && onSaved()
  }
  return (
    <Drawer open width={460} onClose={onClose} title={<div><div style={{ fontSize: 11, color: '#69707d', textTransform: 'uppercase', letterSpacing: .3 }}>Sub-topic</div><div style={{ fontWeight: 800, fontSize: 16 }}>{name}</div><div style={{ fontSize: 11, color: '#9aa1ad' }}>{item.subject} › {item.chapter} › {item.topic}</div></div>}>
      <div style={{ background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Assigned trainer</div>
        <div style={{ fontSize: 13, marginBottom: canAssign ? 10 : 0 }}>
          {owner?.trainerId ? <span><Avatar size={20} style={{ background: '#a855f7', marginRight: 6, fontSize: 11 }}>{(owner.trainerName || '?')[0]}</Avatar><b>{owner.trainerName || '—'}</b> <Tag style={{ marginInlineStart: 4 }}>{owner.level}</Tag></span> : <Tag color="default">Unassigned</Tag>}
        </div>
        {canAssign ? <>
          <Select value={aTrainer} onChange={(v) => assignSub(v)} allowClear loading={aBusy} showSearch optionFilterProp="label" placeholder="Assign just this sub-topic" style={{ width: '100%' }} options={trainers.map((t: any) => ({ value: t.id, label: t.full_name }))} />
          <div style={{ fontSize: 11, color: '#9aa1ad', marginTop: 6 }}>Sets only this sub-topic. To assign a whole Subject / Chapter / Topic at once, use the <b>Assignments</b> screen.</div>
        </> : <div style={{ fontSize: 11, color: '#9aa1ad' }}>Only the Program Head or someone with “Can assign” can change this.</div>}
      </div>
      <p style={{ color: '#69707d', fontSize: 12, marginTop: 0, marginBottom: createdAt ? 4 : 12 }}>Set each stage — the dashboard updates instantly.</p>
      {createdAt && <div style={{ fontSize: 11, color: '#9aa1ad', marginBottom: 10 }}><HistoryOutlined style={{ marginRight: 5 }} />Created {dayjs(createdAt).format('DD MMM YYYY, HH:mm')}</div>}
      {!rows ? <Spin /> : rows.map((r: any) => {
        const hist = [r.started_on && `Opened ${dayjs(r.started_on).format('DD MMM YYYY')}`, r.completed_on && `Completed ${dayjs(r.completed_on).format('DD MMM YYYY')}`, r.due_on && `Due ${dayjs(r.due_on).format('DD MMM YYYY')}`].filter(Boolean).join('  ·  ')
        return (
        <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: STAGE_COLORS[r.stage.sequence] }} />
            <div style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{r.stage.name}</div>
            {r.stage.name === 'Final Review' && !canFinalReview
              ? <ATooltip title="Only a Manager can update Final Review"><span><Select size="small" value={r.status} style={{ width: 150 }} disabled options={STATUS_OPTS.map(o => ({ value: o, label: o }))} /></span></ATooltip>
              : <Select size="small" value={r.status} style={{ width: 150 }} onChange={(v) => setStatus(r.id, v)} options={STATUS_OPTS.map(o => ({ value: o, label: o }))} />}
          </div>
          <div style={{ fontSize: 11, color: '#9aa1ad', marginLeft: 22, marginTop: 4 }}>{hist || 'Not opened yet'}</div>
        </div>
      )})}
      {cfields.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Custom details</div>
          {cfields.map((f: any) => (
            <div key={f.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#69707d', marginBottom: 4 }}>{f.label}</div>
              {f.field_type === 'dropdown'
                ? <Select style={{ width: '100%' }} value={cvals[f.label]} placeholder="Select" onChange={(v) => setCustom(f.label, v)} options={(f.options || []).map((o: string) => ({ value: o, label: o }))} />
                : <Input type={f.field_type === 'number' ? 'number' : 'text'} value={cvals[f.label] ?? ''} onChange={(e) => setCustom(f.label, e.target.value)} />}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  )
}

/* ===================== modify content (rename / move) — Program Head ===================== */
function ModifyModal({ item, onClose, onSaved }: any) {
  const { message: msg } = AntApp.useApp()
  const [name, setName] = useState(item?.name || '')
  const [doMove, setDoMove] = useState(false)
  const [progs, setProgs] = useState<any[]>([])
  const [prog, setProg] = useState<string>(); const [subj, setSubj] = useState<string>()
  const [chap, setChap] = useState<string>(); const [top, setTop] = useState<string>()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!item) return
    setName(item.name || ''); setDoMove(false); setProg(undefined); setSubj(undefined); setChap(undefined); setTop(undefined)
    supabase.from('main_subject').select('id,name').order('name').then(({ data }: any) => setProgs(data || []))
  }, [item?.id])
  const progId = progs.find(p => p.name === prog)?.id
  const subjects = useChildren('subject', 'main_subject_id', progId)
  const subjId = subjects.find((s: any) => s.name === subj)?.id
  const chapters = useChildren('chapter', 'subject_id', subjId)
  const chapId = chapters.find((c: any) => c.name === chap)?.id
  const topics = useChildren('topic', 'chapter_id', chapId)
  async function save() {
    if (!name.trim()) { msg.error('Name cannot be empty.'); return }
    setBusy(true)
    try {
      if (name.trim() !== item.name) {
        const { error } = await supabase.from('subtopic').update({ name: name.trim() }).eq('id', item.subtopicId)
        if (error) throw error
      }
      if (doMove) {
        if (![prog, subj, chap, top].every(x => x && String(x).trim())) throw new Error('Pick the destination Program → Subject → Chapter → Topic.')
        const mainId = await findOrCreateMain(prog!.trim())
        const sId = await findOrCreateChild('subject', 'main_subject_id', mainId, subj!.trim())
        const cId = await findOrCreateChild('chapter', 'subject_id', sId, chap!.trim())
        const tId = await findOrCreateChild('topic', 'chapter_id', cId, top!.trim())
        const { error } = await supabase.from('subtopic').update({ topic_id: tId }).eq('id', item.subtopicId)
        if (error) throw error
      }
      msg.success('Content updated ✓'); onSaved()
    } catch (e: any) { msg.error(e.message || 'Could not update') } finally { setBusy(false) }
  }
  return (
    <Modal open={!!item} title="Modify content" okText="Save" confirmLoading={busy} onOk={save} onCancel={onClose} destroyOnClose>
      <div style={{ fontSize: 12, color: '#9aa1ad', marginBottom: 12 }}>Currently: {item?.subject} › {item?.chapter} › {item?.topic}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#69707d', marginBottom: 4 }}>Name</div>
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Content / sub-topic name" onPressEnter={save} />
      <Checkbox checked={doMove} onChange={e => setDoMove(e.target.checked)} style={{ marginTop: 14 }}>Move to a different topic</Checkbox>
      {doMove && <div style={{ marginTop: 12 }}>
        <LevelField label="Program" value={prog} options={progs} placeholder="Pick a program" onChange={(v: string) => { setProg(v); setSubj(undefined); setChap(undefined); setTop(undefined) }} />
        <LevelField label="Subject" value={subj} options={subjects} disabled={!prog} placeholder={prog ? 'Pick or type a subject' : 'Choose a program first'} onChange={(v: string) => { setSubj(v); setChap(undefined); setTop(undefined) }} />
        <LevelField label="Chapter" value={chap} options={chapters} disabled={!subj} placeholder={subj ? 'Pick or type a chapter' : 'Choose a subject first'} onChange={(v: string) => { setChap(v); setTop(undefined) }} />
        <LevelField label="Topic" value={top} options={topics} disabled={!chap} placeholder={chap ? 'Pick or type a topic' : 'Choose a chapter first'} onChange={(v: string) => setTop(v)} />
        <div style={{ fontSize: 11, color: '#9aa1ad' }}>Re-parents this content under the chosen topic.</div>
      </div>}
      <p style={{ fontSize: 12, color: '#c2790a', margin: '12px 0 0' }}>Renaming changes the name everywhere it appears in the system.</p>
    </Modal>
  )
}

/* ===================== content explorer (table) ===================== */
function ContentExplorer() {
  const { person, canAssign, seesAll } = useAuth(); const isAdmin = person?.role === 'admin'
  // Team Leads ALWAYS see only their assigned content — never all of it, regardless of the "Sees all" toggle.
  const scoped = !seesAll || person?.role === 'team_lead'
  const { message: msg } = AntApp.useApp()
  const [sp] = useSearchParams()
  const [rows, setRows] = useState<any>(null)
  const [trainers, setTrainers] = useState<any[]>([])
  const [q, setQ] = useState(''); const [chap, setChap] = useState<any>(null); const [stageF, setStageF] = useState<any>(sp.get('stage')); const [subjectF, setSubjectF] = useState<any>(sp.get('subject')); const [statusF, setStatusF] = useState<any>(null)
  const [programF, setProgramF] = useState<any>(sp.get('program'))
  const [trainerF, setTrainerF] = useState<any>(null)
  const [topicF, setTopicF] = useState<any>(null)
  const [onlyMine, setOnlyMine] = useState<boolean>(person?.role === 'trainer')
  const [editing, setEditing] = useState<any>(null)
  const [selKeys, setSelKeys] = useState<any[]>([])
  const [modify, setModify] = useState<any>(null)
  const [visIds, setVisIds] = useState<Set<string> | null>(null) // for scoped users: ids they may see
  const [delOpen, setDelOpen] = useState(false); const [delText, setDelText] = useState(''); const [delBusy, setDelBusy] = useState(false)
  const [addSubj, setAddSubj] = useState(false); const [addSub, setAddSub] = useState(false)
  const canDeleteProg = (person?.email || '').toLowerCase() === PH_EMAIL // program delete is for the Program Head only
  async function load() {
    const data = await selectAll('content_item', 'id, subtopic_id, subtopic:subtopic_id(name, topic:topic_id(id, name, chapter:chapter_id(id, name, subject:subject_id(id, name, main_subject:main_subject_id(id, name))))), item_stage(status, stage:stage_id(name,sequence,weight))')
    const ppl = await supabase.from('person').select('id, full_name, role, is_active')
    const pmap: any = {}; (ppl.data || []).forEach((p: any) => pmap[p.id] = p.full_name)
    setTrainers((ppl.data || []).filter((p: any) => (p.role === 'trainer' || OWNER_ROLES.includes(p.role)) && p.is_active).map((p: any) => ({ ...p, full_name: ownerOptLabel(p) })))
    const ow = await selectAll('v_item_owner', 'content_item_id, trainer_id, level')
    const omap: any = {}; ow.forEach((o: any) => omap[o.content_item_id] = { id: o.trainer_id, name: o.trainer_id ? (pmap[o.trainer_id] || 'Assigned') : null, level: o.level })
    const mapped = (data || []).map((ci: any) => {
      const stages = (ci.item_stage || []).slice().sort((a: any, b: any) => a.stage.sequence - b.stage.sequence)
      const weight = stages.reduce((s: number, x: any) => s + (x.status === 'Completed' ? Number(x.stage.weight) : 0), 0)
      const cur = stages.find((x: any) => x.status !== 'Completed')
      const o = omap[ci.id] || {}
      const sj = ci.subtopic?.topic?.chapter?.subject
      return {
        key: ci.id, id: ci.id, subtopicId: ci.subtopic_id, topicId: ci.subtopic?.topic?.id, chapterId: ci.subtopic?.topic?.chapter?.id, subjectId: sj?.id, programId: sj?.main_subject?.id,
        program: sj?.main_subject?.name || '', name: ci.subtopic?.name || '—', subject: sj?.name || '', chapter: ci.subtopic?.topic?.chapter?.name || '', topic: ci.subtopic?.topic?.name || '',
        stageName: cur ? cur.stage.name : 'Published', stageSeq: cur ? cur.stage.sequence : 99, completion: Math.round(weight * 100),
        ownerId: o.id || null, owner: o.name || null, ownerLevel: o.level || null,
      }
    })
    setRows(mapped)
    // if we arrived via a ?subject link (dashboard) without a program, fill in the program so the tree filters stay valid
    if (subjectF && !programF) { const p = mapped.find((r: any) => r.subject === subjectF)?.program; if (p) setProgramF(p) }
    if (scoped && person?.id) { const inScope = await buildScope(person); setVisIds(new Set(mapped.filter(inScope).map((r: any) => r.id))) }
    else setVisIds(null)
  }
  useEffect(() => { load() }, [])
  useAutoRefresh(load)
  async function bulkAssign(trainerId: any) {
    const ids = [...selKeys]
    let ok = 0, fail = 0, lastErr = ''
    for (const id of ids) {
      const { error } = await supabase.rpc('rt_set_owner', { scope: 'subtopic', ref_id: id, trainer: trainerId || null })
      if (error) { fail++; lastErr = error.message } else ok++
    }
    if (ok) msg.success(`${trainerId ? 'Assigned' : 'Unassigned'} ${ok} item${ok === 1 ? '' : 's'}${fail ? ` · ${fail} failed` : ''}`)
    else msg.error(/rt_set_owner|function/.test(lastErr) ? 'Run RecTrack_v7.sql to enable assignment.' : (lastErr || 'Could not assign'))
    setSelKeys([]); load()
  }
  // Program Head only: resolve the DEEPEST selected branch (program → subject → chapter → topic) to delete.
  // Every level cascades down (subject→chapters→topics→sub-topics→items→stages…), so one delete clears the branch.
  function delTarget() {
    const lvl = topicF ? 'topic' : chap ? 'chapter' : subjectF ? 'subject' : programF ? 'program' : null
    if (!lvl) return null
    const name = topicF || chap || subjectF || programF
    const match = (r: any) => (!programF || r.program === programF) && (!subjectF || r.subject === subjectF) && (!chap || r.chapter === chap) && (!topicF || r.topic === topicF)
    const r = (rows || []).find(match)
    const id = r ? (lvl === 'topic' ? r.topicId : lvl === 'chapter' ? r.chapterId : lvl === 'subject' ? r.subjectId : r.programId) : null
    const table = lvl === 'topic' ? 'topic' : lvl === 'chapter' ? 'chapter' : lvl === 'subject' ? 'subject' : 'main_subject'
    return { lvl, name, id, table, count: (rows || []).filter(match).length }
  }
  async function deleteBranch() {
    const t = delTarget()
    if (!t?.id) { msg.error('Pick a branch first.'); return }
    setDelBusy(true)
    const { data, error } = await supabase.from(t.table).delete().eq('id', t.id).select('id')
    setDelBusy(false)
    if (error) { msg.error(error.message); return }
    if (!data || !data.length) { msg.error(`Couldn't delete — only ${PH_EMAIL} may delete.`); return }
    msg.success(`${t.lvl} “${t.name}” and everything under it was deleted.`)
    setDelOpen(false); setDelText('')
    if (t.lvl === 'program') { setProgramF(null); setSubjectF(null); setChap(null); setTopicF(null) }
    else if (t.lvl === 'subject') { setSubjectF(null); setChap(null); setTopicF(null) }
    else if (t.lvl === 'chapter') { setChap(null); setTopicF(null) }
    else { setTopicF(null) }
    load()
  }
  if (!rows || (scoped && visIds === null)) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  // Scoped users (team leads / non "sees all") browse ONLY what's assigned to them, so the
  // Program/Subject/Chapter/Topic pickers must come from THEIR visible items — not the whole
  // catalogue. Otherwise the dropdowns leak programs they can't actually open. (The table is
  // already scoped via `filtered`/visIds below.)
  const scopedRows = (scoped && visIds) ? rows.filter((r: any) => visIds.has(r.id)) : rows
  // cascading: program → its subjects → its chapters → its topics
  const programs = [...new Set(scopedRows.map((r: any) => r.program))].filter(Boolean)
  const subjects = [...new Set(scopedRows.filter((r: any) => !programF || r.program === programF).map((r: any) => r.subject))].filter(Boolean)
  const chapters = [...new Set(scopedRows.filter((r: any) => (!programF || r.program === programF) && (!subjectF || r.subject === subjectF)).map((r: any) => r.chapter))].filter(Boolean)
  const topics = [...new Set(scopedRows.filter((r: any) => (!programF || r.program === programF) && (!subjectF || r.subject === subjectF) && (!chap || r.chapter === chap)).map((r: any) => r.topic))].filter(Boolean)
  const stageNames = [...new Set(scopedRows.map((r: any) => r.stageName))]
  const mineId = person?.id
  const dispProgram = programF || (subjectF ? (rows.find((r: any) => r.subject === subjectF)?.program) : null)
  const dt = delTarget() // the deepest branch selected, for the Program-Head delete button/modal
  const filtered = rows.filter((r: any) => (!programF || r.program === programF) && (!q || r.name.toLowerCase().includes(q.toLowerCase())) && (!subjectF || r.subject === subjectF) && (!chap || r.chapter === chap) && (!topicF || r.topic === topicF) && (!stageF || r.stageName === stageF) && (!trainerF || r.ownerId === trainerF) && (!scoped || (!!visIds && visIds.has(r.id))) && (!onlyMine || r.ownerId === mineId))
  const fDone = filtered.filter((r: any) => r.stageName === 'Published').length
  const fProg = filtered.filter((r: any) => r.completion > 0 && r.stageName !== 'Published').length
  const fNot = filtered.filter((r: any) => r.completion === 0).length
  const tableRows = statusF ? filtered.filter((r: any) => statusF === 'done' ? r.stageName === 'Published' : statusF === 'progress' ? (r.completion > 0 && r.stageName !== 'Published') : r.completion === 0) : filtered
  const columns = [
    { title: 'Sub-topic', dataIndex: 'name', render: (v: string, r: any) => <div><div style={{ fontWeight: 600 }}>{v}</div><div style={{ fontSize: 11, color: '#9aa1ad' }}>{r.chapter} › {r.topic}</div></div> },
    { title: 'Current stage', dataIndex: 'stageName', width: 200, render: (v: string, r: any) => <StageBadge name={v} seq={r.stageSeq} /> },
    { title: 'Assigned to', width: 180, render: (_: any, r: any) => r.owner ? <span><Avatar size={20} style={{ background: '#a855f7', marginRight: 6, fontSize: 11 }}>{(r.owner || '?')[0]}</Avatar>{r.owner}{r.ownerLevel && <Tag style={{ marginInlineStart: 4 }}>{r.ownerLevel}</Tag>}</span> : <Tag color="default">Unassigned</Tag> },
    { title: 'Completion', dataIndex: 'completion', width: 170, render: (v: number) => <Progress percent={v} size="small" strokeColor={PRIMARY} /> },
    { title: '', width: 130, render: (_: any, r: any) => <span onClick={(e: any) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
      <Button size="small" type="link" onClick={() => setEditing(r)}>Open</Button>
      {isAdmin && <Button size="small" type="text" icon={<EditOutlined />} title="Modify (rename / move)" onClick={() => setModify(r)} />}
    </span> },
  ]
  return (
    <div>
      <PageHead title={dispProgram && subjectF ? `Content · ${dispProgram} › ${subjectF}` : dispProgram ? `Content · ${dispProgram}` : subjectF ? `Content · ${subjectF}` : 'Content'} sub={`${filtered.length} sub-topics${scoped ? ' · your assigned work' : ''}${chap ? ` · ${chap}` : ''}${stageF ? ` · stage: ${stageF}` : ''}`} />
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={8}><Card hoverable onClick={() => setStatusF(statusF === 'done' ? null : 'done')} styles={{ body: { padding: 14 } }} style={statusF === 'done' ? { borderColor: '#16a34a', boxShadow: '0 0 0 1px #16a34a' } : undefined}><Statistic title="Published / done" value={fDone} valueStyle={{ color: '#16a34a', fontWeight: 800 }} /></Card></Col>
        <Col xs={8}><Card hoverable onClick={() => setStatusF(statusF === 'progress' ? null : 'progress')} styles={{ body: { padding: 14 } }} style={statusF === 'progress' ? { borderColor: '#2563eb', boxShadow: '0 0 0 1px #2563eb' } : undefined}><Statistic title="In progress" value={fProg} valueStyle={{ color: '#2563eb', fontWeight: 800 }} /></Card></Col>
        <Col xs={8}><Card hoverable onClick={() => setStatusF(statusF === 'notstarted' ? null : 'notstarted')} styles={{ body: { padding: 14 } }} style={statusF === 'notstarted' ? { borderColor: '#6b7280', boxShadow: '0 0 0 1px #6b7280' } : undefined}><Statistic title="Not started" value={fNot} valueStyle={{ color: '#6b7280', fontWeight: 800 }} /></Card></Col>
      </Row>
      <Card styles={{ body: { padding: 16 } }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <Input prefix={<SearchOutlined style={{ color: '#9aa1ad' }} />} placeholder="Search sub-topic…" allowClear style={{ maxWidth: 200 }} value={q} onChange={e => setQ(e.target.value)} />
          <Select placeholder="Program" allowClear showSearch style={{ minWidth: 160 }} value={programF} onChange={(v) => { setProgramF(v); setSubjectF(null); setChap(null); setTopicF(null) }} options={programs.map((p: any) => ({ value: p, label: p }))} />
          <Select placeholder="Subject" allowClear showSearch disabled={!programF} style={{ minWidth: 160 }} value={subjectF} onChange={(v) => { setSubjectF(v); setChap(null); setTopicF(null) }} options={subjects.map((s: any) => ({ value: s, label: s }))} />
          <Select placeholder="Chapter" allowClear showSearch disabled={!subjectF} style={{ minWidth: 160 }} value={chap} onChange={(v) => { setChap(v); setTopicF(null) }} options={chapters.map((c: any) => ({ value: c, label: c }))} />
          <Select placeholder="Topic" allowClear showSearch disabled={!chap} style={{ minWidth: 160 }} value={topicF} onChange={setTopicF} options={topics.map((t: any) => ({ value: t, label: t }))} />
          <Select placeholder="Stage" allowClear style={{ minWidth: 140 }} value={stageF} onChange={setStageF} options={stageNames.map((s: any) => ({ value: s, label: s }))} />
          {!scoped && <Select placeholder="Trainer" allowClear style={{ minWidth: 160 }} value={trainerF} onChange={setTrainerF} options={trainers.map((t: any) => ({ value: t.id, label: t.full_name }))} />}
          {!scoped && <Checkbox checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} style={{ alignSelf: 'center' }}>Only mine</Checkbox>}
          {statusF && <Button size="small" onClick={() => setStatusF(null)}>Clear status</Button>}
          {canDeleteProg && <Button icon={<PlusOutlined />} onClick={() => setAddSubj(true)}>Add subject</Button>}
          {canDeleteProg && <Button icon={<PlusOutlined />} onClick={() => setAddSub(true)}>Add sub-topic</Button>}
          {canDeleteProg && dt && <Button danger icon={<DeleteOutlined />} onClick={() => { setDelText(''); setDelOpen(true) }}>Delete {dt.lvl}</Button>}
          <div style={{ marginLeft: 'auto', alignSelf: 'center', color: '#9aa1ad', fontSize: 12 }}>{tableRows.length} shown</div>
        </div>
        {selKeys.length > 0 && (canAssign || isAdmin) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eef0ff', border: '1px solid #d9defb', borderRadius: 8, padding: '8px 12px', marginBottom: 12, flexWrap: 'wrap' }}>
            <b>{selKeys.length} selected</b>
            {canAssign && <Select size="small" placeholder="Assign / reassign to…" style={{ width: 220 }} value={undefined} showSearch optionFilterProp="label"
              onChange={(v) => bulkAssign(v === '__none__' ? null : v)} options={[{ value: '__none__', label: '— Unassign —' }, ...trainers.map((t: any) => ({ value: t.id, label: t.full_name }))]} />}
            <Button type="text" size="small" onClick={() => setSelKeys([])}>Clear selection</Button>
            <span style={{ color: '#69707d', fontSize: 12 }}>Assign/reassign changes ownership only · Modify (rename/move) is per-row</span>
          </div>
        )}
        <Table size="middle" columns={columns as any} dataSource={tableRows} pagination={{ pageSize: 12, showSizeChanger: false }}
          rowSelection={(canAssign || isAdmin) ? { selectedRowKeys: selKeys, onChange: (keys: any) => setSelKeys(keys), preserveSelectedRowKeys: true } : undefined}
          onRow={(r: any) => ({ onClick: (e: any) => { if ((e.target as HTMLElement).closest('.ant-table-selection-column, .ant-checkbox-wrapper, .ant-checkbox, label')) return; setEditing(r) }, style: { cursor: 'pointer' } })} />
      </Card>
      {editing && <StageEditor item={editing} canAssign={canAssign} trainers={trainers} onClose={() => setEditing(null)} onSaved={load} />}
      <ModifyModal item={modify} onClose={() => setModify(null)} onSaved={() => { setModify(null); setSelKeys([]); load() }} />
      <Modal open={delOpen} title={<span style={{ color: '#dc2626', textTransform: 'capitalize' }}>Delete {dt?.lvl} “{dt?.name}”?</span>}
        okText={`Delete ${dt?.lvl || 'branch'}`} okButtonProps={{ danger: true, loading: delBusy, disabled: delText.trim() !== (dt?.name || '') }}
        onOk={deleteBranch} onCancel={() => setDelOpen(false)} forceRender>
        <div style={{ background: '#fdeaea', border: '1px solid #f6d2d2', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
          ⚠️ This permanently removes the {dt?.lvl} <b>{dt?.name}</b> and <b>everything under it</b> — <b>{dt?.count}</b> sub-topic{dt?.count === 1 ? '' : 's'}, plus their chapters/topics, stages, recordings, edits and reviews. Studio bookings are kept but unlinked. <b>This cannot be undone.</b>
        </div>
        <div style={{ fontSize: 13, marginBottom: 6 }}>Type the {dt?.lvl} name <b>{dt?.name}</b> to confirm:</div>
        <Input value={delText} onChange={e => setDelText(e.target.value)} placeholder={dt?.name} onPressEnter={() => { if (delText.trim() === dt?.name) deleteBranch() }} />
      </Modal>
      <AddSubjectModal open={addSubj} defaultProgram={programF} onClose={() => setAddSubj(false)} onSaved={load} />
      <AddSubtopicModal open={addSub} defaultProgram={programF} defaultSubject={subjectF} onClose={() => setAddSub(false)} onSaved={load} />
    </div>
  )
}

/* ===================== studio board + booking ===================== */
// Bulk-upload studio slots from an Excel sheet. Everything maps to existing system records:
// Studio + Trainer (person) + Sub-topic (content_item) are matched by name; unmatched rows are
// listed as exceptions and NOT created. The DB blocks double-bookings, so clashes are reported too.
const STUDIO_COLS = ['Date', 'Studio', 'Time', 'Trainer', 'Sub-topic']
// Read an Excel date cell into a plain YYYY-MM-DD calendar date — TIMEZONE-SAFE.
// SheetJS (0.18) returns a date cell as an instant ~1ms BEFORE local midnight, so BOTH the
// local and UTC getters read the PREVIOUS day (this is why 23 Jun was landing on 22/21).
// Fix: shift into the local wall-clock frame and round to the nearest day. Strings are parsed
// as Indian DD/MM/YYYY (and ISO) so a typed "23/06/2025" also stays the 23rd.
function excelCellToYMD(dr: any): string {
  if (dr instanceof Date) {
    const shifted = dr.getTime() - dr.getTimezoneOffset() * 60000
    const day = new Date(Math.round(shifted / 86400000) * 86400000)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${day.getUTCFullYear()}-${p(day.getUTCMonth() + 1)}-${p(day.getUTCDate())}`
  }
  const s = String(dr ?? '').trim()
  const m = s.match(/^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})$/)
  if (m) { const p = (x: string) => x.padStart(2, '0'); return m[1].length === 4 ? `${m[1]}-${p(m[2])}-${p(m[3])}` : `${m[3]}-${p(m[2])}-${p(m[1])}` }
  const d = dayjs(s)
  return d.isValid() ? d.format('YYYY-MM-DD') : ''
}
function StudioBulkUpload({ studios, onClose, onDone }: any) {
  const { message: msg } = AntApp.useApp()
  const { person } = useAuth()
  const [people, setPeople] = useState<any[]>([])
  const [subs, setSubs] = useState<any[]>([])
  const [ready, setReady] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { (async () => {
    const p = await supabase.from('person').select('id, full_name, is_active').eq('is_active', true)
    setPeople(p.data || [])
    const c = await selectAll('content_item', 'id, subtopic:subtopic_id(name)')
    setSubs((c || []).map((x: any) => ({ id: x.id, name: x.subtopic?.name || '' })).filter((x: any) => x.name))
    setReady(true)
  })() }, [])
  const lc = (s: string) => String(s || '').trim().toLowerCase()

  function downloadTemplate() {
    const out = [{ Date: dayjs().format('YYYY-MM-DD'), Studio: studios[0]?.name || 'Studio 1', Time: '08:30', Trainer: '', 'Sub-topic': '' }]
    const ws = XLSX.utils.json_to_sheet(out, { header: STUDIO_COLS })
    ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 30 }]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Slots')
    XLSX.writeFile(wb, 'Trackademy_studio_slots.xlsx')
  }

  async function onFile(e: any) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    try {
      // cellDates:true → Excel real-date cells come back as JS Dates (not serial numbers), so dates parse correctly
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
      const raw: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      if (!raw.length) { msg.error('That sheet has no rows.'); return }
      const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z]/g, '')
      const km: any = {}; Object.keys(raw[0]).forEach(k => km[norm(k)] = k)
      const missing = ['date', 'studio', 'time'].filter(n => !(n in km)) // only Date/Studio/Time are required columns
      if (missing.length) { msg.error('Missing column(s): ' + missing.join(', ') + '. Use the template.'); return }
      const studioBy: any = {}; studios.forEach((s: any) => studioBy[lc(s.name)] = s)
      const personBy: any = {}; people.forEach((p: any) => personBy[lc(p.full_name)] = p)
      const subBy: any = {}, subDup: any = {}; subs.forEach((s: any) => { const k = lc(s.name); if (subBy[k]) subDup[k] = true; else subBy[k] = s })
      const cand: any[] = [], bad: any[] = []
      raw.forEach((r, i) => {
        const dr = r[km.date]
        const ymd = excelCellToYMD(dr) // timezone-safe — keeps the day the user actually typed
        const row: any = { _row: i + 2, date: ymd || String(dr ?? '').trim(), studio: String(r[km.studio] || '').trim(), time: String(r[km.time] || '').trim().slice(0, 5), trainer: km.trainer ? String(r[km.trainer] || '').trim() : '', subtopic: km.subtopic ? String(r[km.subtopic] || '').trim() : '' }
        if (!row.date && !row.studio && !row.trainer && !row.subtopic) return // skip blank lines
        const errs: string[] = []
        if (!dr || !ymd) errs.push('bad date')
        const st = studioBy[lc(row.studio)]; if (!st) errs.push('unknown studio')
        if (!TIMES.includes(row.time)) errs.push('time must be ' + TIMES.join(' / '))
        // Trainer & Sub-topic are OPTIONAL — blank is fine. Only validate what's actually typed.
        const tr = row.trainer ? personBy[lc(row.trainer)] : null; if (row.trainer && !tr) errs.push('trainer not in system')
        const sk = lc(row.subtopic), sub = row.subtopic ? subBy[sk] : null
        if (row.subtopic && !sub) errs.push('sub-topic not in system'); else if (row.subtopic && subDup[sk]) errs.push('sub-topic name is duplicated — rename to make unique')
        if (errs.length) bad.push({ ...row, why: errs.join('; ') })
        else cand.push({ ...row, studio_id: st.id, trainer_id: tr ? tr.id : null, content_item_id: sub ? sub.id : null })
      })
      // any number of slots can be booked — we create every valid row (no skipping)
      setPreview({ ok: cand, skip: [], bad })
    } catch (err: any) { msg.error('Could not read file: ' + (err.message || err)) }
  }

  async function commit() {
    if (!preview?.ok?.length) { msg.error('No valid rows to create.'); return }
    setBusy(true)
    let created = 0; const clashes: any[] = []; let firstDate = ''
    for (const r of preview.ok) {
      const { error } = await supabase.from('slot').insert({ slot_date: r.date, start_time: r.time, end_time: END_OF[r.time], studio_id: r.studio_id, trainer_id: r.trainer_id, content_item_id: r.content_item_id, created_by: person?.id || null })
      if (error) {
        const why = /no_studio_double_book/.test(error.message) ? 'studio already booked at that time' : /no_trainer_double_book/.test(error.message) ? 'trainer already booked at that time' : /slot_within_hours/.test(error.message) ? 'outside 08:30–20:30' : error.message
        clashes.push({ ...r, why })
      } else { created++; if (!firstDate) firstDate = r.date }
    }
    setBusy(false)
    msg.success(`Created ${created} slot${created === 1 ? '' : 's'}${clashes.length ? ` · ${clashes.length} skipped` : ''}${firstDate ? ` · showing ${firstDate}` : ''}`)
    onDone && onDone(firstDate) // jump the board to the date we just created so the user sees the slots
    setPreview((p: any) => ({ ok: [], skip: p?.skip || [], bad: [...(p?.bad || []), ...clashes] }))
  }

  const exCols = [
    { title: 'Row', dataIndex: '_row', width: 48 },
    { title: 'Date', dataIndex: 'date', width: 100 },
    { title: 'Studio', dataIndex: 'studio', width: 80 },
    { title: 'Time', dataIndex: 'time', width: 60 },
    { title: 'Trainer', dataIndex: 'trainer', width: 110 },
    { title: 'Sub-topic', dataIndex: 'subtopic' },
    { title: 'Problem', dataIndex: 'why', render: (v: string) => <span style={{ color: '#c0392b' }}>{v}</span> },
  ]
  return (
    <Modal open width={780} title="Bulk upload studio slots" onCancel={onClose} footer={null}>
      {!ready ? <div style={{ display: 'grid', placeItems: 'center', height: 120 }}><Spin /></div> : <>
        <div style={{ background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
          Required: <b>Date · Studio · Time</b> (Time must be one of {TIMES.join(', ')}). <b>Trainer</b> and <b>Sub-topic</b> are optional — leave them blank to create an open slot and assign in the board later. If you do fill them, they must match names already in the system.
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>Download template</Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => fileRef.current?.click()}>Choose Excel file</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFile} />
        </div>
        {preview && <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 13, flexWrap: 'wrap' }}>
            <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ {preview.ok.length} ready to create</span>
            {preview.skip?.length > 0 && <span style={{ color: '#69707d', fontWeight: 600 }}>⊘ {preview.skip.length} already booked (skipped)</span>}
            {preview.bad.length > 0 && <span style={{ color: '#c0392b', fontWeight: 600 }}>⚠ {preview.bad.length} exception(s) — not created</span>}
          </div>
          {preview.bad.length > 0 && <Table size="small" columns={exCols as any} dataSource={preview.bad.map((b: any, i: number) => ({ ...b, key: i }))} pagination={{ pageSize: 6 }} style={{ marginBottom: 12 }} />}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={onClose}>Close</Button>
            <Button type="primary" loading={busy} disabled={!preview.ok.length} onClick={commit}>Create {preview.ok.length} slot{preview.ok.length === 1 ? '' : 's'}</Button>
          </div>
        </>}
      </>}
    </Modal>
  )
}
function StudioBoard() {
  const { person } = useAuth(); const isAdmin = person?.role === 'admin'
  const nav = useNavigate()
  const { message: msg } = AntApp.useApp()
  const [date, setDate] = useState<any>(dayjs())
  const [studios, setStudios] = useState<any[]>([])
  const [slots, setSlots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [trainers, setTrainers] = useState<any[]>([])
  const [subs, setSubs] = useState<any[]>([])
  const [bSubj, setBSubj] = useState<any>(); const [bChap, setBChap] = useState<any>(); const [bTopic, setBTopic] = useState<any>()
  const [saving, setSaving] = useState(false)
  const [editSlot, setEditSlot] = useState<any>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [form] = Form.useForm()
  const dateStr = date.format('YYYY-MM-DD')

  async function loadBoard() {
    setLoading(true)
    const st = await supabase.from('studio').select('id,name').order('sort')
    let sl: any = await supabase.from('slot').select('id,start_time,studio_id,slot_status,recording_status,reason_missed,revised_date,trainer_id,trainer_locked,content_item_id, trainer:trainer_id(full_name), content_item:content_item_id(subtopic:subtopic_id(name, topic:topic_id(chapter:chapter_id(subject:subject_id(name)))))').eq('slot_date', dateStr)
    if (sl.error) sl = await supabase.from('slot').select('id,start_time,studio_id,slot_status,recording_status,reason_missed,revised_date,trainer_id,content_item_id, trainer:trainer_id(full_name), content_item:content_item_id(subtopic:subtopic_id(name, topic:topic_id(chapter:chapter_id(subject:subject_id(name)))))').eq('slot_date', dateStr)
    setStudios(st.data || []); setSlots(sl.data || []); setLoading(false)
  }
  useEffect(() => { loadBoard() }, [dateStr])

  async function openModal(studioId?: string, time?: string) {
    if (!trainers.length) {
      const t = await supabase.from('person').select('id,full_name').eq('role', 'trainer').eq('is_active', true)
      setTrainers(t.data || [])
      const c = await selectAll('content_item', 'id, subtopic:subtopic_id(name, topic:topic_id(name, chapter:chapter_id(name, subject:subject_id(name))))')
      setSubs((c || []).map((x: any) => ({ value: x.id, label: x.subtopic?.name, subject: x.subtopic?.topic?.chapter?.subject?.name, chapter: x.subtopic?.topic?.chapter?.name, topic: x.subtopic?.topic?.name })).filter((x: any) => x.label))
    }
    form.resetFields()
    setBSubj(undefined); setBChap(undefined); setBTopic(undefined)
    form.setFieldsValue({ date, studio_id: studioId, start_time: time || '08:30' })
    setOpen(true)
  }
  async function book() {
    const v = await form.validateFields()
    setSaving(true)
    const start = v.start_time
    const { error } = await supabase.from('slot').insert({
      slot_date: v.date.format('YYYY-MM-DD'), start_time: start, end_time: END_OF[start],
      studio_id: v.studio_id, trainer_id: v.trainer_id, content_item_id: v.content_item_id, created_by: person?.id || null,
    })
    setSaving(false)
    if (error) {
      if (/no_studio_double_book/.test(error.message)) msg.error('That studio is already booked for that time slot.')
      else if (/no_trainer_double_book/.test(error.message)) msg.error('That trainer already has a recording at that time.')
      else if (/slot_within_hours/.test(error.message)) msg.error('Slots must be within 08:30–20:30.')
      else msg.error(error.message)
      return
    }
    msg.success('Slot booked ✓'); setOpen(false); loadBoard()
  }
  function cellSlot(studioId: string, time: string) { return slots.find(s => s.studio_id === studioId && String(s.start_time).slice(0, 5) === time) }
  const tiles = {
    active: slots.filter((s: any) => ['Recording Started', 'Recording In Progress'].includes(s.recording_status)).length,
    completed: slots.filter((s: any) => s.slot_status === 'Completed').length,
    delayed: slots.filter((s: any) => ['Missed', 'Rescheduled'].includes(s.slot_status)).length,
    upcoming: slots.filter((s: any) => s.slot_status === 'Scheduled').length,
  }

  return (
    <div>
      <PageHead title="Studio Board" sub={`${studios.length} studios · 08:30–20:30 · 2-hour slots`}
        extra={<div style={{ display: 'flex', gap: 10 }}>
          <DatePicker value={date} onChange={(v) => v && setDate(v)} allowClear={false} />
          {isAdmin && <Button icon={<UploadOutlined />} onClick={() => setBulkOpen(true)}>Bulk upload</Button>}
          {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>New slot</Button>}
        </div>} />
      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        <Col xs={12} md={6}><LiveTile color="#2563eb" label="Active recordings" value={tiles.active} /></Col>
        <Col xs={12} md={6}><LiveTile color="#16a34a" label="Completed today" value={tiles.completed} /></Col>
        <Col xs={12} md={6}><LiveTile color="#dc2626" label="Delayed today" value={tiles.delayed} onClick={() => nav('/sla')} /></Col>
        <Col xs={12} md={6}><LiveTile color="#6b7280" label="Upcoming slots" value={tiles.upcoming} /></Col>
      </Row>
      {(() => {
        // Subject-wise studio utilisation for the selected day: recorded slots / booked slots, per subject
        const bySub: any = {}
        slots.forEach((s: any) => {
          const subj = s.content_item?.subtopic?.topic?.chapter?.subject?.name || 'No subject set'
          const e = bySub[subj] || (bySub[subj] = { subj, total: 0, done: 0 })
          e.total++
          if (s.recording_status === 'Recording Completed' || s.slot_status === 'Completed') e.done++
        })
        const list: any[] = Object.values(bySub).sort((a: any, b: any) => b.total - a.total)
        const capPct = studios.length ? Math.min(100, Math.round(slots.filter((s: any) => s.slot_status === 'Completed' && s.recording_status === 'Recording Completed').length / (studios.length * SLOTS_PER_DAY) * 100)) : 0
        return <Card size="small" style={{ marginBottom: 14 }} title={<span>Studio utilised by subject <span style={{ fontWeight: 400, color: '#9aa1ad', fontSize: 12 }}>· {date.format('DD MMM YYYY')} · {capPct}% of day capacity</span></span>}>
          {list.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No slots booked for this day." />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{list.map((e: any) => {
              const pct = e.total ? Math.round(e.done / e.total * 100) : 0
              return <div key={e.subj} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 200, fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.subj}>{e.subj}</span>
                <div style={{ flex: 1, background: '#eef0f3', borderRadius: 6, height: 10, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#16a34a' : PRIMARY }} /></div>
                <span style={{ width: 150, textAlign: 'right', fontSize: 12, color: '#69707d' }}>{e.done}/{e.total} recorded · <b style={{ color: '#161a22' }}>{pct}%</b></span>
              </div>
            })}</div>}
        </Card>
      })()}
      <Card styles={{ body: { padding: 16, overflowX: 'auto' } }}>
        {loading ? <div style={{ display: 'grid', placeItems: 'center', height: 200 }}><Spin /></div> : (
          <div style={{ display: 'grid', gridTemplateColumns: `110px repeat(${TIMES.length}, minmax(130px,1fr))`, gap: 8, minWidth: 820 }}>
            <div />
            {TIMES.map(t => <div key={t} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#69707d', paddingBottom: 4 }}>{t}–{END_OF[t]}</div>)}
            {studios.map(st => (
              <Fragment key={st.id}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{st.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#9aa1ad' }}>{Math.round(slots.filter((x: any) => x.studio_id === st.id).length / SLOTS_PER_DAY * 100)}% used</span>
                </div>
                {TIMES.map(t => {
                  const s = cellSlot(st.id, t)
                  const color = s ? (SLOT_COLORS[s.slot_status] || '#6b7280') : null
                  return (
                    <div key={t} onClick={() => { if (s) setEditSlot(s); else if (isAdmin) openModal(st.id, t) }}
                      style={{ minHeight: 62, borderRadius: 10, padding: s ? '8px 10px' : 0, cursor: (s || isAdmin) ? 'pointer' : 'default', background: s ? color + '14' : '#fafbfc', border: s ? `1px solid ${color}33` : '1px dashed #e3e6ea', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: s ? 'stretch' : 'center', color: '#c0c4cc' }}>
                      {s ? (
                        <>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#161a22' }}>{s.content_item?.subtopic?.name || 'Recording'}</div>
                          <div style={{ fontSize: 11, color: '#69707d', marginTop: 2 }}>{s.trainer?.full_name || '—'} · {s.slot_status}</div>
                        </>
                      ) : (isAdmin ? <PlusOutlined /> : null)}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        )}
        <div style={{ marginTop: 14, fontSize: 12, color: '#9aa1ad' }}>{isAdmin ? 'Click any empty slot to book it.' : 'View only — studio slots are booked and changed by the Program Head.'}</div>
      </Card>

      <Modal open={open} title="Book a recording slot" onOk={book} okText="Book slot" confirmLoading={saving} onCancel={() => setOpen(false)} destroyOnHidden>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="studio_id" label="Studio" rules={[{ required: true }]}><Select options={studios.map(s => ({ value: s.id, label: s.name }))} placeholder="Select studio" /></Form.Item></Col>
            <Col span={12}><Form.Item name="start_time" label="Time slot" rules={[{ required: true }]}><Select options={TIMES.map(t => ({ value: t, label: `${t}–${END_OF[t]}` }))} /></Form.Item></Col>
          </Row>
          <Form.Item name="trainer_id" label="Trainer" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" placeholder="Select trainer" options={trainers.map(t => ({ value: t.id, label: t.full_name }))} /></Form.Item>
          <div style={{ fontSize: 12, color: '#69707d', marginBottom: 4 }}>What to record <span style={{ color: '#9aa1ad' }}>— narrow by Subject → Chapter → Topic, then pick the sub-topic</span></div>
          <Row gutter={12}>
            <Col span={8}><Form.Item style={{ marginBottom: 8 }}><Select allowClear showSearch placeholder="Subject" value={bSubj} onChange={(v) => { setBSubj(v); setBChap(undefined); setBTopic(undefined); form.setFieldValue('content_item_id', undefined) }} options={[...new Set(subs.map((s: any) => s.subject))].filter(Boolean).map((s: any) => ({ value: s, label: s }))} /></Form.Item></Col>
            <Col span={8}><Form.Item style={{ marginBottom: 8 }}><Select allowClear showSearch placeholder="Chapter" disabled={!bSubj} value={bChap} onChange={(v) => { setBChap(v); setBTopic(undefined); form.setFieldValue('content_item_id', undefined) }} options={[...new Set(subs.filter((s: any) => !bSubj || s.subject === bSubj).map((s: any) => s.chapter))].filter(Boolean).map((s: any) => ({ value: s, label: s }))} /></Form.Item></Col>
            <Col span={8}><Form.Item style={{ marginBottom: 8 }}><Select allowClear showSearch placeholder="Topic" disabled={!bChap} value={bTopic} onChange={(v) => { setBTopic(v); form.setFieldValue('content_item_id', undefined) }} options={[...new Set(subs.filter((s: any) => (!bSubj || s.subject === bSubj) && (!bChap || s.chapter === bChap)).map((s: any) => s.topic))].filter(Boolean).map((s: any) => ({ value: s, label: s }))} /></Form.Item></Col>
          </Row>
          <Form.Item name="content_item_id" label="Sub-topic to record" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" placeholder="Pick or search a sub-topic" options={subs.filter((s: any) => (!bSubj || s.subject === bSubj) && (!bChap || s.chapter === bChap) && (!bTopic || s.topic === bTopic))} /></Form.Item>
        </Form>
      </Modal>
      {editSlot && <SlotEdit slot={editSlot} onClose={() => setEditSlot(null)} onSaved={() => { setEditSlot(null); loadBoard() }} />}
      {bulkOpen && <StudioBulkUpload studios={studios} onClose={() => setBulkOpen(false)} onDone={(d?: string) => { if (d) setDate(dayjs(d)); else loadBoard() }} />}
    </div>
  )
}

/* ===================== shared (editing / reviews) ===================== */
async function fetchAllItems() {
  const data = await selectAll('content_item', 'id, subtopic_id, subtopic:subtopic_id(name, topic:topic_id(id, name, chapter:chapter_id(id, name, subject:subject_id(id, name, main_subject:main_subject_id(id, name))))), item_stage(id,status,delay_days, stage:stage_id(code,name,sequence,weight))')
  return (data || []).map((ci: any) => {
    const stages = ci.item_stage || []
    const byCode: any = {}
    stages.forEach((s: any) => { byCode[s.stage.code] = { id: s.id, status: s.status, name: s.stage.name, seq: s.stage.sequence, delay: s.delay_days || 0 } })
    const sorted = [...stages].sort((a: any, b: any) => a.stage.sequence - b.stage.sequence)
    const weight = sorted.reduce((t: number, x: any) => t + (x.status === 'Completed' ? Number(x.stage.weight) : 0), 0)
    const cur = sorted.find((x: any) => x.status !== 'Completed')
    const sj = ci.subtopic?.topic?.chapter?.subject
    return { id: ci.id, subtopicId: ci.subtopic_id, topicId: ci.subtopic?.topic?.id, chapterId: ci.subtopic?.topic?.chapter?.id, subjectId: sj?.id, programId: sj?.main_subject?.id, program: sj?.main_subject?.name || '—', name: ci.subtopic?.name || '—', subject: sj?.name || '—', chapter: ci.subtopic?.topic?.chapter?.name || '', topic: ci.subtopic?.topic?.name || '', byCode, completion: Math.round(weight * 100), stageName: cur ? cur.stage.name : 'Done', stageSeq: cur ? cur.stage.sequence : 99 }
  })
}
// Fetch EVERY row from a table/view, paging past Supabase's 1000-row-per-request cap.
// Without this, ownership lookups silently truncate and assigned items look "Unassigned".
async function selectAll(table: string, columns: string): Promise<any[]> {
  const out: any[] = []; const step = 1000; let from = 0
  for (;;) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + step - 1)
    if (error || !data || !data.length) break
    out.push(...data)
    if (data.length < step) break
    from += step
  }
  return out
}
// Visibility predicate for a SCOPED (non "sees all") user. Items carry id/topicId/chapterId/subjectId/programId.
//  • managers / team leads: oversee EVERY item under any hierarchy level assigned to them
//    (program/subject/chapter/topic/sub-topic), regardless of more-specific trainer overrides inside it.
//  • trainers/editors/reviewers: only items where they are the effective owner (override-aware).
// programs a person is co-assigned to via the v29 program_trainer table (or the local mock)
async function coAssignedPrograms(me: string): Promise<Set<string>> {
  const out = new Set<string>()
  if (MOCK_MENTOR_SUBTOPIC) { const all = mockAllProgramTrainers(); Object.keys(all).forEach((pid) => { if (all[pid].includes(me)) out.add(pid) }) }
  else { const pt = await supabase.from('program_trainer').select('main_subject_id').eq('trainer_id', me); if (!pt.error) (pt.data || []).forEach((x: any) => out.add(x.main_subject_id)) }
  return out
}
async function buildScope(person: any): Promise<(it: any) => boolean> {
  const me = person?.id
  if (!me) return () => false
  const coPrograms = await coAssignedPrograms(me) // co-trainers (v29) widen visibility — additive only
  if (OWNER_ROLES.includes(person?.role)) {
    const [pr, su, ch, to, ci] = await Promise.all([
      supabase.from('main_subject').select('id').eq('default_trainer_id', me),
      supabase.from('subject').select('id').eq('default_trainer_id', me),
      supabase.from('chapter').select('id').eq('default_trainer_id', me),
      supabase.from('topic').select('id').eq('default_trainer_id', me),
      supabase.from('content_item').select('id').eq('planned_trainer_id', me),
    ])
    const P = new Set((pr.data || []).map((x: any) => x.id))
    const S = new Set((su.data || []).map((x: any) => x.id))
    const C = new Set((ch.data || []).map((x: any) => x.id))
    const T = new Set((to.data || []).map((x: any) => x.id))
    const I = new Set((ci.data || []).map((x: any) => x.id))
    return (it: any) => I.has(it.id) || T.has(it.topicId) || C.has(it.chapterId) || S.has(it.subjectId) || P.has(it.programId) || coPrograms.has(it.programId)
  }
  const ow = await selectAll('v_item_owner', 'content_item_id, trainer_id')
  const mine = new Set(ow.filter((o: any) => o.trainer_id === me).map((o: any) => o.content_item_id))
  return (it: any) => mine.has(it.id) || coPrograms.has(it.programId)
}
function nameCell(r: any) { return <div><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 11, color: '#9aa1ad' }}>{r.chapter} › {r.topic}</div></div> }
function StatusSelect({ stage, reload }: any) {
  const { message: msg } = AntApp.useApp()
  const [val, setVal] = useState(stage.status)
  useEffect(() => setVal(stage.status), [stage.status])
  return <Select size="small" value={val} style={{ width: 150 }}
    onChange={async (v) => { const prev = val; setVal(v); try { await setItemStage(stage.id, v); reload && reload() } catch (e: any) { setVal(prev); msg.error(e.message || 'Could not save') } }}
    options={STATUS_OPTS.map(o => ({ value: o, label: o }))} />
}

/* ===================== people ===================== */
function PersonModal({ open, person, onClose, onSaved }: any) {
  const { message: msg } = AntApp.useApp()
  const [f] = Form.useForm()
  const [busy, setBusy] = useState(false)
  const [leads, setLeads] = useState<any[]>([])
  const role = Form.useWatch('role', f)
  useEffect(() => {
    if (!open) return
    f.resetFields()
    f.setFieldsValue(person?.id
      ? { full_name: person.full_name, email: person.email, employee_id: person.employee_id || '', role: person.role, trainer_type: person.trainer_type || undefined, is_active: person.is_active ?? true, can_assign: !!person.can_assign, full_visibility: !!person.full_visibility, lead_ids: person.lead_id ? [person.lead_id] : [], date_of_joining: person.date_of_joining ? dayjs(person.date_of_joining) : undefined, contact_number: person.contact_number || '' }
      : { role: 'trainer', is_active: true, can_assign: false, full_visibility: false, lead_ids: [] })
    supabase.from('person').select('id, full_name, role, is_active').then(({ data }: any) => setLeads((data || []).filter((p: any) => OWNER_ROLES.includes(p.role) && p.is_active)))
    // prefill the full set of managing leads (join table; falls back to the single lead_id)
    if (person?.id && person.role === 'mentor') {
      if (MOCK_MENTOR_SUBTOPIC) { const ids = mockListMentorLeads(person.id); if (ids.length) f.setFieldsValue({ lead_ids: ids }) }
      else supabase.from('mentor_lead').select('lead_id').eq('mentor_id', person.id).then(({ data }: any) => { const ids = (data || []).map((x: any) => x.lead_id); if (ids.length) f.setFieldsValue({ lead_ids: ids }) })
    }
  }, [open, person])
  async function save() {
    const v = await f.validateFields(); setBusy(true)
    const leadIds: string[] = v.role === 'mentor' ? (v.lead_ids || []).filter(Boolean) : []
    const put = (p: any) => (person?.id ? supabase.from('person').update(p).eq('id', person.id) : supabase.from('person').insert(p)).select('id').maybeSingle()
    // person.lead_id keeps the FIRST selected lead for backward compatibility; the full set goes to mentor_lead
    let payload: any = { full_name: v.full_name.trim(), email: v.email.toLowerCase().trim(), employee_id: v.employee_id?.trim() || null, role: v.role, trainer_type: v.role === 'trainer' ? (v.trainer_type || 'Internal') : null, is_active: v.is_active, can_assign: !!v.can_assign, full_visibility: !!v.full_visibility, lead_id: v.role === 'mentor' ? (leadIds[0] || null) : null, date_of_joining: v.date_of_joining ? v.date_of_joining.format('YYYY-MM-DD') : null, contact_number: v.contact_number?.trim() || null }
    let res = await put(payload)
    // graceful if v35 (joining date / contact) isn't applied yet — strip and retry
    if (res.error && /date_of_joining|contact_number/.test(res.error.message)) { const { date_of_joining, contact_number, ...rest } = payload; payload = rest; res = await put(payload) }
    // graceful if employee_id isn't migrated yet — strip and retry (keeps People working pre-v33)
    if (res.error && /employee_id/.test(res.error.message)) { const { employee_id, ...rest } = payload; payload = rest; res = await put(payload) }
    // graceful if lead_id isn't migrated yet — strip and retry (keeps People working pre-migration)
    if (res.error && /lead_id/.test(res.error.message)) { const { lead_id, ...rest } = payload; payload = rest; res = await put(payload) }
    if (res.error && /can_assign|full_visibility/.test(res.error.message)) { const { can_assign, full_visibility, ...rest } = payload; res = await put(rest) }
    if (res.error) { setBusy(false); msg.error(/duplicate|unique/i.test(res.error.message) ? 'That email already exists.' : res.error.message); return }
    // sync the multiple-leads mapping (additive; ignored gracefully if v28 not applied)
    const mentorId = person?.id || res.data?.id
    if (mentorId && v.role === 'mentor') {
      if (MOCK_MENTOR_SUBTOPIC) mockSaveMentorLeads(mentorId, leadIds)
      else { await supabase.from('mentor_lead').delete().eq('mentor_id', mentorId); if (leadIds.length) await supabase.from('mentor_lead').insert(leadIds.map((lid: string) => ({ mentor_id: mentorId, lead_id: lid }))) }
    }
    setBusy(false)
    if (!person?.id) {
      const prov = await supabase.rpc('rt_provision_login', { p_email: payload.email })
      if (!prov.error && prov.data?.ok) msg.success('Teammate added ✓ — login created, they can sign in now.')
      else msg.warning('Teammate added ✓ — click "Provision logins" in Manage → Team to activate their login.')
    } else { msg.success('Teammate updated ✓') }
    onSaved()
  }
  return (
    <Modal open={open} title={person?.id ? 'Edit teammate' : 'Add a teammate'} onOk={save} confirmLoading={busy} onCancel={onClose} okText={person?.id ? 'Save' : 'Add teammate'} destroyOnClose>
      <Form form={f} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="full_name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input placeholder="name@example.com" /></Form.Item></Col>
          <Col span={12}><Form.Item name="employee_id" label="Employee ID"><Input placeholder="e.g. QS-1024" /></Form.Item></Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="date_of_joining" label="Date of joining"><DatePicker style={{ width: '100%' }} format="DD MMM YYYY" placeholder="Select joining date" /></Form.Item></Col>
          <Col span={12}><Form.Item name="contact_number" label="Contact details" rules={[{ pattern: /^[0-9+()\-\s]{6,20}$/, message: 'Enter a valid contact number' }]}><Input placeholder="e.g. +91 98765 43210" /></Form.Item></Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="role" label="Role" rules={[{ required: true }]}><Select options={ROLES.map(o => ({ value: o, label: roleLabel(o) }))} /></Form.Item></Col>
          <Col span={12}><Form.Item name="trainer_type" label="Type (for trainers)"><Select allowClear placeholder="Internal / External" options={TRAINER_TYPES.map(o => ({ value: o, label: o }))} /></Form.Item></Col>
        </Row>
        <Form.Item name="is_active" label="Status" valuePropName="checked"><Switch checkedChildren="Active" unCheckedChildren="Inactive" /></Form.Item>
        <Form.Item name="can_assign" valuePropName="checked" style={{ marginBottom: 4 }}><Checkbox>Can assign / reassign topics to trainers</Checkbox></Form.Item>
        <Form.Item name="full_visibility" valuePropName="checked" style={{ marginBottom: 0 }}><Checkbox>Sees all content <span style={{ color: '#9aa1ad' }}>(off = sees only their assigned work)</span></Checkbox></Form.Item>
        {role === 'mentor' && <Form.Item name="lead_ids" label="Managing Leads" tooltip="The SME Lead(s) who train, assign topics to, and rate this mentor. A mentor can have multiple leads. The first selected is kept as the primary." style={{ marginTop: 12, marginBottom: 0 }}>
          <Select mode="multiple" allowClear showSearch optionFilterProp="label" placeholder="Assign this mentor to one or more Leads" options={leads.map((l: any) => ({ value: l.id, label: `${l.full_name} (${roleLabel(l.role)})` }))} />
        </Form.Item>}
      </Form>
      <p style={{ fontSize: 12, color: '#9aa1ad', margin: '8px 0 0' }}>The login itself is created once in Supabase → Authentication. Deactivating hides them from trainer pickers. “Can assign” lets this person set/override topic owners (the Program Head always can).</p>
    </Modal>
  )
}
function People() {
  const { person: me } = useAuth(); const isAdmin = me?.role === 'admin'; const canManage = isAdmin || PEOPLE_MANAGER_ROLES.includes(me?.role)
  const { message: msg } = AntApp.useApp()
  const [rows, setRows] = useState<any>(null)
  const [edit, setEdit] = useState<any>(null)
  const [remove, setRemove] = useState<any>(null)
  const [rmText, setRmText] = useState('')
  const [q, setQ] = useState('')
  async function load() { setRows((await supabase.from('person').select('*').order('role')).data || []) }
  useEffect(() => { load() }, [])
  async function toggleActive(r: any, val: boolean) {
    const { error } = await supabase.from('person').update({ is_active: val }).eq('id', r.id)
    if (error) { msg.error(error.message); return }
    msg.success(val ? `${r.full_name} activated` : `${r.full_name} deactivated`); load()
  }
  // PH-only documented removal: free all their topics + deactivate, keeping the record & reason for future reference
  async function doRemove() {
    if (!rmText.trim()) { msg.warning('Please document a reason for removing this person.'); return }
    const w = await supabase.from('mentor_prep').update({ state: 'withdrawn', withdrawn_by: me?.id || null, withdrawn_at: new Date().toISOString(), withdraw_reason: `Removed: ${rmText.trim()}` }).eq('mentor_id', remove.id).neq('state', 'withdrawn')
    if (w.error && !/state|withdraw/.test(w.error.message)) { msg.error(w.error.message); return }
    const u = await supabase.from('person').update({ is_active: false, removed_reason: rmText.trim(), removed_at: new Date().toISOString(), removed_by: me?.id || null }).eq('id', remove.id)
    if (u.error) { msg.error(/removed_/.test(u.error.message) ? 'Run RecTrack_v25.sql first to enable documented removal.' : u.error.message); return }
    msg.success(`${remove.full_name} removed — their topics are back in the unassigned bucket`)
    setRemove(null); setRmText(''); load()
  }
  if (!rows) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  const cols: any[] = [
    { title: 'Name', dataIndex: 'full_name', render: (v: string) => <span><Avatar size={24} style={{ background: '#a855f7', marginRight: 8 }}>{(v || '?')[0]}</Avatar><b>{v}</b></span> },
    { title: 'Email', dataIndex: 'email', render: (v: string) => <span style={{ color: '#69707d' }}>{v}</span> },
    { title: 'Role', dataIndex: 'role', render: (v: string) => <Tag color={roleColor[v]}>{roleLabel(v)}</Tag> },
    { title: 'Type', dataIndex: 'trainer_type', render: (v: string) => v || '—' },
    { title: 'Active', dataIndex: 'is_active', width: 160, render: (v: boolean, r: any) => {
      const ctrl = canManage ? <Switch size="small" checked={v} checkedChildren="Active" unCheckedChildren="Inactive" onChange={(c) => toggleActive(r, c)} /> : (v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>)
      return !v && r.removed_reason ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{ctrl}<ATooltip title={`Removed${r.removed_at ? ' ' + dayjs(r.removed_at).format('DD MMM YYYY') : ''}: ${r.removed_reason}`}><InfoCircleOutlined style={{ color: '#dc2626', cursor: 'help' }} /></ATooltip></span> : ctrl
    } },
  ]
  if (canManage) cols.push({ title: '', width: 92, render: (_: any, r: any) => <span style={{ display: 'inline-flex', gap: 2 }}>
    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEdit(r)} title="Edit teammate" />
    {isAdmin && r.id !== me?.id && r.is_active && <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => { setRmText(''); setRemove(r) }} title="Remove & free their topics (Program Head only)" />}
  </span> })
  const ql = q.trim().toLowerCase()
  const filtered = ql ? rows.filter((r: any) => [r.full_name, r.email, roleLabel(r.role), r.role, r.trainer_type].some((x: any) => String(x || '').toLowerCase().includes(ql))) : rows
  return <div>
    <PageHead title="People" sub={`${rows.length} team members`} extra={canManage ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({})}>Add teammate</Button> : undefined} />
    <Card>
      <Input allowClear prefix={<SearchOutlined style={{ color: '#9aa1ad' }} />} placeholder="Search by name, email or role…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 320, marginBottom: 14 }} />
      <Table columns={cols as any} dataSource={filtered.map((r: any) => ({ ...r, key: r.id }))} pagination={false} locale={{ emptyText: <Empty description={ql ? `No people match “${q}”` : 'No people yet'} /> }} />
    </Card>
    <PersonModal open={!!edit} person={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />
    <Modal open={!!remove} title={<span style={{ color: '#dc2626' }}>Remove {remove?.full_name}?</span>} okText="Remove & free topics" okButtonProps={{ danger: true, disabled: !rmText.trim() }} onOk={doRemove} onCancel={() => { setRemove(null); setRmText('') }} forceRender>
      <div style={{ fontSize: 13, marginBottom: 10 }}>This <b>frees all their assigned topics</b> back to the unassigned bucket and <b>deactivates</b> the account. The record, their ratings and history are <b>kept</b> — the reason below is saved for future reference, and you can reactivate later.</div>
      <Input.TextArea rows={3} placeholder="Reason for removal (e.g. left the team, test account)…" value={rmText} onChange={e => setRmText(e.target.value)} />
    </Modal>
  </div>
}

/* ===================== editing queue (+ data capture, #7) ===================== */
function EditingDrawer({ item, onClose, onSaved }: any) {
  const { message: msg } = AntApp.useApp()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [autoShoot, setAutoShoot] = useState(false)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('editing_task').select('*').eq('content_item_id', item.id).maybeSingle()
      // auto-fill the shoot date from the recording (or the booked slot) so the editor never types it
      let shoot = data?.date_of_shoot || null
      if (!shoot) {
        const vv = await supabase.from('video_version').select('recorded_on').eq('content_item_id', item.id).not('recorded_on', 'is', null).order('recorded_on', { ascending: false }).limit(1).maybeSingle()
        shoot = vv.data?.recorded_on || null
        if (!shoot) {
          const sl = await supabase.from('slot').select('slot_date').eq('content_item_id', item.id).order('slot_date', { ascending: false }).limit(1).maybeSingle()
          shoot = sl.data?.slot_date || null
        }
        setAutoShoot(!!shoot)
      } else setAutoShoot(false)
      form.setFieldsValue({
        date_of_shoot: shoot ? dayjs(shoot) : null,
        file_transfer_min: data?.file_transfer_min, proxy_min: data?.proxy_min,
        clip_duration_min: data?.clip_duration_min, edit_min: data?.edit_min,
        review_min: data?.review_min, final_output: data?.final_output || 'Pending',
        editor_feedback: data?.editor_feedback || '',
      })
    })()
  }, [item])
  async function save() {
    const v = await form.validateFields()
    setSaving(true)
    const row: any = {
      content_item_id: item.id,
      date_of_shoot: v.date_of_shoot ? v.date_of_shoot.format('YYYY-MM-DD') : null,
      file_transfer_min: v.file_transfer_min ?? null, proxy_min: v.proxy_min ?? null,
      clip_duration_min: v.clip_duration_min ?? null, edit_min: v.edit_min ?? null,
      review_min: v.review_min ?? null, final_output: v.final_output,
      editor_feedback: v.editor_feedback?.trim() || null,
      status: FO_DONE.includes(v.final_output) ? 'Completed' : 'In Progress',
    }
    let { error } = await supabase.from('editing_task').upsert(row, { onConflict: 'content_item_id' })
    if (error && /editor_feedback/.test(error.message)) { // column not migrated yet — save the rest
      const { editor_feedback, ...rest } = row
      ;({ error } = await supabase.from('editing_task').upsert(rest, { onConflict: 'content_item_id' }))
    }
    if (!error && FO_DONE.includes(v.final_output) && item.byCode.EDITING) { try { await setItemStage(item.byCode.EDITING.id, 'Completed') } catch (e: any) { msg.error(e.message) } }
    setSaving(false)
    if (error) { msg.error(error.message); return }
    msg.success('Editing details saved ✓'); onSaved()
  }
  return (
    <Drawer open width={460} onClose={onClose}
      title={<div><div style={{ fontSize: 11, color: '#69707d', textTransform: 'uppercase' }}>Editing — capture</div><div style={{ fontWeight: 800, fontSize: 16 }}>{item.name}</div></div>}
      extra={<Button type="primary" loading={saving} onClick={save}>Save</Button>}>
      <Form form={form} layout="vertical">
        <Form.Item name="date_of_shoot" label={<span>Date of shoot {autoShoot && <Tag color="green" style={{ marginInlineStart: 6 }}>auto-filled from recording</Tag>}</span>}><DatePicker style={{ width: '100%' }} format="DD MMM YYYY" /></Form.Item>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="file_transfer_min" label="File transfer (min)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="proxy_min" label="Proxy time (min)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="clip_duration_min" label="Clip duration (min)"><InputNumber min={0} step={0.5} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="edit_min" label="Editing time (min)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Form.Item name="review_min" label="Review time (min)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="final_output" label="Final Output  (this status = recording completed)"><Select options={FINAL_OUTPUT_OPTS.map(o => ({ value: o, label: o }))} /></Form.Item>
        <Form.Item name="editor_feedback" label="Editor's feedback"><Input.TextArea rows={3} placeholder="e.g. Needed colour correction; audio re-synced; clip trimmed by 2 min" /></Form.Item>
      </Form>
    </Drawer>
  )
}
// shared: the editing queue rows visible to a given user (scoped to their assigned programs)
function useEditingQueue() {
  const { person } = useAuth()
  const isEditor = person?.role === 'editor'
  const isAdmin = person?.role === 'admin'
  const [items, setItems] = useState<any>(null)
  const [edits, setEdits] = useState<any>({})
  const [editors, setEditors] = useState<any[]>([])
  async function load() {
    const all = await fetchAllItems()
    // load people first so we can resolve the editor's name ourselves — NO PostgREST embed
    // (editing_task.editor_id has no declared FK to person, so an embed errors and wipes the whole map)
    const p = await supabase.from('person').select('id, full_name, role, is_active')
    const people = p.data || []
    const nameById: any = {}; people.forEach((x: any) => { nameById[x.id] = x.full_name })
    setEditors(people.filter((x: any) => x.role === 'editor' && x.is_active))
    const e = await supabase.from('editing_task').select('content_item_id, final_output, editor_id')
    const m: any = {}; (e.data || []).forEach((x: any) => { m[x.content_item_id] = { fo: x.final_output || 'Pending', editorId: x.editor_id || null, editorName: x.editor_id ? (nameById[x.editor_id] || null) : null } }); setEdits(m)
    setItems(all)
  }
  useEffect(() => { if (person?.id) load() }, [person?.id])
  useAutoRefresh(() => { if (person?.id) load() })
  // a video stays in the queue until its Final output is a done state (Editing completed / Output completed)
  const ready = (items || []).filter((i: any) => i.byCode.SHOOTING?.status === 'Completed' && !FO_DONE.includes(edits[i.id]?.fo || 'Pending'))
  // editors see ONLY the videos assigned to them; everyone else sees all ready-to-edit
  const scoped = isEditor ? ready.filter((i: any) => edits[i.id]?.editorId === person?.id) : ready
  return { person, isEditor, isAdmin, items, edits, editors, scoped, load }
}
const FO_COLOR: any = { Pending: 'default', 'In Progress': 'blue', Reshoot: 'red', 'Editing completed': 'cyan', 'Output completed': 'green', Completed: 'green' }
// the editor's single status — Final output (Pending · In Progress · Reshoot · Completed). Editable in the table.
function FinalOutputSelect({ id, value, editStageId, shootStageId, reviewStageId, reload }: any) {
  const { message: msg } = AntApp.useApp()
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return <Select size="small" value={v} style={{ width: 150 }}
    onChange={async (val) => {
      const prev = v; setV(val)
      // stamp completed_at when the edit is finished (used by Weekly Goals to bound completion to a week)
      const done = FO_DONE.includes(val)
      let { error } = await supabase.from('editing_task').upsert({ content_item_id: id, final_output: val, completed_at: done ? new Date().toISOString() : null }, { onConflict: 'content_item_id' })
      if (error && /completed_at/.test(error.message)) { ({ error } = await supabase.from('editing_task').upsert({ content_item_id: id, final_output: val }, { onConflict: 'content_item_id' })) } // pre-v26 fallback
      if (error) { setV(prev); msg.error(error.message); return }
      try {
        // keep the pipeline in sync so the editor's status actually moves the video:
        if (done) {
          // editing done (Editing completed / Output completed) → advance EDITING so it enters the reviewer (Final review) queue
          if (editStageId) await setItemStage(editStageId, 'Completed')
        } else if (val === 'Reshoot') {
          // bounce back to the trainer to re-record:
          //  - Shooting → In Progress (shows in the trainer's My Work AND removes it from the editor's queue, which keys off Shooting=Completed)
          //  - Editing → Not Started (no longer being edited)
          // it re-enters the editor's queue automatically once the trainer marks Shooting Completed again.
          if (shootStageId) await setItemStage(shootStageId, 'In Progress')
          if (editStageId) await setItemStage(editStageId, 'Not Started')
        } else if (editStageId) {
          // Pending / In Progress → keep it out of the reviewer queue
          await setItemStage(editStageId, 'In Progress')
        }
      } catch (e: any) { msg.error(e.message) }
      reload && reload()
    }}
    options={FINAL_OUTPUT_OPTS.map(o => ({ value: o, label: o }))} />
}
// Content-style table — admins multi-select + bulk-assign an editor; editors are view-only + Capture details.
function EditingTable({ q }: any) {
  const { isAdmin, edits, editors, scoped, load } = q
  const { message: msg } = AntApp.useApp()
  const [open, setOpen] = useState<any>(null)
  const [selKeys, setSelKeys] = useState<any[]>([])
  const [programF, setProgramF] = useState<any>(null); const [subjectF, setSubjectF] = useState<any>(null)
  const [chap, setChap] = useState<any>(null); const [topicF, setTopicF] = useState<any>(null)
  const [foF, setFoF] = useState<any>(null); const [assignedF, setAssignedF] = useState<any>(null)
  const base = scoped
  const programs = [...new Set(base.map((i: any) => i.program))].filter(Boolean)
  const subjects = [...new Set(base.filter((i: any) => !programF || i.program === programF).map((i: any) => i.subject))].filter(Boolean)
  const chapters = [...new Set(base.filter((i: any) => (!programF || i.program === programF) && (!subjectF || i.subject === subjectF)).map((i: any) => i.chapter))].filter(Boolean)
  const topics = [...new Set(base.filter((i: any) => (!programF || i.program === programF) && (!subjectF || i.subject === subjectF) && (!chap || i.chapter === chap)).map((i: any) => i.topic))].filter(Boolean)
  const filtered = base.filter((i: any) => (!programF || i.program === programF) && (!subjectF || i.subject === subjectF) && (!chap || i.chapter === chap) && (!topicF || i.topic === topicF) && (!foF || (edits[i.id]?.fo || 'Pending') === foF) && (!assignedF || (assignedF === '__none__' ? !edits[i.id]?.editorId : edits[i.id]?.editorId === assignedF)))
  async function assignEditor(editorId: any) {
    let ok = 0, fail = 0, lastErr = ''
    for (const id of selKeys) {
      // .select() so we can tell a real save from an RLS-blocked write (which returns 0 rows, no error)
      const { data, error } = await supabase.from('editing_task').upsert({ content_item_id: id, editor_id: editorId || null }, { onConflict: 'content_item_id' }).select('content_item_id')
      if (error) { fail++; lastErr = error.message }
      else if (!data || !data.length) { fail++; lastErr = "Saved nothing — your role may not have write access to the editing queue (check editing_task RLS / Menu access)." }
      else ok++
    }
    if (ok) msg.success(`${editorId ? 'Assigned' : 'Unassigned'} ${ok} video${ok === 1 ? '' : 's'}${fail ? ` · ${fail} failed` : ''}`)
    else msg.error(lastErr || 'Could not assign')
    setSelKeys([]); load()
  }
  const cols = [
    { title: 'Sub-topic', render: (_: any, r: any) => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 11, color: '#9aa1ad' }}>{r.program} › {r.subject} › {r.chapter} › {r.topic}</div></div> },
    { title: 'Assigned editor', width: 160, render: (_: any, r: any) => edits[r.id]?.editorName ? <span><Avatar size={20} style={{ background: '#c2410c', marginRight: 6, fontSize: 11 }}>{(edits[r.id].editorName || '?')[0]}</Avatar>{edits[r.id].editorName}</span> : <Tag color="default">Unassigned</Tag> },
    { title: 'Final output', width: 170, render: (_: any, r: any) => <FinalOutputSelect id={r.id} value={edits[r.id]?.fo || 'Pending'} editStageId={r.byCode?.EDITING?.id} shootStageId={r.byCode?.SHOOTING?.id} reviewStageId={r.byCode?.SHOOT_REVIEW?.id} reload={load} /> },
    { title: '', width: 130, render: (_: any, r: any) => <Button size="small" onClick={() => setOpen(r)}>Capture details</Button> },
  ]
  return <Card styles={{ body: { padding: 16 } }}>
    <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      <Select placeholder="Program" allowClear showSearch style={{ minWidth: 150 }} value={programF} onChange={(v) => { setProgramF(v); setSubjectF(null); setChap(null); setTopicF(null) }} options={programs.map((p: any) => ({ value: p, label: p }))} />
      <Select placeholder="Subject" allowClear showSearch disabled={!programF} style={{ minWidth: 150 }} value={subjectF} onChange={(v) => { setSubjectF(v); setChap(null); setTopicF(null) }} options={subjects.map((s: any) => ({ value: s, label: s }))} />
      <Select placeholder="Chapter" allowClear showSearch disabled={!subjectF} style={{ minWidth: 140 }} value={chap} onChange={(v) => { setChap(v); setTopicF(null) }} options={chapters.map((c: any) => ({ value: c, label: c }))} />
      <Select placeholder="Topic" allowClear showSearch disabled={!chap} style={{ minWidth: 140 }} value={topicF} onChange={setTopicF} options={topics.map((t: any) => ({ value: t, label: t }))} />
      <Select placeholder="Final output" allowClear style={{ minWidth: 130 }} value={foF} onChange={setFoF} options={FINAL_OUTPUT_OPTS.map(s => ({ value: s, label: s }))} />
      {isAdmin && <Select placeholder="Editor" allowClear showSearch style={{ minWidth: 150 }} value={assignedF} onChange={setAssignedF} options={[{ value: '__none__', label: 'Unassigned' }, ...editors.map((e: any) => ({ value: e.id, label: e.full_name }))]} />}
      <div style={{ marginLeft: 'auto', alignSelf: 'center', color: '#9aa1ad', fontSize: 12 }}>{filtered.length} shown</div>
    </div>
    {isAdmin && selKeys.length > 0 && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eef0ff', border: '1px solid #d9defb', borderRadius: 8, padding: '8px 12px', marginBottom: 12, flexWrap: 'wrap' }}>
        <b>{selKeys.length} selected</b>
        <Select size="small" placeholder="Assign to editor…" style={{ width: 220 }} value={undefined} showSearch optionFilterProp="label"
          onChange={(v) => assignEditor(v === '__none__' ? null : v)} options={[{ value: '__none__', label: '— Unassign —' }, ...editors.map((e: any) => ({ value: e.id, label: e.full_name }))]} />
        <Button type="text" size="small" onClick={() => setSelKeys([])}>Clear selection</Button>
      </div>
    )}
    <Table columns={cols as any} dataSource={filtered.map((r: any) => ({ ...r, key: r.id }))} pagination={{ pageSize: 12 }}
      rowSelection={isAdmin ? { selectedRowKeys: selKeys, onChange: (keys: any) => setSelKeys(keys), preserveSelectedRowKeys: true } : undefined}
      locale={{ emptyText: <Empty description="Nothing waiting for editing" /> }} />
    {open && <EditingDrawer item={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load() }} />}
  </Card>
}
function EditingQueue() {
  const q = useEditingQueue()
  if (!q.items) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  return <div>
    <PageHead title="Editing Queue" sub={`${q.scoped.length} video(s) ready to edit${q.isEditor ? ' · assigned to you' : ''}`} />
    <EditingTable q={q} />
  </div>
}

/* ===================== mentor generation ===================== */
// The Lead/Manager rates a mentor: performance framework (weighted) + etiquette + today's mock + remarks.
// Each category becomes one mentor_rating row (date-stamped), so daily entries build the trend.
function MentorRateDrawer({ row, onClose, onSaved }: any) {
  const { message: msg } = AntApp.useApp()
  const { person } = useAuth()
  const mentorId = row.mentor_id || row.mentor?.id
  const topicId = row.topic_id || row.topic?.id
  const subtopicId = row.subtopic?.id || null // rate at sub-topic level when a sub-topic is supplied
  const mode = row.mode || 'all' // 'technical' (topic-scoped, per sub-topic) | 'daily' (general, once a day) | 'all'
  const modeGroups = RATING_GROUPS.filter(g => mode === 'technical' ? g.scope === 'topic' : mode === 'daily' ? g.scope === 'general' : true)
  const modeCats = RATING_CATS.filter(c => mode === 'technical' ? c.scope === 'topic' : mode === 'daily' ? c.scope === 'general' : true)
  const [scores, setScores] = useState<any>({})
  const [remark, setRemark] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [rateDate, setRateDate] = useState<any>(dayjs()) // the day this rating is FOR (daily etiquette can be back-dated)
  useEffect(() => { (async () => {
    setReady(false)
    // prefill: topic-scoped (Technical) cats from THIS sub-topic's own last score; daily (general)
    // cats from what was recorded on the SELECTED date, so you review/edit that exact day (blank if new).
    const scopeKey = subtopicId || topicId
    const dstr = (rateDate || dayjs()).format('YYYY-MM-DD')
    const data: any[] = MOCK_MENTOR_SUBTOPIC ? mockListRatings([mentorId]).slice().sort((a, b) => String(b.rated_on).localeCompare(String(a.rated_on)))
      : ((await supabase.from('mentor_rating').select('category, score, rated_on, scope_id, remarks').eq('mentor_id', mentorId).order('rated_on', { ascending: false })).data || [])
    const seen: any = {}
    let pref = '' // restore the previously-saved remark for this exact rating so the lead can see / edit it
    data.forEach((x: any) => {
      const c = RATING_CATS.find(rc => rc.key === x.category); if (!c) return
      const match = c.scope === 'topic' ? (x.scope_id === scopeKey) : (x.scope_id == null && String(x.rated_on).slice(0, 10) === dstr)
      if (!match) return
      if (x.score != null && seen[x.category] === undefined) seen[x.category] = Number(x.score)
      // only restore a remark left on THIS mode's categories (don't leak a daily remark into the technical box)
      if (!pref && x.remarks && modeCats.some(mc => mc.key === x.category)) pref = x.remarks // data is newest-first → latest remark
    })
    setScores(seen); setRemark(pref); setReady(true)
  })() }, [rateDate])
  const setCats = modeCats.filter(c => scores[c.key] != null)
  const overall = setCats.length ? setCats.reduce((s, c) => s + scores[c.key], 0) / setCats.length : 0
  async function save() {
    const dstr = (rateDate || dayjs()).format('YYYY-MM-DD')
    const rows = modeCats.filter(c => scores[c.key] != null).map(c => ({
      mentor_id: mentorId, rated_by: person?.id || null, rated_on: dstr,
      scope_level: c.scope, scope_id: c.scope === 'topic' ? (subtopicId || topicId || null) : null,
      category: c.key, score: scores[c.key], weight_snapshot: 1, remarks: remark || null,
    }))
    if (!rows.length) { msg.warning('Set at least one score.'); return }
    setBusy(true)
    const genKeys = modeCats.filter(c => c.scope === 'general').map(c => c.key) // daily etiquette = once a day
    if (MOCK_MENTOR_SUBTOPIC) {
      if (mode === 'daily' && genKeys.length) mockRemoveDailyRatings(mentorId, dstr, genKeys)
      mockSaveRatings(rows as any); setBusy(false); msg.success('Rating saved (mock — this browser only) ✓'); onSaved && onSaved(); onClose(); return
    }
    // once a day: replace any existing general-scoped scores for this mentor on this date before inserting
    if (mode === 'daily' && genKeys.length) { await supabase.from('mentor_rating').delete().eq('mentor_id', mentorId).is('scope_id', null).eq('rated_on', dstr).in('category', genKeys) }
    const { error } = await supabase.from('mentor_rating').insert(rows)
    setBusy(false)
    if (error) { msg.error(/mentor_rating|relation|does not exist/.test(error.message) ? 'Run RecTrack_v20.sql first to enable ratings.' : error.message); return }
    msg.success('Rating saved ✓'); onSaved && onSaved(); onClose()
  }
  return (
    <Drawer open width={460} title={`${mode === 'technical' ? 'Technical rating' : mode === 'daily' ? 'Daily corporate etiquette' : 'Rate'} · ${row.mentor?.full_name || 'mentor'}`} onClose={onClose}>
      <div style={{ fontSize: 12, color: '#9aa1ad', marginBottom: 12 }}>{[row.topic?.chapter?.subject?.main_subject?.name, row.topic?.name, row.subtopic?.name].filter(Boolean).join(' › ')}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#69707d' }}>{mode === 'daily' ? 'Rating for date' : 'Rating date'}</span>
        <DatePicker value={rateDate} onChange={(v: any) => setRateDate(v || dayjs())} allowClear={false} disabledDate={(d: any) => d && d.isAfter(dayjs(), 'day')} />
      </div>
      {!ready ? <div style={{ display: 'grid', placeItems: 'center', height: 160 }}><Spin /></div>
        : <>
          {modeGroups.map(g => <div key={g.kind} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#161a22', marginBottom: 8 }}>{g.title}</div>
            {g.cats.map(c => (
              <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 13, color: '#69707d' }}>{c.label}</span>
                <Slider min={0} max={5} step={0.5} value={scores[c.key] ?? 0} onChange={(v: number) => setScores((s: any) => ({ ...s, [c.key]: v }))} style={{ width: 160 }} />
                <span style={{ width: 30, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{(scores[c.key] ?? 0).toFixed(1)}</span>
              </div>
            ))}
          </div>)}
          <div style={{ fontSize: 13, fontWeight: 600, color: '#69707d', margin: '4px 0 6px' }}>Remarks <span style={{ color: '#9aa1ad', fontWeight: 400 }}>(the mentor sees this)</span></div>
          <Input.TextArea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. Strong fundamentals; pace up the mock delivery." />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
            <span style={{ color: '#69707d', fontSize: 13 }}>Average (this rating)</span>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{overall.toFixed(1)}<span style={{ fontSize: 13, color: '#9aa1ad' }}> / 5</span></span>
          </div>
          <Button type="primary" block loading={busy} onClick={save} style={{ marginTop: 12 }}>Save rating</Button>
        </>}
    </Drawer>
  )
}
// A mentor preps a topic through 4 gated steps (watch video → AI notes → AI practice → presentation review)
// before being deploy-ready. Admins/managers assign topics; mentors work their own.
function MentorPrepDrawer({ row, canEdit, canLead, onClose, onSaved }: any) {
  const { message: msg } = AntApp.useApp()
  const [d, setD] = useState<any>(row)
  const [aiBusy, setAiBusy] = useState('')
  const [sb, setSb] = useState<any>(null); const [sbText, setSbText] = useState('')
  useEffect(() => { setD(row) }, [row?.id])
  // Lead sends a completed step back to the mentor with a note (bumps the QC/send-back signal)
  async function sendBack() {
    if (!sb) return
    const upd: any = { [sb.key]: false, send_back_count: (Number(d.send_back_count) || 0) + 1, lead_remark: sbText.trim() || null }
    const next = { ...d, ...upd }; setD(next)
    let { error } = await supabase.from('mentor_prep').update(upd).eq('id', d.id)
    if (error && /send_back_count|lead_remark/.test(error.message)) { ({ error } = await supabase.from('mentor_prep').update({ [sb.key]: false }).eq('id', d.id)) } // pre-v21 fallback
    if (error) { msg.error(error.message); setD(d); return }
    setSb(null); setSbText(''); msg.success('Step sent back to the mentor'); onSaved && onSaved()
  }
  const topicLabel = [d.topic?.chapter?.subject?.main_subject?.name, d.topic?.chapter?.subject?.name, d.topic?.chapter?.name, d.topic?.name].filter(Boolean).join(' › ')
  async function patch(fields: any) {
    // stamp progress time when a step is completed → powers the stall/velocity risk signal
    const stepDone = ['watched', 'notes_done', 'practice_done', 'presentation_done'].some(k => fields[k] === true)
    const upd = stepDone ? { ...fields, last_progress_at: new Date().toISOString() } : fields
    const next = { ...d, ...upd }; setD(next)
    let { error } = await supabase.from('mentor_prep').update(upd).eq('id', d.id)
    if (error && /last_progress_at/.test(error.message)) { ({ error } = await supabase.from('mentor_prep').update(fields).eq('id', d.id)) } // pre-v21 fallback
    if (error) { msg.error(error.message); setD(d); return }
    onSaved && onSaved()
  }
  async function generate(kind: 'notes' | 'practice' | 'feedback', field: string) {
    setAiBusy(kind)
    try {
      const r: any = await supabase.functions.invoke('mentor-ai', { body: { kind, topic: d.topic?.name, path: topicLabel, ppt: d.ppt_link || null } })
      if (r.error || !r.data?.text) { msg.warning('AI helper not set up yet — deploy the mentor-ai edge function, or type it in manually for now.'); return }
      patch({ [field]: r.data.text })
    } catch { msg.warning('AI helper not reachable — type it in manually for now.') }
    finally { setAiBusy('') }
  }
  const stepLocked = (i: number) => i === 1 ? !d.watched : i === 2 ? !d.notes_done : i === 3 ? !d.practice_done : false
  const rs = d.review_status || 'open'
  const all4 = d.watched && d.notes_done && d.practice_done && d.presentation_done
  const presLabel = canLead ? 'Presentation approved' : 'Presentation done'
  async function patchStatus(fields: any) {
    const { error } = await supabase.from('mentor_prep').update(fields).eq('id', d.id)
    if (error) { msg.error(/review_status|submitted_at|completed_at/.test(error.message) ? 'Run RecTrack_v22.sql first to enable the review workflow.' : error.message); return false }
    onSaved && onSaved(); return true
  }
  async function submitReview() { if (await patchStatus({ review_status: 'ready_for_review', submitted_at: new Date().toISOString() })) { msg.success('Submitted for review'); onClose() } }
  async function rework() { if (await patchStatus({ review_status: 'open' })) { msg.success('Sent back — the mentor can edit again'); onClose() } }
  async function complete() {
    const rt = await supabase.from('mentor_rating').select('id').eq('mentor_id', d.mentor_id).limit(1)
    if (!rt.data || !rt.data.length) { msg.warning('Rate the mentor first — a rating is required to mark completed.'); return }
    if (await patchStatus({ review_status: 'completed', completed_at: new Date().toISOString() })) { msg.success('Marked completed ✓'); onClose() }
  }
  return (
    <Drawer open width={560} title={`Prep · ${d.topic?.chapter?.subject?.main_subject?.name || 'Program'}`} onClose={onClose} extra={rs === 'completed' ? <Tag color="green">Completed</Tag> : rs === 'ready_for_review' ? <Tag color="blue">Ready for review</Tag> : all4 ? <Tag color="gold">Ready to submit</Tag> : <Tag color="geekblue">Assigned</Tag>}>
      <div style={{ fontSize: 12, color: '#9aa1ad', marginBottom: 8 }}>{topicLabel}</div>
      {(d.topic?.subtopic || []).length > 0 && <div style={{ marginBottom: 12 }}><span style={{ fontSize: 11, color: '#69707d', marginRight: 6 }}>Sub-topics:</span>{[...d.topic.subtopic].sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0)).map((s: any, i: number) => s?.name && <Tag key={i} style={{ marginBottom: 4 }}>{s.name}</Tag>)}</div>}
      <div style={{ background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#69707d', marginBottom: 10 }}><HistoryOutlined style={{ marginRight: 5 }} />Progress log</div>
        <Timeline items={[
          { color: 'blue', children: <span>Assigned <span style={{ color: '#9aa1ad', fontSize: 12 }}>{d.created_at ? dayjs(d.created_at).format('DD MMM YYYY') : ''}</span></span> },
          ...MENTOR_STEPS.map((s: any) => ({ color: d[s.key] ? 'green' : 'gray', children: <span style={{ color: d[s.key] ? '#161a22' : '#9aa1ad' }}>{s.label}{d[s.key] ? ' ✓' : ' · pending'}</span> })),
          ...(d.submitted_at ? [{ color: 'blue', children: <span>Submitted for review <span style={{ color: '#9aa1ad', fontSize: 12 }}>{dayjs(d.submitted_at).format('DD MMM')}</span></span> }] : []),
          ...(d.completed_at ? [{ color: 'green', children: <span>Completed <span style={{ color: '#9aa1ad', fontSize: 12 }}>{dayjs(d.completed_at).format('DD MMM')}</span></span> }] : []),
        ]} />
        {!canLead && (d.fb_notes || d.fb_practice || d.fb_presentation || d.lead_remark) && <div style={{ fontSize: 12, color: '#161a22', borderTop: '1px solid #eef0f3', paddingTop: 8 }}>
          <b>Lead feedback:</b>
          {d.fb_notes && <div>· Notes: {d.fb_notes}</div>}
          {d.fb_practice && <div>· Practice: {d.fb_practice}</div>}
          {d.fb_presentation && <div>· Presentation: {d.fb_presentation}</div>}
          {d.lead_remark && <div>· Note: {d.lead_remark}</div>}
        </div>}
      </div>

      <div style={{ border: '0.5px solid #eef0f3', borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ color: d.watched ? '#16a34a' : PRIMARY }}>{d.watched ? '✓' : '▶'}</span><b style={{ fontSize: 14 }}>1 · Watch video</b></div>
        <Input placeholder="Paste the video link" value={d.video_link || ''} disabled={!canEdit} onChange={e => setD({ ...d, video_link: e.target.value })} onBlur={() => canEdit && d.video_link !== row.video_link && patch({ video_link: d.video_link })} style={{ marginBottom: 8 }} />
        {d.video_link && <a href={d.video_link} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Open video ↗</a>}
        <div style={{ marginTop: 8 }}><Checkbox checked={!!d.watched} disabled={!canEdit} onChange={e => patch({ watched: e.target.checked })}>Mark as watched</Checkbox></div>
      </div>

      <div style={{ border: '0.5px solid #eef0f3', borderRadius: 12, padding: 14, marginBottom: 12, opacity: stepLocked(1) ? 0.55 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: d.notes_done ? '#16a34a' : PRIMARY }}>{d.notes_done ? '✓' : '✎'}</span><b style={{ fontSize: 14 }}>2 · Notes preparation</b></div>
          {canEdit && !stepLocked(1) && <Button size="small" loading={aiBusy === 'notes'} onClick={() => generate('notes', 'notes_text')}>Generate with AI</Button>}
        </div>
        {stepLocked(1) ? <div style={{ fontSize: 12, color: '#9aa1ad' }}>Unlocks after the video is watched.</div> : <>
          <Input.TextArea rows={5} placeholder="Detailed study notes for this topic…" value={d.notes_text || ''} disabled={!canEdit} onChange={e => setD({ ...d, notes_text: e.target.value })} onBlur={() => canEdit && d.notes_text !== row.notes_text && patch({ notes_text: d.notes_text })} />
          <div style={{ marginTop: 8 }}><Checkbox checked={!!d.notes_done} disabled={!canEdit} onChange={e => patch({ notes_done: e.target.checked })}>Notes ready</Checkbox></div>
        </>}
      </div>

      <div style={{ border: '0.5px solid #eef0f3', borderRadius: 12, padding: 14, marginBottom: 12, opacity: stepLocked(2) ? 0.55 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: d.practice_done ? '#16a34a' : PRIMARY }}>{d.practice_done ? '✓' : '◎'}</span><b style={{ fontSize: 14 }}>3 · Practice</b></div>
          {canEdit && !stepLocked(2) && <Button size="small" loading={aiBusy === 'practice'} onClick={() => generate('practice', 'practice_text')}>Generate with AI</Button>}
        </div>
        {stepLocked(2) ? <div style={{ fontSize: 12, color: '#9aa1ad' }}>Unlocks after notes are ready.</div> : <>
          <Input.TextArea rows={5} placeholder="Practice drills / training scenarios to rehearse delivery…" value={d.practice_text || ''} disabled={!canEdit} onChange={e => setD({ ...d, practice_text: e.target.value })} onBlur={() => canEdit && d.practice_text !== row.practice_text && patch({ practice_text: d.practice_text })} />
          <div style={{ marginTop: 8 }}><Checkbox checked={!!d.practice_done} disabled={!canEdit} onChange={e => patch({ practice_done: e.target.checked })}>Practice done</Checkbox></div>
        </>}
      </div>

      <div style={{ border: '0.5px solid #eef0f3', borderRadius: 12, padding: 14, opacity: stepLocked(3) ? 0.55 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: d.presentation_done ? '#16a34a' : PRIMARY }}>{d.presentation_done ? '✓' : '▤'}</span><b style={{ fontSize: 14 }}>4 · Presentation review</b></div>
          {canEdit && !stepLocked(3) && <Button size="small" loading={aiBusy === 'feedback'} onClick={() => generate('feedback', 'feedback_text')}>Get AI feedback</Button>}
        </div>
        {stepLocked(3) ? <div style={{ fontSize: 12, color: '#9aa1ad' }}>Unlocks after practice is done.</div> : <>
          <Input placeholder="Paste the PPT link" value={d.ppt_link || ''} disabled={!canEdit} onChange={e => setD({ ...d, ppt_link: e.target.value })} onBlur={() => canEdit && d.ppt_link !== row.ppt_link && patch({ ppt_link: d.ppt_link })} style={{ marginBottom: 8 }} />
          <Input.TextArea rows={4} placeholder="Feedback on the presentation…" value={d.feedback_text || ''} disabled={!canEdit} onChange={e => setD({ ...d, feedback_text: e.target.value })} onBlur={() => canEdit && d.feedback_text !== row.feedback_text && patch({ feedback_text: d.feedback_text })} />
          <div style={{ marginTop: 8 }}><Checkbox checked={!!d.presentation_done} disabled={!canEdit} onChange={e => patch({ presentation_done: e.target.checked })}>{presLabel}</Checkbox></div>
        </>}
      </div>

      {rs === 'ready_for_review' && !canLead && <div style={{ background: '#e6f4ff', border: '1px solid #bae0ff', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginTop: 12 }}>Submitted for review — locked until your Lead gives feedback.</div>}
      {rs === 'completed' && <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginTop: 12 }}>Completed ✓ — deploy-ready.</div>}
      {canEdit && rs === 'open' && all4 && <Button type="primary" block style={{ marginTop: 12 }} onClick={submitReview}>Submit for review</Button>}

      {canLead && (() => { const reviewing = rs === 'ready_for_review'; return <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 16, paddingTop: 14 }}>
        <b style={{ fontSize: 14 }}>Lead review &amp; feedback</b>
        {!reviewing && rs !== 'completed' && <div style={{ fontSize: 12, color: '#9aa1ad', margin: '6px 0 0' }}>View only — the mentor hasn’t submitted for review yet. You can review and give feedback once it’s <b>Ready for review</b>.</div>}
        <div style={{ fontSize: 12, color: '#69707d', margin: '8px 0 4px' }}>Notes feedback</div>
        <Input.TextArea rows={2} disabled={!reviewing} placeholder="Feedback on the notes…" value={d.fb_notes || ''} onChange={e => setD({ ...d, fb_notes: e.target.value })} onBlur={() => d.fb_notes !== row.fb_notes && patch({ fb_notes: d.fb_notes })} />
        <div style={{ fontSize: 12, color: '#69707d', margin: '8px 0 4px' }}>Practice feedback</div>
        <Input.TextArea rows={2} disabled={!reviewing} placeholder="Feedback on the practice…" value={d.fb_practice || ''} onChange={e => setD({ ...d, fb_practice: e.target.value })} onBlur={() => d.fb_practice !== row.fb_practice && patch({ fb_practice: d.fb_practice })} />
        <div style={{ fontSize: 12, color: '#69707d', margin: '8px 0 4px' }}>Presentation feedback</div>
        <Input.TextArea rows={2} disabled={!reviewing} placeholder="Feedback on the presentation…" value={d.fb_presentation || ''} onChange={e => setD({ ...d, fb_presentation: e.target.value })} onBlur={() => d.fb_presentation !== row.fb_presentation && patch({ fb_presentation: d.fb_presentation })} />
        {reviewing && <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Button danger block onClick={rework}>Send back for rework</Button>
          <Button type="primary" block onClick={complete}>Mark as completed</Button>
        </div>}
      </div> })()}

      {d.lead_remark && <div style={{ background: '#fff7e6', border: '1px solid #ffe0a3', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginTop: 12 }}><b>Lead note (step):</b> {d.lead_remark}</div>}

      {canLead && (() => { const done = MENTOR_STEPS.filter(s => d[s.key]); return done.length > 0 && (
        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 16, paddingTop: 14 }}>
          <b style={{ fontSize: 14 }}>Lead review</b>
          <div style={{ fontSize: 12, color: '#9aa1ad', margin: '4px 0 8px' }}>Reopen a completed step and send it back to the mentor with a note.</div>
          <Select placeholder="Step to send back" style={{ width: '100%', marginBottom: 8 }} value={sb?.key} onChange={(k) => setSb({ key: k })} options={done.map(s => ({ value: s.key, label: s.label }))} />
          <Input.TextArea rows={2} placeholder="Reason / what to improve…" value={sbText} onChange={e => setSbText(e.target.value)} style={{ marginBottom: 8 }} />
          <Button danger block disabled={!sb} onClick={sendBack}>Send back to mentor</Button>
        </div>
      ) })()}
    </Drawer>
  )
}

/* ===================== performance dashboard (analytics — VIEW ONLY) =====================
   A visual, read-only analytics view: how the individual and (for leads) their team are
   performing. Charts only, no actions. Top-level nav item above Command Center, for the
   non-management roles (trainer / editor / reviewer / team-lead / mentor). */
const DASH_ROLES = ['trainer', 'editor', 'reviewer', 'team_lead', 'mentor']
const STATUS_COLORS = ['#16a34a', '#2563eb', '#cbd5e1']
function DashStat({ label, value, color }: any) {
  return <div style={{ flex: '1 1 140px', background: '#fff', border: '1px solid #eef0f3', borderRadius: 14, padding: '14px 18px' }}>
    <div style={{ fontSize: 12, color: '#69707d' }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color: color || '#161a22' }}>{value}</div>
  </div>
}
function DashDonut({ data, colors }: any) {
  const total = data.reduce((s: number, x: any) => s + x.value, 0)
  return <Row gutter={8} align="middle">
    <Col span={13}>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Tooltip formatter={(v: any, n: any) => [v, n]} />
          <Pie data={total ? data : [{ name: 'No data', value: 1 }]} dataKey="value" nameKey="name" innerRadius={50} outerRadius={82} paddingAngle={2} isAnimationActive={false}>
            {(total ? data : [{}]).map((_: any, i: number) => <Cell key={i} fill={total ? colors[i % colors.length] : '#eef0f3'} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </Col>
    <Col span={11}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((s: any, i: number) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: colors[i % colors.length] }} />
            <span style={{ flex: 1, color: '#69707d' }}>{s.name}</span>
            <b>{s.value}</b>
          </div>
        ))}
      </div>
    </Col>
  </Row>
}
function WorkDashboard() {
  const { person } = useAuth()
  const isMentor = person?.role === 'mentor'
  const isLead = OWNER_ROLES.includes(person?.role)
  const [d, setD] = useState<any>(null)
  async function load() {
    if (!person?.id) return
    if (isMentor) {
      const r = await supabase.from('mentor_prep')
        .select('id, review_status, created_at, watched, notes_done, practice_done, presentation_done, topic:topic_id(name)')
        .eq('mentor_id', person.id)
      setD({ prep: r.error ? [] : (r.data || []) }); return
    }
    const all = await fetchAllItems()
    const inScope = await buildScope(person)
    const mine = all.filter(inScope)
    let team: any[] = []
    if (isLead) {
      const p = await supabase.from('person').select('id, full_name, role, is_active, lead_id')
      const active = p.error ? [] : (p.data || []).filter((x: any) => x.is_active)
      const managed = new Set<string>(active.filter((x: any) => x.lead_id === person.id).map((x: any) => x.id))
      // also include mentors managed via the multiple-leads join table (v28 / mock)
      if (MOCK_MENTOR_SUBTOPIC) { const allMl = mockAllMentorLeads(); Object.keys(allMl).forEach((mid) => { if (allMl[mid].includes(person.id)) managed.add(mid) }) }
      else { const ml = await supabase.from('mentor_lead').select('mentor_id').eq('lead_id', person.id); if (!ml.error) (ml.data || []).forEach((x: any) => managed.add(x.mentor_id)) }
      const ppl = active.filter((x: any) => managed.has(x.id))
      const ow = await selectAll('v_item_owner', 'content_item_id, trainer_id')
      const byT: any = {}; ow.forEach((o: any) => { if (o.trainer_id) (byT[o.trainer_id] = byT[o.trainer_id] || new Set()).add(o.content_item_id) })
      const mineIds = new Set(mine.map((i: any) => i.id))
      const doneI = (i: any) => i.stageName === 'Done' || i.stageName === 'Published'
      team = ppl.map((m: any) => {
        const ids = byT[m.id] ? [...byT[m.id]].filter((x: any) => mineIds.has(x)) : []
        const done = mine.filter((i: any) => ids.includes(i.id) && doneI(i)).length
        return { name: (m.full_name || '').split(' ')[0] || m.full_name, role: m.role, Assigned: ids.length, Done: done }
      }).filter((m: any) => m.Assigned > 0).sort((a: any, b: any) => b.Assigned - a.Assigned)
    }
    setD({ mine, team })
  }
  useEffect(() => { load() }, [person?.id])
  useAutoRefresh(load)
  if (!d) return <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Spin /></div>
  const firstName = (person?.full_name || '').split(' ')[0] || 'You'

  if (isMentor) {
    const prep = d.prep
    const doneCount = (r: any) => MENTOR_STEPS.filter(s => r[s.key]).length
    const ready = prep.filter((r: any) => doneCount(r) === 4).length
    const inprog = prep.filter((r: any) => doneCount(r) > 0 && doneCount(r) < 4).length
    const notStarted = prep.filter((r: any) => doneCount(r) === 0).length
    const statusData = [{ name: 'Deploy ready', value: ready }, { name: 'In progress', value: inprog }, { name: 'Not started', value: notStarted }]
    const stepData = MENTOR_STEPS.map((s) => ({ name: s.label, done: prep.filter((r: any) => r[s.key]).length }))
    const pct = prep.length ? Math.round(ready / prep.length * 100) : 0
    return <div>
      <PageHead title={`${firstName} · my performance`} sub="Your prep analytics — view only" />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <DashStat label="Topics assigned" value={prep.length} />
        <DashStat label="Deploy ready" value={ready} color="#16a34a" />
        <DashStat label="In progress" value={inprog} color="#2563eb" />
        <DashStat label="Completion" value={pct + '%'} color={PRIMARY} />
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={10}><Card title="Prep status"><DashDonut data={statusData} colors={STATUS_COLORS} /></Card></Col>
        <Col xs={24} md={14}><Card title="Step completion across your topics">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stepData} layout="vertical" margin={{ left: 20, right: 44 }}>
              <XAxis type="number" hide allowDecimals={false} domain={[0, prep.length || 1]} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => [v + ' / ' + prep.length, 'Topics done']} />
              <Bar dataKey="done" fill={PRIMARY} radius={[0, 6, 6, 0]} isAnimationActive={false}><LabelList dataKey="done" position="right" style={{ fontSize: 11, fill: '#69707d' }} /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card></Col>
      </Row>
    </div>
  }

  const mine = d.mine
  const isDone = (i: any) => i.stageName === 'Done' || i.stageName === 'Published'
  const done = mine.filter(isDone).length
  const inprog = mine.filter((i: any) => i.completion > 0 && !isDone(i)).length
  const notStarted = mine.filter((i: any) => i.completion === 0).length
  const delayOf = (i: any) => { const ds = Object.values(i.byCode || {}).map((s: any) => Number(s.delay) || 0); return ds.length ? Math.max(0, ...ds) : 0 }
  const overdue = mine.filter((i: any) => delayOf(i) > 0).length
  const completionPct = mine.length ? Math.round(done / mine.length * 100) : 0
  const onTimePct = mine.length ? Math.round((1 - overdue / mine.length) * 100) : 100
  const statusData = [{ name: 'Published', value: done }, { name: 'In progress', value: inprog }, { name: 'Not started', value: notStarted }]
  const progMap: any = {}; mine.forEach((i: any) => { const p = progMap[i.program] || (progMap[i.program] = { name: i.program, total: 0, done: 0 }); p.total++; if (isDone(i)) p.done++ })
  const programData = Object.values(progMap).map((p: any) => ({ name: p.name, completion: p.total ? Math.round(p.done / p.total * 100) : 0, total: p.total })).sort((a: any, b: any) => b.total - a.total)
  const team = d.team || []
  return <div>
    <PageHead title={`${firstName} · ${isLead ? 'team & personal' : 'my'} performance`} sub="How you and your work are performing — view only" />
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <DashStat label="My sub-topics" value={mine.length} />
      <DashStat label="Published" value={done} color="#16a34a" />
      <DashStat label="In progress" value={inprog} color="#2563eb" />
      <DashStat label="Overdue" value={overdue} color={overdue ? '#dc2626' : '#9aa1ad'} />
      <DashStat label="On-time" value={onTimePct + '%'} color={onTimePct >= 80 ? '#16a34a' : '#d97706'} />
    </div>
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} md={9}><Card title="Status of my scope" style={{ height: '100%' }}>
        <DashDonut data={statusData} colors={STATUS_COLORS} />
        <div style={{ marginTop: 8, fontSize: 12, color: '#69707d' }}>Overall completion <b style={{ color: '#16a34a' }}>{completionPct}%</b> · on-time <b style={{ color: onTimePct >= 80 ? '#16a34a' : '#d97706' }}>{onTimePct}%</b></div>
      </Card></Col>
      <Col xs={24} md={15}><Card title="Completion by program" style={{ height: '100%' }}>
        {programData.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No programs in scope" /> :
        <ResponsiveContainer width="100%" height={Math.max(170, programData.length * 40)}>
          <BarChart data={programData} layout="vertical" margin={{ left: 20, right: 48 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: any, _n: any, p: any) => [v + '% (' + p.payload.total + ' items)', 'Completion']} />
            <Bar dataKey="completion" fill={PRIMARY} radius={[0, 6, 6, 0]} isAnimationActive={false}><LabelList dataKey="completion" position="right" formatter={(v: any) => v + '%'} style={{ fontSize: 11, fill: '#69707d' }} /></Bar>
          </BarChart>
        </ResponsiveContainer>}
      </Card></Col>
    </Row>
    {isLead && <Card title="Team performance — assigned vs completed" style={{ marginBottom: 16 }}>
      {team.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No active teammates report to you yet" /> :
      <ResponsiveContainer width="100%" height={Math.max(160, team.length * 54)}>
        <BarChart data={team} layout="vertical" margin={{ left: 20, right: 40 }} barGap={3}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fontWeight: 600 }} />
          <Tooltip />
          <Bar dataKey="Assigned" fill="#cbd5e1" radius={[0, 5, 5, 0]} isAnimationActive={false}><LabelList dataKey="Assigned" position="right" style={{ fontSize: 11, fill: '#69707d' }} /></Bar>
          <Bar dataKey="Done" fill="#16a34a" radius={[0, 5, 5, 0]} isAnimationActive={false}><LabelList dataKey="Done" position="right" style={{ fontSize: 11, fill: '#16a34a' }} /></Bar>
        </BarChart>
      </ResponsiveContainer>}
    </Card>}
  </div>
}

// Topic audit trail — every mentor who has EVER held this topic (active + withdrawn), with the
// who / when / why of each action. Read-only; visible to EVERYONE (the mp_read RLS allows select).
function TopicHistory({ topicId, topicName, onClose }: any) {
  const [rows, setRows] = useState<any>(null)
  const [names, setNames] = useState<any>({})
  useEffect(() => { (async () => {
    const r = await supabase.from('mentor_prep').select('*, mentor:mentor_id(full_name)').eq('topic_id', topicId).order('created_at', { ascending: true })
    const data = r.error ? [] : (r.data || [])
    const ids = [...new Set(data.flatMap((x: any) => [x.assigned_by, x.withdrawn_by]).filter(Boolean))]
    const nm: any = {}
    if (ids.length) { const p = await supabase.from('person').select('id, full_name').in('id', ids as any); (p.data || []).forEach((x: any) => { nm[x.id] = x.full_name }) }
    setNames(nm); setRows(data)
  })() }, [topicId])
  const fmt = (d: any) => d ? dayjs(d).format('DD MMM YYYY, HH:mm') : ''
  return <Modal open width={640} title={<span><HistoryOutlined style={{ marginRight: 8 }} />History — {topicName || 'topic'}</span>} footer={<Button onClick={onClose}>Close</Button>} onCancel={onClose}>
    {!rows ? <div style={{ display: 'grid', placeItems: 'center', height: 120 }}><Spin /></div>
      : rows.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No mentor has been assigned to this topic yet." />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{rows.map((r: any) => {
          const withdrawn = (r.state || 'active') === 'withdrawn'
          const rs = r.review_status || 'open'
          const items: any[] = [{ color: 'blue', children: <span>Assigned to <b>{r.mentor?.full_name || 'mentor'}</b>{r.assigned_by ? <> by {names[r.assigned_by] || '—'}</> : ''} <span style={{ color: '#9aa1ad', fontSize: 12 }}>{fmt(r.created_at)}</span></span> }]
          if (r.submitted_at) items.push({ color: 'blue', children: <span>Submitted for review <span style={{ color: '#9aa1ad', fontSize: 12 }}>{fmt(r.submitted_at)}</span></span> })
          if (r.send_back_count) items.push({ color: 'orange', children: <span>Sent back for rework ×{r.send_back_count}</span> })
          if (r.completed_at) items.push({ color: 'green', children: <span>Completed <span style={{ color: '#9aa1ad', fontSize: 12 }}>{fmt(r.completed_at)}</span></span> })
          if (withdrawn) items.push({ color: 'red', children: <span>Withdrawn{r.withdrawn_by ? <> by {names[r.withdrawn_by] || '—'}</> : ''} <span style={{ color: '#9aa1ad', fontSize: 12 }}>{fmt(r.withdrawn_at)}</span>{r.withdraw_reason ? <div style={{ fontSize: 12, color: '#dc2626' }}>Reason: {r.withdraw_reason}</div> : null}</span> })
          const statusTag = withdrawn ? <Tag color="red">Withdrawn</Tag> : rs === 'completed' ? <Tag color="green">Completed</Tag> : rs === 'ready_for_review' ? <Tag color="blue">Ready for review</Tag> : <Tag color="geekblue">Assigned</Tag>
          return <div key={r.id} style={{ border: '1px solid #eef0f3', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><Avatar size={22} style={{ background: '#c2410c', fontSize: 11 }}>{(r.mentor?.full_name || '?')[0]}</Avatar><b>{r.mentor?.full_name || '—'}</b>{statusTag}</div>
            <Timeline items={items} />
          </div>
        })}</div>}
  </Modal>
}

// inline 4-step progress for ONE sub-topic — the mentor (or admin) ticks each gated step.
// Persists to mentor_subtopic_prep (upsert on mentor_id,subtopic_id). Read-only when !canEdit.
function SubtopicSteps({ mentorId, subtopicId, prog, canEdit, onSaved }: any) {
  const { message: msg } = AntApp.useApp()
  const [p, setP] = useState<any>(prog || {})
  const [busy, setBusy] = useState(false)
  useEffect(() => { setP(prog || {}) }, [prog?.watched, prog?.notes_done, prog?.practice_done, prog?.presentation_done, subtopicId])
  // each of the 4 steps is independently tickable per sub-topic (no forced order)
  async function toggle(key: string) {
    if (!canEdit || busy) return
    const next: any = { ...p, [key]: !p[key] }
    setP(next); setBusy(true)
    if (MOCK_MENTOR_SUBTOPIC) { mockSaveSubProg(mentorId, subtopicId, next); setBusy(false); onSaved && onSaved(subtopicId, next); return }
    const { error } = await supabase.from('mentor_subtopic_prep').upsert({ mentor_id: mentorId, subtopic_id: subtopicId, watched: !!next.watched, notes_done: !!next.notes_done, practice_done: !!next.practice_done, presentation_done: !!next.presentation_done, updated_at: new Date().toISOString() }, { onConflict: 'mentor_id,subtopic_id' })
    setBusy(false)
    if (error) { setP(p); msg.error(/mentor_subtopic_prep|relation|does not exist/.test(error.message) ? 'Run RecTrack_v27.sql first.' : error.message); return }
    onSaved && onSaved(subtopicId, next)
  }
  return <span style={{ display: 'flex', gap: 6 }}>{MENTOR_STEPS.map((s) => {
    const done = p[s.key]
    return <span key={s.key} title={canEdit ? `${done ? 'Undo' : 'Mark'} ${s.label}` : s.label} onClick={() => canEdit && toggle(s.key)}
      style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, cursor: canEdit ? 'pointer' : 'default', background: done ? '#16a34a' : '#eef0f3', color: done ? '#fff' : '#9aa1ad', border: !done && canEdit ? `1px dashed ${hexA(PRIMARY, 0.5)}` : '1px solid transparent' }}>{done ? '✓' : s.icon}</span>
  })}</span>
}

const DEPLOY_TYPES = ['Branch', 'Online training', 'College', 'Corporate training', 'College grooming']
const DEPLOY_TYPE_COLOR: Record<string, string> = {
  'Branch': '#2563eb', 'Online training': '#7c3aed', 'College': '#0891b2', 'Corporate training': '#c2410c', 'College grooming': '#16a34a',
}
// Training-side lifecycle status (v34). "deployed" / "back to bench" are NOT here —
// they are derived from mentor_deployment (v30). This only tracks the training state.
const MENTOR_LIFECYCLE: { key: string; label: string; color: string }[] = [
  { key: 'in_training', label: 'Under training', color: 'orange' },
  { key: 'ready_to_deploy', label: 'Ready to deploy', color: 'green' },
  { key: 'upskilling', label: 'Upskilling', color: 'purple' },
  { key: 'terminated', label: 'Terminated (performance)', color: 'red' },
  { key: 'dropout', label: 'Dropout (mid-training)', color: 'volcano' },
]
const LIFECYCLE_LABEL: Record<string, string> = Object.fromEntries(MENTOR_LIFECYCLE.map(s => [s.key, s.label]))
const LIFECYCLE_COLOR: Record<string, string> = Object.fromEntries(MENTOR_LIFECYCLE.map(s => [s.key, s.color]))
// statuses that mean the mentor has exited the active training pipeline
const MENTOR_EXITED = new Set(['terminated', 'dropout'])
// Mentors deployed / Back to bench. A deployment needs a Manager's prior approval (pending → approved).
// A mentor who finished training and isn't on an active deployment is "on the bench" (available to map).
function MentorDeployments({ mentors, mode, subjectOf = {} }: any) {
  const { person } = useAuth()
  const { message: msg } = AntApp.useApp()
  const isManager = person?.role === 'manager' || person?.role === 'admin'
  const [deps, setDeps] = useState<any[] | null>(null)
  const [add, setAdd] = useState<any>(null)   // { mentor_id, name, subject } when the add-deployment modal is open
  const [editId, setEditId] = useState<string | null>(null) // deployment being edited (null = new request)
  const [form, setForm] = useState<any>({})
  const [q, setQ] = useState('')
  const [fb, setFb] = useState<any>(null)     // { mentor_id, name } when the feedback-rating modal is open
  const [fbDep, setFbDep] = useState<any>(null) // the deployment (return) the feedback is for
  const [fbScores, setFbScores] = useState<any>({})
  const [feedbackByDep, setFeedbackByDep] = useState<any>({}) // deployment_id -> { category: latest } (per completed training/return)
  const [batches, setBatches] = useState<any[]>([]) // mentor_online_batch rows (v35) — a deployment can have MANY batches
  const [bModal, setBModal] = useState<any>(null)   // { dep, batch? } while the add/edit-batch modal is open
  const [bForm, setBForm] = useState<any>({})
  const [rCell, setRCell] = useState<any>(null) // Back-to-bench: { subject, band } whose mentor names are open
  const nameById: any = Object.fromEntries(mentors.map((m: any) => [m.id, m.full_name]))
  const empById: any = Object.fromEntries(mentors.map((m: any) => [m.id, m.employee_id || '']))
  const mentorIds = new Set(mentors.map((m: any) => m.id))
  // deployment_id -> ALL its batches (same trainer can run several batches on the same date)
  const batchesByDep: any = batches.reduce((a: any, b: any) => { (a[b.deployment_id] = a[b.deployment_id] || []).push(b); return a }, {})
  async function load() {
    if (MOCK_MENTOR_SUBTOPIC) { setDeps(mockListDeployments()); setBatches(mockListOnlineBatches()); return }
    const r = await supabase.from('mentor_deployment').select('*').order('created_at', { ascending: false })
    setDeps(r.error ? [] : (r.data || []))
    const b = await supabase.from('mentor_online_batch').select('*')
    setBatches(b.error ? [] : (b.data || [])) // absent until v35 is applied → just no batch details
  }
  // average of the 3 deployment-feedback dimensions per mentor (to display in Back-to-bench)
  const FB_KEYS = FEEDBACK_CATS.map(c => c.key)
  async function loadFeedback() {
    let data: any[] = []
    if (MOCK_MENTOR_SUBTOPIC) data = mockListRatings([...mentorIds] as string[]).filter((r: any) => FB_KEYS.includes(r.category))
    else { const r = await supabase.from('mentor_rating').select('mentor_id, category, score, scope_id, rated_on').in('category', FB_KEYS); data = r.error ? [] : (r.data || []) }
    // latest value per deployment (completed training / return) — displayed per return and used to pre-fill the editor
    const byDep: any = {}
    data.filter((x: any) => x.scope_id && x.score != null).slice().sort((a: any, b: any) => String(a.rated_on || '').localeCompare(String(b.rated_on || ''))).forEach((x: any) => { (byDep[x.scope_id] = byDep[x.scope_id] || {})[x.category] = Number(x.score) })
    setFeedbackByDep(byDep)
  }
  useEffect(() => { load(); loadFeedback() }, [])
  function openEdit(d: any) {
    setEditId(d.id)
    setForm({ mentor_id: d.mentor_id, subject: d.subject || '', deployment_type: d.deployment_type, from_date: d.from_date ? dayjs(d.from_date) : null, to_date: d.to_date ? dayjs(d.to_date) : null, details: d.details || '' })
    setAdd({ mentor_id: d.mentor_id, name: nameById[d.mentor_id] })
  }
  async function submitAdd() {
    const mid = add?.mentor_id || form.mentor_id
    if (!mid) { msg.warning('Pick a mentor.'); return }
    if (!form.deployment_type) { msg.warning('Pick a deployment type.'); return }
    const fields: any = { mentor_id: mid, subject: form.subject || null, deployment_type: form.deployment_type, from_date: form.from_date ? form.from_date.format('YYYY-MM-DD') : null, to_date: form.to_date ? form.to_date.format('YYYY-MM-DD') : null, details: form.details || null }
    if (editId) { // edit an existing deployment's details (does NOT change its approval status)
      if (MOCK_MENTOR_SUBTOPIC) mockUpdateDeployment(editId, fields)
      else { const u = await supabase.from('mentor_deployment').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', editId); if (u.error) { msg.error(u.error.message); return } }
      msg.success('Deployment updated ✓')
    } else {
      const rec = { ...fields, status: 'pending', requested_by: person?.id || null, approved_by: null }
      if (MOCK_MENTOR_SUBTOPIC) mockAddDeployment(rec as any)
      else { const ins = await supabase.from('mentor_deployment').insert(rec); if (ins.error) { msg.error(/mentor_deployment|relation|does not exist/.test(ins.error.message) ? 'Run RecTrack_v30.sql first.' : ins.error.message); return } }
      msg.success(form.deployment_type === 'Online training' ? 'Deployment requested — expand the row to add its batches' : 'Deployment requested — pending Manager approval')
    }
    setAdd(null); setEditId(null); setForm({}); load()
  }
  async function submitFeedback() {
    if (!fbDep) { msg.warning('Pick which deployment (return) this feedback is for.'); return }
    const rows = FEEDBACK_CATS.filter(c => fbScores[c.key] != null).map(c => ({ mentor_id: fb.mentor_id, rated_by: person?.id || null, rated_on: dayjs().format('YYYY-MM-DD'), scope_level: 'deployment', scope_id: fbDep, category: c.key, score: fbScores[c.key], weight_snapshot: 1, remarks: null }))
    if (!rows.length) { msg.warning('Set at least one feedback score.'); return }
    if (MOCK_MENTOR_SUBTOPIC) mockSaveRatings(rows as any)
    else { const ins = await supabase.from('mentor_rating').insert(rows); if (ins.error) { msg.error(/mentor_rating/.test(ins.error.message) ? 'Run RecTrack_v20.sql first to enable ratings.' : ins.error.message); return } }
    msg.success('Feedback saved for this return ✓'); setFb(null); setFbDep(null); setFbScores({}); loadFeedback()
  }
  async function decide(d: any, status: string) {
    if (!isManager) { msg.warning('Only a Manager can approve/reject a deployment.'); return }
    if (MOCK_MENTOR_SUBTOPIC) mockUpdateDeployment(d.id, { status, approved_by: person?.id || null })
    else { const u = await supabase.from('mentor_deployment').update({ status, approved_by: person?.id || null, updated_at: new Date().toISOString() }).eq('id', d.id); if (u.error) { msg.error(u.error.message); return } }
    msg.success(status === 'approved' ? 'Deployment approved ✓' : 'Deployment rejected'); load()
  }
  // ---- online batches (v35): a deployment can hold many (same day, different codes / slots) ----
  function openBatch(dep: any, batch?: any) {
    setBModal({ dep, batch })
    setBForm(batch
      ? { subject: batch.subject || '', batch_code: batch.batch_code || '', time_slot: batch.time_slot || '', start_date: batch.start_date ? dayjs(batch.start_date) : null, end_date: batch.end_date ? dayjs(batch.end_date) : null, remarks: batch.remarks || '' }
      : { subject: dep.subject || '', batch_code: '', time_slot: '', start_date: dep.from_date ? dayjs(dep.from_date) : null, end_date: dep.to_date ? dayjs(dep.to_date) : null, remarks: '' })
  }
  async function saveBatch() {
    const dep = bModal.dep
    if (!bForm.batch_code?.trim()) { msg.warning('Batch code is required.'); return }
    if (!bForm.time_slot?.trim()) { msg.warning('Time slot is required.'); return }
    const rec: any = { deployment_id: dep.id, mentor_id: dep.mentor_id, subject: bForm.subject?.trim() || null, batch_code: bForm.batch_code.trim(), time_slot: bForm.time_slot.trim(), start_date: bForm.start_date ? bForm.start_date.format('YYYY-MM-DD') : null, end_date: bForm.end_date ? bForm.end_date.format('YYYY-MM-DD') : null, remarks: bForm.remarks?.trim() || null }
    if (MOCK_MENTOR_SUBTOPIC) { bModal.batch ? mockUpdateOnlineBatch(bModal.batch.id, rec) : mockAddOnlineBatch(rec) }
    else {
      const w = bModal.batch
        ? await supabase.from('mentor_online_batch').update({ ...rec, updated_at: new Date().toISOString() }).eq('id', bModal.batch.id)
        : await supabase.from('mentor_online_batch').insert(rec)
      if (w.error) { msg.error(/mentor_online_batch|relation|does not exist/.test(w.error.message) ? 'Run RecTrack_v35.sql first to enable online batches.' : w.error.message); return }
    }
    msg.success(bModal.batch ? 'Batch updated ✓' : 'Batch added ✓'); setBModal(null); setBForm({}); load()
  }
  async function deleteBatch(b: any) {
    if (MOCK_MENTOR_SUBTOPIC) mockDeleteOnlineBatch(b.id)
    else { const w = await supabase.from('mentor_online_batch').delete().eq('id', b.id); if (w.error) { msg.error(w.error.message); return } }
    msg.success('Batch removed'); load()
  }
  async function endDeployment(d: any) {
    if (MOCK_MENTOR_SUBTOPIC) mockUpdateDeployment(d.id, { status: 'completed' })
    else { const u = await supabase.from('mentor_deployment').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', d.id); if (u.error) { msg.error(u.error.message); return } }
    msg.success('Deployment ended — mentor is back to bench'); load()
  }
  if (!deps) return <div style={{ display: 'grid', placeItems: 'center', height: 200 }}><Spin /></div>
  const myDeps = deps.filter((d: any) => mentorIds.has(d.mentor_id))
  const activeDeployed = new Set(myDeps.filter((d: any) => d.status === 'approved').map((d: any) => d.mentor_id))
  const ql = q.trim().toLowerCase()
  const daysOf = (d: any) => (d.from_date && d.to_date) ? dayjs(d.to_date).diff(dayjs(d.from_date), 'day') + 1 : '—'
  const lbl: any = { fontSize: 12, fontWeight: 600, color: '#69707d', margin: '10px 0 4px' }
  const addModal = add && <Modal open title={editId ? `Edit deployment · ${add.name || ''}` : add.name ? `Deploy ${add.name}` : 'New deployment'} okText={editId ? 'Save changes' : 'Request (needs Manager approval)'} onOk={submitAdd} onCancel={() => { setAdd(null); setEditId(null); setForm({}) }} destroyOnClose>
    {!add.mentor_id && <><div style={lbl}>Mentor</div><Select showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="Select a mentor" value={form.mentor_id} onChange={(v) => setForm((f: any) => ({ ...f, mentor_id: v, subject: subjectOf[v] || f.subject }))} options={mentors.map((m: any) => ({ value: m.id, label: m.full_name }))} /></>}
    <div style={lbl}>Subject</div>
    <Input placeholder="Subject (e.g. Java, Python, Testing)" value={form.subject || ''} onChange={(e) => setForm((f: any) => ({ ...f, subject: e.target.value }))} />
    <div style={lbl}>Deployed to</div>
    <Select style={{ width: '100%' }} placeholder="Branch / Online training / College / Corporate training" value={form.deployment_type} onChange={(v) => setForm((f: any) => ({ ...f, deployment_type: v }))} options={DEPLOY_TYPES.map(t => ({ value: t, label: t }))} />
    <Row gutter={8}><Col span={12}><div style={lbl}>From date</div><DatePicker style={{ width: '100%' }} value={form.from_date} onChange={(v) => setForm((f: any) => ({ ...f, from_date: v }))} /></Col><Col span={12}><div style={lbl}>To date</div><DatePicker style={{ width: '100%' }} value={form.to_date} onChange={(v) => setForm((f: any) => ({ ...f, to_date: v }))} /></Col></Row>
    <div style={lbl}>Details</div>
    <Input.TextArea rows={3} placeholder="Deployment details (entered for the mentor)…" value={form.details || ''} onChange={(e) => setForm((f: any) => ({ ...f, details: e.target.value }))} />
    {form.deployment_type === 'Online training' && <div style={{ marginTop: 14, padding: '10px 12px', background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 10, fontSize: 12, color: '#69707d' }}>
      <b>Online batches</b> are added per deployment — save this, then <b>expand the row</b> on the Deployed tab to add one or more batches (a mentor can run several batches on the same date with different codes / time slots).
    </div>}
    {!editId && <div style={{ fontSize: 11, color: '#9aa1ad', marginTop: 8 }}>This creates a request. A Manager must approve it before the mentor is marked deployed.</div>}
  </Modal>
  const mDeps = fb ? (deps || []).filter((d: any) => d.mentor_id === fb.mentor_id && (d.status === 'approved' || d.status === 'completed')) : []
  const depLabel = (d: any) => `${d.deployment_type}${d.subject ? ' · ' + d.subject : ''}${d.from_date ? ' · ' + dayjs(d.from_date).format('DD MMM') : ''}${d.to_date ? '–' + dayjs(d.to_date).format('DD MMM') : ''}`
  const feedbackModal = fb && <Modal open title={`Feedback · ${fb.name}`} okText="Save feedback" okButtonProps={{ disabled: !fbDep }} onOk={submitFeedback} onCancel={() => { setFb(null); setFbDep(null); setFbScores({}) }} destroyOnClose>
    {mDeps.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Deploy this mentor first — feedback is captured per return (college / branch / online)." />
      : <>
        <div style={lbl}>Return (college / branch / online)</div>
        <Select style={{ width: '100%' }} placeholder="Which return is this feedback for?" value={fbDep} onChange={(v) => { setFbDep(v); setFbScores({ ...(feedbackByDep[v] || {}) }) }} options={mDeps.map((d: any) => ({ value: d.id, label: depLabel(d) }))} />
        <div style={{ fontSize: 12, color: '#9aa1ad', margin: '10px 0' }}>Rate this return's feedback (0–5). Each return keeps its own feedback.</div>
        {FEEDBACK_CATS.map(c => <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ flex: 1, fontSize: 13, color: '#69707d' }}>{c.label}</span>
          <Slider min={0} max={5} step={0.5} disabled={!fbDep} value={fbScores[c.key] ?? 0} onChange={(v: number) => setFbScores((s: any) => ({ ...s, [c.key]: v }))} style={{ width: 160 }} />
          <span style={{ width: 30, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{(fbScores[c.key] ?? 0).toFixed(1)}</span>
        </div>)}
      </>}
  </Modal>

  const batchModal = bModal && <Modal open title={`${bModal.batch ? 'Edit' : 'Add'} online batch · ${nameById[bModal.dep.mentor_id] || ''}`} okText={bModal.batch ? 'Save batch' : 'Add batch'} onOk={saveBatch} onCancel={() => { setBModal(null); setBForm({}) }} destroyOnClose>
    <div style={{ fontSize: 12, color: '#9aa1ad', marginBottom: 4 }}>Name and Employee ID come from the mentor · {empById[bModal.dep.mentor_id] || 'no employee ID'}</div>
    <Row gutter={8}>
      <Col span={12}><div style={lbl}>Subject</div><Input placeholder="e.g. Python" value={bForm.subject || ''} onChange={(e) => setBForm((f: any) => ({ ...f, subject: e.target.value }))} /></Col>
      <Col span={12}><div style={lbl}>Batch code</div><Input placeholder="e.g. PY-ON-2026-04" value={bForm.batch_code || ''} onChange={(e) => setBForm((f: any) => ({ ...f, batch_code: e.target.value }))} /></Col>
    </Row>
    <div style={lbl}>Time slot</div>
    <Input placeholder="e.g. 7:00–9:00 AM" value={bForm.time_slot || ''} onChange={(e) => setBForm((f: any) => ({ ...f, time_slot: e.target.value }))} />
    <Row gutter={8}>
      <Col span={12}><div style={lbl}>Start date</div><DatePicker style={{ width: '100%' }} value={bForm.start_date} onChange={(v) => setBForm((f: any) => ({ ...f, start_date: v }))} /></Col>
      <Col span={12}><div style={lbl}>End date</div><DatePicker style={{ width: '100%' }} value={bForm.end_date} onChange={(v) => setBForm((f: any) => ({ ...f, end_date: v }))} /></Col>
    </Row>
    <div style={lbl}>Remarks</div>
    <Input.TextArea rows={2} placeholder="Remarks for this batch…" value={bForm.remarks || ''} onChange={(e) => setBForm((f: any) => ({ ...f, remarks: e.target.value }))} />
  </Modal>

  if (mode === 'bench') {
    // Back to bench = has COMPLETED any training (Branch / Online / College / Corporate / College grooming)
    // and is not currently on an active deployment → available to be mapped again or upskilled.
    const returned = new Set(myDeps.filter((d: any) => d.status === 'completed').map((d: any) => d.mentor_id))
    const bench = mentors.filter((m: any) => !activeDeployed.has(m.id) && returned.has(m.id))
    // A bench mentor's rating = mean of the deployment-feedback scores (student / external coordinator /
    // reporting lead). Each deployment carries a SUBJECT, so ratings are shown PER SUBJECT: one row per
    // subject × a 5→1 band per column. The same mentor can sit in different bands for different subjects.
    const SUBJ_NONE = '— no subject —'
    const subjOfDep = (d: any) => d.subject || SUBJ_NONE
    const benchIds = new Set(bench.map((m: any) => m.id))
    const benchDeps = (deps || []).filter((d: any) => benchIds.has(d.mentor_id) && (d.status === 'approved' || d.status === 'completed'))
    const depsOfSubj = (mid: string, subj: string) => benchDeps.filter((d: any) => d.mentor_id === mid && subjOfDep(d) === subj)
    const avgOfVals = (vals: number[]) => vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    const scoresOf = (ds: any[]) => { const v: number[] = []; ds.forEach((d: any) => { const f = feedbackByDep[d.id]; if (f) FB_KEYS.forEach((k) => { if (f[k] != null) v.push(Number(f[k])) }) }); return v }
    const fbAvgOf = (mid: string, subj?: string) => avgOfVals(scoresOf(subj ? depsOfSubj(mid, subj) : benchDeps.filter((d: any) => d.mentor_id === mid)))
    const bandOf = (avg: number | null) => avg == null ? 'none' : String(Math.max(1, Math.min(5, Math.round(avg))))
    const BANDS = ['5', '4', '3', '2', '1', 'none']
    const BAND_COLOR: Record<string, string> = { '5': '#16a34a', '4': '#65a30d', '3': '#d97706', '2': '#ea580c', '1': '#dc2626', none: '#9aa1ad' }
    const bandLabel = (b: string) => b === 'none' ? 'Not rated' : `${b} ★`
    // subject → band → mentors (with that subject's average)
    const subjList = [...new Set(benchDeps.map(subjOfDep))].sort() as string[]
    const matrix = subjList.map((subj) => {
      const bands: Record<string, any[]> = { '5': [], '4': [], '3': [], '2': [], '1': [], none: [] }
      bench.filter((m: any) => depsOfSubj(m.id, subj).length > 0).forEach((m: any) => {
        const avg = fbAvgOf(m.id, subj); bands[bandOf(avg)].push({ ...m, _avg: avg })
      })
      const total = BANDS.reduce((s, b) => s + bands[b].length, 0)
      return { subject: subj, bands, total }
    }).sort((a, b) => b.total - a.total)
    const cellFor = (subj: string, band: string) => (matrix.find((r) => r.subject === subj)?.bands[band]) || []
    const ratingCards = <Card size="small" title="Mentor ratings by subject" style={{ marginBottom: 16 }} extra={<span style={{ fontSize: 11, color: '#9aa1ad' }}>Deployment feedback per subject · tap a number for the names</span>}>
      {matrix.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No completed trainings yet — ratings appear once mentors return and are given feedback." />
        : <Table size="small" rowKey="subject" pagination={false} scroll={{ x: 'max-content' }} dataSource={matrix} columns={[
          { title: 'Subject', dataIndex: 'subject', render: (v: string) => <b>{v}</b> },
          { title: 'Mentors', width: 90, render: (_: any, r: any) => <Tag color="geekblue">{r.total}</Tag> },
          ...BANDS.map((b) => ({
            title: <span style={{ color: BAND_COLOR[b], fontWeight: 700 }}>{bandLabel(b)}</span>, width: 92, align: 'center' as const,
            render: (_: any, r: any) => { const n = r.bands[b].length; return n === 0 ? <span style={{ color: '#d9dde3' }}>0</span>
              : <span onClick={() => setRCell({ subject: r.subject, band: b })} style={{ cursor: 'pointer', display: 'inline-block', minWidth: 30, padding: '2px 8px', borderRadius: 6, fontWeight: 800, color: '#fff', background: BAND_COLOR[b] }}>{n}</span> },
          })),
        ] as any} />}
    </Card>
    const ratingModal = rCell && (() => {
      const list = cellFor(rCell.subject, rCell.band).slice().sort((a: any, b: any) => (b._avg ?? -1) - (a._avg ?? -1))
      return <Modal open title={<span><Tag color="geekblue">{rCell.subject}</Tag><Tag style={{ background: BAND_COLOR[rCell.band], color: '#fff', border: 'none' }}>{bandLabel(rCell.band)}</Tag> {list.length} mentor{list.length === 1 ? '' : 's'}</span>} footer={null} width={560} onCancel={() => setRCell(null)}>
        {list.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No mentors here" />
          : list.map((m: any) => <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f0f0f0' }}>
            <span><b>{m.full_name}</b>{m.employee_id ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9aa1ad', marginLeft: 8 }}>{m.employee_id}</span> : null}</span>
            {m._avg != null ? <Tag color={m._avg >= 4 ? 'green' : m._avg >= 3 ? 'orange' : 'red'}>{m._avg.toFixed(2)} / 5</Tag> : <span style={{ fontSize: 12, color: '#9aa1ad' }}>no feedback yet</span>}
          </div>)}
      </Modal>
    })()
    const benchShown = ql ? bench.filter((m: any) => String(m.full_name || '').toLowerCase().includes(ql)) : bench
    const cols = [
      { title: 'Mentor', dataIndex: 'full_name', render: (v: string) => <b>{v}</b> },
      { title: 'Subject', render: (_: any, m: any) => subjectOf[m.id] ? <Tag color="geekblue">{subjectOf[m.id]}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
      { title: 'Rating · all subjects', width: 150, render: (_: any, m: any) => { const a = fbAvgOf(m.id); return a != null ? <Tag color={a >= 4 ? 'green' : a >= 3 ? 'orange' : 'red'}>{a.toFixed(2)} / 5</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> } },
      { title: 'Status', render: (_: any, m: any) => returned.has(m.id) ? <Tag color="blue">Returned from deployment</Tag> : <Tag>Available</Tag> },
      { title: 'Feedback (per completed training)', render: (_: any, m: any) => {
        const mDeps = (deps || []).filter((d: any) => d.mentor_id === m.id && (d.status === 'approved' || d.status === 'completed') && feedbackByDep[d.id])
        if (!mDeps.length) return <span style={{ color: '#9aa1ad' }}>—</span>
        return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{mDeps.map((d: any) => <div key={d.id}>
          <div style={{ fontSize: 11, color: '#69707d' }}>{d.deployment_type}{d.subject ? ' · ' + d.subject : ''}</div>
          <span style={{ display: 'flex', gap: 4, marginTop: 2 }}>{FEEDBACK_CATS.map(c => { const v = feedbackByDep[d.id]?.[c.key]; return <ATooltip key={c.key} title={c.label}><Tag style={{ margin: 0 }} color={v == null ? 'default' : v >= 4 ? 'green' : v >= 3 ? 'orange' : 'red'}>{v != null ? v.toFixed(1) : '—'}</Tag></ATooltip> })}</span>
        </div>)}</div>
      } },
      { title: '', width: 250, render: (_: any, m: any) => <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button size="small" icon={<StarOutlined />} onClick={() => { setFbScores({}); setFbDep(null); setFb({ mentor_id: m.id, name: m.full_name }) }}>Feedback</Button>
        <Button size="small" type="primary" onClick={() => { setForm({ subject: subjectOf[m.id] || '' }); setAdd({ mentor_id: m.id, name: m.full_name }) }}>Map / Deploy</Button>
      </span> },
    ]
    return <><div style={{ fontSize: 12, color: '#69707d', marginBottom: 10 }}>Mentors who have <b>completed a training</b> (Branch / Online / College / Corporate / College grooming) and are not on an active deployment — available to be mapped to another requirement or upskilled. Rating = average of their deployment feedback across all returns.</div>
      {ratingCards}
      <Input allowClear prefix={<SearchOutlined style={{ color: '#9aa1ad' }} />} placeholder="Search mentor…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 280, marginBottom: 12 }} />
      <Table size="middle" rowKey="id" columns={cols as any} dataSource={benchShown} pagination={{ pageSize: 12 }} scroll={{ x: 'max-content' }} locale={{ emptyText: <Empty description={ql ? `No mentors match “${q}”` : 'No mentors back on the bench yet — nobody has completed a training and returned.'} /> }} />
      {addModal}{feedbackModal}{ratingModal}</>
  }
  const cols = [
    { title: 'Mentor', dataIndex: 'mentor_id', render: (v: string) => <b>{nameById[v] || '—'}</b> },
    { title: 'Subject', dataIndex: 'subject', render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Deployed to', dataIndex: 'deployment_type', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'From', dataIndex: 'from_date', render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'To', dataIndex: 'to_date', render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Days', width: 70, render: (_: any, d: any) => daysOf(d) },
    { title: 'Details', dataIndex: 'details', render: (v: string) => v || <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Status', dataIndex: 'status', width: 150, render: (v: string) => v === 'approved' ? <Tag color="green">Deployed</Tag> : v === 'pending' ? <Tag color="orange">Pending approval</Tag> : v === 'rejected' ? <Tag color="red">Rejected</Tag> : <Tag>Completed</Tag> },
    { title: '', width: 280, render: (_: any, d: any) => <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
      <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(d)} title="Edit deployment details">Edit</Button>
      {d.status === 'pending' && isManager && <><Button size="small" type="primary" onClick={() => decide(d, 'approved')}>Approve</Button><Button size="small" danger onClick={() => decide(d, 'rejected')}>Reject</Button></>}
      {d.status === 'pending' && !isManager && <span style={{ fontSize: 12, color: '#d97706' }}>Awaiting Manager</span>}
      {d.status === 'approved' && <Button size="small" onClick={() => endDeployment(d)}>End</Button>}
    </span> },
  ]
  const depShown = ql ? myDeps.filter((d: any) => [nameById[d.mentor_id], d.deployment_type, d.details, d.status].some((x: any) => String(x || '').toLowerCase().includes(ql))) : myDeps
  // how many DISTINCT mentors are currently deployed (approved) under each deployment type.
  // A mentor with two approved deployments of the same type counts once; across types they count in each.
  const byType: Record<string, Set<string>> = {}
  DEPLOY_TYPES.forEach((t) => { byType[t] = new Set() })
  myDeps.filter((d: any) => d.status === 'approved').forEach((d: any) => { if (byType[d.deployment_type]) byType[d.deployment_type].add(d.mentor_id) })
  // total = DISTINCT mentors currently deployed. Deliberately not the sum of the per-type cards —
  // a mentor deployed under two types appears in both cards but must count once here.
  const totalDeployed = activeDeployed.size
  const typeCards = <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
    <Col xs={12} md={8} lg={4}>
      <Card hoverable onClick={() => setQ('')} styles={{ body: { padding: 14 } }} style={{ background: '#f7f8fb', borderColor: q === '' ? PRIMARY : undefined }}>
        <Statistic title={<span style={{ fontSize: 12, fontWeight: 700 }}>Total deployed<span style={{ fontSize: 10, color: '#9aa1ad', fontWeight: 400 }}> · all types</span></span>} value={totalDeployed} suffix={<span style={{ fontSize: 11, color: '#9aa1ad' }}>mentor{totalDeployed === 1 ? '' : 's'}</span>} valueStyle={{ color: PRIMARY, fontWeight: 800, fontSize: 22 }} />
      </Card>
    </Col>
    {DEPLOY_TYPES.map((t) => <Col xs={12} md={8} lg={4} key={t}>
      <Card hoverable onClick={() => setQ(q === t ? '' : t)} styles={{ body: { padding: 14 } }} style={q === t ? { borderColor: DEPLOY_TYPE_COLOR[t], boxShadow: `0 0 0 1px ${DEPLOY_TYPE_COLOR[t]}` } : undefined}>
        <Statistic title={<span style={{ fontSize: 12 }}>{t}<span style={{ fontSize: 10, color: '#9aa1ad' }}> · tap to filter</span></span>} value={byType[t].size} suffix={<span style={{ fontSize: 11, color: '#9aa1ad' }}>mentor{byType[t].size === 1 ? '' : 's'}</span>} valueStyle={{ color: DEPLOY_TYPE_COLOR[t], fontWeight: 800, fontSize: 22 }} />
      </Card>
    </Col>)}
  </Row>
  return <>{typeCards}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: '#69707d' }}>Counts show mentors <b>currently deployed</b> (Manager-approved) per type. Deployments need a Manager's prior approval before they go active.</div>
      <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => { setForm({}); setAdd({ mentor_id: null }) }}>New deployment</Button>
    </div>
    <Input allowClear prefix={<SearchOutlined style={{ color: '#9aa1ad' }} />} placeholder="Search by mentor, type, details or status…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 340, marginBottom: 12 }} />
    <Table size="middle" rowKey="id" columns={cols as any} dataSource={depShown} pagination={{ pageSize: 12 }}
      expandable={{
        rowExpandable: (d: any) => d.deployment_type === 'Online training',
        expandedRowRender: (d: any) => {
          const list = batchesByDep[d.id] || []
          return <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#69707d' }}>Online batches for <b>{nameById[d.mentor_id] || '—'}</b> — {list.length} batch{list.length === 1 ? '' : 'es'}. The same mentor can run several batches on the same date with different codes / time slots.</span>
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openBatch(d)}>Add batch</Button>
            </div>
            {list.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No batches yet — click “Add batch”." />
              : <Table size="small" rowKey="id" pagination={false} dataSource={list} scroll={{ x: 'max-content' }} columns={[
                { title: 'Name', render: () => <b>{nameById[d.mentor_id] || '—'}</b> },
                { title: 'Employee ID', render: () => empById[d.mentor_id] ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{empById[d.mentor_id]}</span> : <span style={{ color: '#9aa1ad' }}>—</span> },
                { title: 'Subject', render: (_: any, x: any) => x.subject || <span style={{ color: '#9aa1ad' }}>—</span> },
                { title: 'Batch code', render: (_: any, x: any) => x.batch_code ? <Tag color="geekblue">{x.batch_code}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
                { title: 'Time slot', render: (_: any, x: any) => x.time_slot ? <Tag color="purple">{x.time_slot}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
                { title: 'Start date', render: (_: any, x: any) => x.start_date ? dayjs(x.start_date).format('DD MMM YYYY') : <span style={{ color: '#9aa1ad' }}>—</span> },
                { title: 'End date', render: (_: any, x: any) => x.end_date ? dayjs(x.end_date).format('DD MMM YYYY') : <span style={{ color: '#9aa1ad' }}>—</span> },
                { title: 'Remarks', render: (_: any, x: any) => x.remarks || <span style={{ color: '#9aa1ad' }}>—</span> },
                { title: '', width: 130, render: (_: any, x: any) => <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openBatch(d, x)} />
                  <Popconfirm title="Remove this batch?" okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => deleteBatch(x)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
                </span> },
              ] as any} />}
          </div>
        },
      }}
      locale={{ emptyText: <Empty description={ql ? `No deployments match “${q}”` : 'No deployments yet — deploy a mentor from the “Back to bench” tab or add one here.'} /> }} />
    {addModal}{feedbackModal}{batchModal}</>
}

// v34: derive a mentor's live "bucket". Deployed / bench come from mentor_deployment;
// the rest (in_training / ready_to_deploy / upskilling / terminated / dropout) from person.mentor_status.
function mentorBucket(m: any, activeDeployed: Set<string>, returned: Set<string>): string {
  if (activeDeployed.has(m.id)) return 'deployed'
  const st = m.mentor_status || 'in_training'
  if (MENTOR_EXITED.has(st)) return st
  if (returned.has(m.id)) return 'bench'
  return st
}
const BUCKET_META: Record<string, { label: string; color: string }> = {
  in_training: { label: 'Under training', color: '#d97706' },
  ready_to_deploy: { label: 'Ready to deploy', color: '#16a34a' },
  upskilling: { label: 'Upskilling', color: '#7c3aed' },
  deployed: { label: 'Deployed', color: '#2563eb' },
  bench: { label: 'Back to bench', color: '#0891b2' },
  terminated: { label: 'Terminated', color: '#dc2626' },
  dropout: { label: 'Dropout', color: '#b91c1c' },
}

// Pipeline & subject-wise metrics + training-lifecycle controls (Ready to deploy / Upskill / Terminate / Dropout / Reinstate).
function MentorPipeline({ mentors, mentorSubjects, deps, onChanged }: any) {
  const { person } = useAuth()
  const { message: msg } = AntApp.useApp()
  const canManage = person?.role === 'admin' || OWNER_ROLES.includes(person?.role)
  const [q, setQ] = useState('')
  const [act, setAct] = useState<any>(null) // { mentor, status } while the reason modal is open
  const [reason, setReason] = useState('')
  const [openBucket, setOpenBucket] = useState<string | null>(null) // KPI drill-down: names + subjects in a stage
  const activeDeployed = new Set((deps || []).filter((d: any) => d.status === 'approved').map((d: any) => d.mentor_id))
  const returned = new Set((deps || []).filter((d: any) => d.status === 'completed').map((d: any) => d.mentor_id))
  const subjectsOf = (m: any): string[] => { const s = mentorSubjects[m.id]; return s && s.size ? [...s] : [] }
  const bucketOf = (m: any) => mentorBucket(m, activeDeployed as Set<string>, returned as Set<string>)

  async function apply(mentorId: string, status: string, why: string | null) {
    if (MOCK_MENTOR_SUBTOPIC) { mockSetMentorStatus(mentorId, status, why); msg.success(`Status updated → ${LIFECYCLE_LABEL[status] || status} (mock)`); setAct(null); setReason(''); onChanged && onChanged(); return }
    // .select() so we can tell an RLS-blocked / migration-missing no-op apart from a real save
    const u = await supabase.from('person').update({ mentor_status: status, mentor_status_reason: why, mentor_status_at: new Date().toISOString(), mentor_status_by: person?.id || null }).eq('id', mentorId).select('id')
    if (u.error) { msg.error(/mentor_status|column|does not exist/.test(u.error.message) ? 'Run RecTrack_v34.sql first (adds person.mentor_status).' : u.error.message); return }
    if (!u.data || !u.data.length) { msg.error("Status didn't save — no row updated. Run RecTrack_v34.sql, and make sure you're signed in as a Program Head / Manager / Team Lead (RLS)."); return }
    await supabase.from('mentor_status_history').insert({ mentor_id: mentorId, status, reason: why, changed_by: person?.id || null })
    msg.success(`Status updated → ${LIFECYCLE_LABEL[status] || status}`)
    setAct(null); setReason(''); onChanged && onChanged()
  }
  function changeStatus(m: any, status: string) {
    if (!canManage) { msg.warning('Only a Lead / Manager / Program Head can change mentor status.'); return }
    if (status === 'terminated' || status === 'dropout') { setReason(''); setAct({ mentor: m, status }) } // needs a documented reason
    else apply(m.id, status, null)
  }

  // ---- counts per bucket ----
  const counts: Record<string, number> = { in_training: 0, ready_to_deploy: 0, upskilling: 0, deployed: 0, bench: 0, terminated: 0, dropout: 0 }
  mentors.forEach((m: any) => { counts[bucketOf(m)] = (counts[bucketOf(m)] || 0) + 1 })

  // ---- subject-wise: subject -> mentors holding it (a mentor can appear under several subjects) ----
  const bySubject: Record<string, any[]> = {}
  mentors.forEach((m: any) => { const ss = subjectsOf(m); (ss.length ? ss : ['— unassigned —']).forEach((s) => { (bySubject[s] = bySubject[s] || []).push(m) }) })
  const subjectRows = Object.keys(bySubject).sort().map((s) => ({ subject: s, mentors: bySubject[s] }))

  const ql = q.trim().toLowerCase()
  const shown = ql ? mentors.filter((m: any) => String(m.full_name || '').toLowerCase().includes(ql) || subjectsOf(m).some((s) => s.toLowerCase().includes(ql))) : mentors

  const kpiCard = (key: string) => <Col xs={12} md={8} lg={6} key={key}>
    <Card hoverable onClick={() => setOpenBucket(key)} styles={{ body: { padding: 14 } }} title={undefined}><Statistic title={<span>{BUCKET_META[key].label} <span style={{ fontSize: 11, color: '#9aa1ad' }}>· tap for names</span></span>} value={counts[key] || 0} valueStyle={{ color: BUCKET_META[key].color, fontWeight: 800 }} /></Card>
  </Col>

  const tagColor = (b: string) => LIFECYCLE_COLOR[b] || (b === 'deployed' ? 'blue' : b === 'bench' ? 'cyan' : 'default')
  // Subject → mentors tree: each subject expands to the mentors mapped to it with their current stage
  const subjectTree = subjectRows.map((r: any) => {
    const under = r.mentors.filter((m: any) => ['in_training', 'upskilling'].includes(bucketOf(m))).length
    const dep = r.mentors.filter((m: any) => bucketOf(m) === 'deployed').length
    const bench = r.mentors.filter((m: any) => bucketOf(m) === 'bench').length
    return {
      key: 'subj_' + r.subject,
      title: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b>{r.subject}</b>
        <Tag color="geekblue" style={{ margin: 0 }}>{r.mentors.length} mentor{r.mentors.length === 1 ? '' : 's'}</Tag>
        {under > 0 && <Tag color="orange" style={{ margin: 0 }}>Under training {under}</Tag>}
        {dep > 0 && <Tag color="blue" style={{ margin: 0 }}>Deployed {dep}</Tag>}
        {bench > 0 && <Tag color="cyan" style={{ margin: 0 }}>Back to bench {bench}</Tag>}
      </span>,
      children: r.mentors.slice().sort((a: any, b: any) => String(a.full_name).localeCompare(String(b.full_name))).map((m: any) => {
        const b = bucketOf(m)
        return {
          key: 'subj_' + r.subject + '_' + m.id, isLeaf: true,
          title: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{m.full_name}</span>
            {m.employee_id ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9aa1ad' }}>{m.employee_id}</span> : null}
            <Tag color={tagColor(b)} style={{ margin: 0 }}>{BUCKET_META[b].label}</Tag>
            {MENTOR_EXITED.has(m.mentor_status) && m.mentor_status_reason ? <span style={{ fontSize: 11, color: '#9aa1ad' }}>· {m.mentor_status_reason}</span> : null}
          </span>,
        }
      }),
    }
  })

  const setOpts = [
    { value: 'in_training', label: 'Back to / under training' },
    { value: 'ready_to_deploy', label: 'Ready to deploy' },
    { value: 'upskilling', label: 'Upskilling' },
    { value: 'terminated', label: 'Terminate (performance)' },
    { value: 'dropout', label: 'Dropout (mid-training)' },
  ]
  const mgmtCols = [
    { title: 'Mentor', dataIndex: 'full_name', render: (v: string) => <b>{v}</b> },
    { title: 'Subjects / skills', render: (_: any, m: any) => { const ss = subjectsOf(m); return ss.length ? <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{ss.map((s) => <Tag key={s} color="geekblue" style={{ margin: 0 }}>{s}</Tag>)}</span> : <span style={{ color: '#9aa1ad' }}>—</span> } },
    { title: 'Stage', width: 150, render: (_: any, m: any) => { const b = bucketOf(m); return <Tag color={LIFECYCLE_COLOR[b] || (b === 'deployed' ? 'blue' : b === 'bench' ? 'cyan' : 'default')}>{BUCKET_META[b].label}</Tag> } },
    { title: 'Reason', render: (_: any, m: any) => m.mentor_status_reason && MENTOR_EXITED.has(m.mentor_status) ? <span style={{ fontSize: 12, color: '#69707d' }}>{m.mentor_status_reason}</span> : <span style={{ color: '#9aa1ad' }}>—</span> },
    ...(canManage ? [{ title: 'Set training status', width: 210, render: (_: any, m: any) => { const b = bucketOf(m); if (b === 'deployed') return <span style={{ fontSize: 12, color: '#9aa1ad' }}>Manage on “Deployed” tab</span>; return <Select size="small" style={{ width: 200 }} placeholder="Change…" value={undefined} options={setOpts.filter((o) => o.value !== m.mentor_status)} onChange={(v) => changeStatus(m, v)} /> } }] : []),
  ]

  return <div>
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      {['in_training', 'ready_to_deploy', 'deployed', 'bench', 'upskilling', 'terminated', 'dropout'].map(kpiCard)}
    </Row>
    <Card title="Subject / skill-wise mentors" size="small" style={{ marginBottom: 16 }} extra={<span style={{ fontSize: 11, color: '#9aa1ad' }}>Expand a subject to see its mentors and their current stage</span>}>
      {subjectTree.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No mentors mapped to subjects yet" />
        : <Tree treeData={subjectTree as any} showLine selectable={false} height={420} defaultExpandedKeys={subjectTree.length <= 3 ? subjectTree.map((n: any) => n.key) : []} />}
    </Card>
    <Card title="Mentor pipeline — training status" size="small" extra={<Input allowClear size="small" prefix={<SearchOutlined style={{ color: '#9aa1ad' }} />} placeholder="Search mentor / subject…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />}>
      <Table size="middle" rowKey="id" columns={mgmtCols as any} dataSource={shown} pagination={{ pageSize: 12 }} scroll={{ x: 'max-content' }} locale={{ emptyText: <Empty description={ql ? `No mentors match “${q}”` : 'No mentors yet'} /> }} />
    </Card>
    {openBucket && (() => {
      const list = mentors.filter((m: any) => bucketOf(m) === openBucket).slice().sort((a: any, b: any) => String(a.full_name).localeCompare(String(b.full_name)))
      return <Modal open title={<span><Tag color={BUCKET_META[openBucket].color === '#d97706' ? 'orange' : undefined} style={{ background: BUCKET_META[openBucket].color, color: '#fff', border: 'none' }}>{BUCKET_META[openBucket].label}</Tag> {list.length} mentor{list.length === 1 ? '' : 's'}</span>} footer={null} width={560} onCancel={() => setOpenBucket(null)}>
        {list.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No mentors in this stage" /> : list.map((m: any) => <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f0f0f0' }}>
          <b>{m.full_name}</b>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>{subjectsOf(m).length ? subjectsOf(m).map((s: string) => <Tag key={s} color="geekblue" style={{ margin: 0 }}>{s}</Tag>) : <span style={{ fontSize: 12, color: '#9aa1ad' }}>— no subject —</span>}</span>
        </div>)}
      </Modal>
    })()}
    {act && <Modal open title={<span style={{ color: '#dc2626' }}>{act.status === 'terminated' ? 'Terminate mentor (performance)' : 'Mark mentor as dropout'}</span>} okText={act.status === 'terminated' ? 'Terminate' : 'Mark dropout'} okButtonProps={{ danger: true, disabled: !reason.trim() }} onOk={() => apply(act.mentor.id, act.status, reason.trim())} onCancel={() => { setAct(null); setReason('') }} destroyOnClose>
      <div style={{ fontSize: 13, marginBottom: 10 }}>{act.status === 'terminated' ? 'Terminate' : 'Mark as dropout'} <b>{act.mentor.full_name}</b>. This is documented with your reason and kept in the mentor's status history (reversible — you can reinstate to training later).</div>
      <Input.TextArea rows={3} placeholder="Reason (documented)…" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>}
  </div>
}

// daily mentor attendance (v33) — mark every mentor Present / Absent / Half day / Leave for a chosen day
const ATT_STATUS = ['Present', 'Absent', 'Half day', 'Leave']
const attColor: any = { Present: 'green', Absent: 'red', 'Half day': 'orange', Leave: 'blue' }
function AttNote({ value, disabled, onSave }: any) {
  const [v, setV] = useState(value || '')
  useEffect(() => setV(value || ''), [value])
  return <Input size="small" placeholder="Note (optional)" value={v} disabled={disabled} style={{ width: 180 }} onChange={e => setV(e.target.value)} onBlur={() => { if ((value || '') !== v) onSave(v) } } />
}
function MentorAttendance({ mentors }: any) {
  const { person } = useAuth()
  const { message: msg } = AntApp.useApp()
  const isAdmin = person?.role === 'admin'
  const canEdit = isAdmin || OWNER_ROLES.includes(person?.role)
  const [date, setDate] = useState<any>(dayjs())
  const [att, setAtt] = useState<any>({})   // mentor_id -> { status, note }
  const [hols, setHols] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const dstr = date.format('YYYY-MM-DD')
  async function load() {
    setLoading(true)
    if (MOCK_MENTOR_SUBTOPIC) {
      const rows = mockListAttendance(dstr); const m: any = {}; rows.forEach((r: any) => m[r.mentor_id] = { status: r.status, note: r.note }); setAtt(m); setHols(mockListHolidays()); setLoading(false); return
    }
    const r = await supabase.from('mentor_attendance').select('mentor_id, status, note').eq('att_date', dstr)
    const m: any = {}; (r.data || []).forEach((x: any) => m[x.mentor_id] = { status: x.status, note: x.note }); setAtt(m)
    const h = await supabase.from('mentor_holiday').select('mentor_id, from_date, to_date'); setHols(h.error ? [] : (h.data || []))
    setLoading(false)
  }
  useEffect(() => { load() }, [dstr])
  async function setStatus(mentorId: string, status: string, note?: string) {
    const finalNote = note !== undefined ? note : (att[mentorId]?.note ?? '')
    setAtt((a: any) => ({ ...a, [mentorId]: { status, note: finalNote } })) // optimistic
    if (MOCK_MENTOR_SUBTOPIC) { mockSetAttendance(mentorId, dstr, status, finalNote || null); return }
    const rec = { mentor_id: mentorId, att_date: dstr, status, note: finalNote || null, marked_by: person?.id || null, updated_at: new Date().toISOString() }
    const u = await supabase.from('mentor_attendance').upsert(rec, { onConflict: 'mentor_id,att_date' })
    if (u.error) msg.error(/mentor_attendance|relation|does not exist/.test(u.error.message) ? 'Run RecTrack_v33_mentor_attendance.sql first.' : u.error.message)
  }
  const onHoliday = (mid: string) => hols.some((h: any) => h.mentor_id === mid && dstr >= h.from_date && dstr <= h.to_date)
  const ql = q.trim().toLowerCase()
  const shown = ql ? mentors.filter((m: any) => String(m.full_name || '').toLowerCase().includes(ql)) : mentors
  async function markAllPresent() { for (const m of shown) { if (!att[m.id]?.status) await setStatus(m.id, 'Present') } msg.success('Unmarked mentors set to Present ✓') }
  // export the FULL attendance register — every date marked to date, one column per day + per-status totals
  async function downloadReport() {
    let recs: any[] = MOCK_MENTOR_SUBTOPIC ? mockAllAttendance() : await selectAll('mentor_attendance', 'mentor_id, att_date, status, note')
    const ids = new Set(mentors.map((m: any) => m.id))
    recs = recs.filter((r: any) => ids.has(r.mentor_id))
    if (!recs.length) { msg.info('No attendance recorded yet.'); return }
    const dates = [...new Set(recs.map((r: any) => String(r.att_date).slice(0, 10)))].sort()
    const key = (mid: string, d: string) => mid + '|' + d
    const map: any = {}; recs.forEach((r: any) => { map[key(r.mentor_id, String(r.att_date).slice(0, 10))] = { status: r.status, note: r.note } })
    const rows = mentors.map((m: any) => {
      const row: any = { 'Employee ID': m.employee_id || '', 'Mentor': m.full_name || '' }
      const c: any = { Present: 0, Absent: 0, 'Half day': 0, Leave: 0 }
      const notes: string[] = []
      dates.forEach((d: string) => { const cell = map[key(m.id, d)]; const s = cell?.status || ''; row[d] = s; if (c[s] !== undefined) c[s]++; if (cell?.note) notes.push(`${d}: ${cell.note}`) })
      row['Present'] = c.Present; row['Absent'] = c.Absent; row['Half day'] = c['Half day']; row['Leave'] = c.Leave; row['Days marked'] = c.Present + c.Absent + c['Half day'] + c.Leave
      row['Notes'] = notes.join('; ')
      return row
    })
    const header = ['Employee ID', 'Mentor', ...dates, 'Present', 'Absent', 'Half day', 'Leave', 'Days marked', 'Notes']
    const ws = XLSX.utils.json_to_sheet(rows, { header })
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
    XLSX.writeFile(wb, `Attendance_register_${dates[0]}_to_${dates[dates.length - 1]}.xlsx`)
  }
  const counts: any = ATT_STATUS.reduce((o: any, s: string) => { o[s] = mentors.filter((m: any) => att[m.id]?.status === s).length; return o }, {})
  const notMarked = mentors.filter((m: any) => !att[m.id]?.status).length
  const cols = [
    { title: 'Employee ID', width: 130, render: (_: any, m: any) => m.employee_id ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.employee_id}</span> : <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Mentor', render: (_: any, m: any) => <span><Avatar size={24} style={{ background: '#c2410c', marginRight: 8, fontSize: 11 }}>{(m.full_name || '?')[0]}</Avatar>{m.full_name}{onHoliday(m.id) ? <Tag color="gold" style={{ marginLeft: 8 }}>On holiday</Tag> : null}</span> },
    { title: 'Attendance', width: 320, render: (_: any, m: any) => canEdit
      ? <Segmented size="small" value={att[m.id]?.status || ''} onChange={(v: any) => setStatus(m.id, v)} options={ATT_STATUS.map(s => ({ value: s, label: s }))} />
      : (att[m.id]?.status ? <Tag color={attColor[att[m.id].status]}>{att[m.id].status}</Tag> : <span style={{ color: '#9aa1ad' }}>Not marked</span>) },
    { title: 'Note', width: 200, render: (_: any, m: any) => canEdit
      ? <AttNote value={att[m.id]?.note} disabled={!att[m.id]?.status} onSave={(note: string) => setStatus(m.id, att[m.id]?.status || 'Present', note)} />
      : (att[m.id]?.note || <span style={{ color: '#9aa1ad' }}>—</span>) },
  ]
  return <div>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, color: '#69707d' }}>Attendance for</span>
      <DatePicker allowClear={false} value={date} onChange={(v: any) => v && setDate(v)} disabledDate={(d: any) => d && d.isAfter(dayjs(), 'day')} />
      {canEdit && <Button size="small" onClick={markAllPresent} disabled={!notMarked}>Mark all present ({notMarked})</Button>}
      <Button size="small" icon={<DownloadOutlined />} onClick={downloadReport} disabled={!mentors.length} title="Full attendance register — every day marked to date">Download report (till date)</Button>
      <span style={{ flex: 1 }} />
      {ATT_STATUS.map(s => <Tag key={s} color={attColor[s]}>{s}: {counts[s]}</Tag>)}
      <Tag>Not marked: {notMarked}</Tag>
    </div>
    <Input allowClear prefix={<SearchOutlined style={{ color: '#9aa1ad' }} />} placeholder="Search mentor…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 280, marginBottom: 12 }} />
    <Table size="middle" rowKey="id" loading={loading} columns={cols as any} dataSource={shown} pagination={{ pageSize: 15 }}
      locale={{ emptyText: <Empty description={ql ? `No mentors match “${q}”` : 'No mentors to mark.'} /> }} />
  </div>
}
// simple mentor holiday / leave tracking (v31)
function MentorHolidays({ mentors }: any) {
  const { person } = useAuth()
  const { message: msg } = AntApp.useApp()
  const [hols, setHols] = useState<any[] | null>(null)
  const [add, setAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null) // holiday being edited (null = adding)
  const [form, setForm] = useState<any>({})
  const [q, setQ] = useState('')
  const nameById: any = Object.fromEntries(mentors.map((m: any) => [m.id, m.full_name]))
  const mentorIds = new Set(mentors.map((m: any) => m.id))
  async function load() {
    if (MOCK_MENTOR_SUBTOPIC) { setHols(mockListHolidays()); return }
    const r = await supabase.from('mentor_holiday').select('*').order('from_date', { ascending: false })
    setHols(r.error ? [] : (r.data || []))
  }
  useEffect(() => { load() }, [])
  function openEdit(h: any) { setEditId(h.id); setForm({ mentor_id: h.mentor_id, from_date: h.from_date ? dayjs(h.from_date) : null, to_date: h.to_date ? dayjs(h.to_date) : null, reason: h.reason || '' }); setAdd(true) }
  async function submitAdd() {
    if (!form.mentor_id) { msg.warning('Pick a mentor.'); return }
    if (!form.from_date || !form.to_date) { msg.warning('Pick the from and to dates.'); return }
    const rec: any = { mentor_id: form.mentor_id, from_date: form.from_date.format('YYYY-MM-DD'), to_date: form.to_date.format('YYYY-MM-DD'), reason: form.reason || null }
    if (editId) {
      if (MOCK_MENTOR_SUBTOPIC) mockUpdateHoliday(editId, rec)
      else { const u = await supabase.from('mentor_holiday').update(rec).eq('id', editId); if (u.error) { msg.error(u.error.message); return } }
      msg.success('Holiday updated ✓')
    } else {
      const ins = { ...rec, logged_by: person?.id || null }
      if (MOCK_MENTOR_SUBTOPIC) mockAddHoliday(ins)
      else { const r = await supabase.from('mentor_holiday').insert(ins); if (r.error) { msg.error(/mentor_holiday|relation|does not exist/.test(r.error.message) ? 'Run RecTrack_v31.sql first.' : r.error.message); return } }
      msg.success('Holiday logged ✓')
    }
    setAdd(false); setEditId(null); setForm({}); load()
  }
  async function del(h: any) {
    if (MOCK_MENTOR_SUBTOPIC) mockDeleteHoliday(h.id)
    else { const u = await supabase.from('mentor_holiday').delete().eq('id', h.id); if (u.error) { msg.error(u.error.message); return } }
    load()
  }
  if (!hols) return <div style={{ display: 'grid', placeItems: 'center', height: 200 }}><Spin /></div>
  const mine = hols.filter((h: any) => mentorIds.has(h.mentor_id))
  const ql = q.trim().toLowerCase()
  const shown = ql ? mine.filter((h: any) => String(nameById[h.mentor_id] || '').toLowerCase().includes(ql) || String(h.reason || '').toLowerCase().includes(ql)) : mine
  const daysOf = (h: any) => dayjs(h.to_date).diff(dayjs(h.from_date), 'day') + 1
  const lbl: any = { fontSize: 12, fontWeight: 600, color: '#69707d', margin: '10px 0 4px' }
  const cols = [
    { title: 'Mentor', dataIndex: 'mentor_id', render: (v: string) => <b>{nameById[v] || '—'}</b> },
    { title: 'From', dataIndex: 'from_date', render: (v: string) => dayjs(v).format('DD MMM YYYY') },
    { title: 'To', dataIndex: 'to_date', render: (v: string) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Days', width: 70, render: (_: any, h: any) => daysOf(h) },
    { title: 'Reason', dataIndex: 'reason', render: (v: string) => v || <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: '', width: 92, render: (_: any, h: any) => <span style={{ display: 'inline-flex', gap: 2 }}>
      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(h)} title="Edit holiday" />
      <Popconfirm title="Delete this holiday?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => del(h)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
    </span> },
  ]
  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: '#69707d' }}>Log and track mentor holidays / leave.</div>
      <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => { setEditId(null); setForm({}); setAdd(true) }}>Log holiday</Button>
    </div>
    <Input allowClear prefix={<SearchOutlined style={{ color: '#9aa1ad' }} />} placeholder="Search mentor or reason…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 300, marginBottom: 12 }} />
    <Table size="middle" rowKey="id" columns={cols as any} dataSource={shown} pagination={{ pageSize: 12 }} locale={{ emptyText: <Empty description={ql ? `No holidays match “${q}”` : 'No holidays logged yet.'} /> }} />
    {add && <Modal open title={editId ? 'Edit holiday' : 'Log holiday'} okText="Save" onOk={submitAdd} onCancel={() => { setAdd(false); setEditId(null); setForm({}) }} destroyOnClose>
      <div style={lbl}>Mentor</div><Select showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="Select a mentor" value={form.mentor_id} onChange={(v) => setForm((f: any) => ({ ...f, mentor_id: v }))} options={mentors.map((m: any) => ({ value: m.id, label: m.full_name }))} />
      <Row gutter={8}><Col span={12}><div style={lbl}>From date</div><DatePicker style={{ width: '100%' }} value={form.from_date} onChange={(v) => setForm((f: any) => ({ ...f, from_date: v }))} /></Col><Col span={12}><div style={lbl}>To date</div><DatePicker style={{ width: '100%' }} value={form.to_date} onChange={(v) => setForm((f: any) => ({ ...f, to_date: v }))} /></Col></Row>
      <div style={lbl}>Reason</div><Input.TextArea rows={2} placeholder="Reason (optional)" value={form.reason || ''} onChange={(e) => setForm((f: any) => ({ ...f, reason: e.target.value }))} />
    </Modal>}
  </div>
}

function MentorGeneration() {
  const { person } = useAuth()
  const isAdmin = person?.role === 'admin'; const isMentor = person?.role === 'mentor'
  const canManage = isAdmin || OWNER_ROLES.includes(person?.role)
  const { message: msg } = AntApp.useApp()
  const [mentors, setMentors] = useState<any[]>([])
  const [pubTopics, setPubTopics] = useState<any[]>([])
  const [myRatings, setMyRatings] = useState<any[]>([])
  const [rows, setRows] = useState<any>(null)
  const [subProg, setSubProg] = useState<any>({}) // `${mentor_id}:${subtopic_id}` -> 4-step progress row
  const [missing, setMissing] = useState(false)
  const [assignedMap, setAssignedMap] = useState<any>({}) // topic_id -> [mentor names]
  const [leadsMap, setLeadsMap] = useState<any>({}) // mentor_id -> [lead_ids] (multiple managing leads, v28)
  const [mentorPrograms, setMentorPrograms] = useState<any>({}) // mentor_id -> Set(program ids) from ACTIVE prep
  const [nav, setNav] = useState<any>({ programId: null, program: null, subject: null, chapter: null })
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [assignOpen, setAssignOpen] = useState(false); const [popMentors, setPopMentors] = useState<Set<string>>(new Set())
  const [mentorF, setMentorF] = useState<any>(null)
  const [, setRatingByMentor] = useState<any>({}) // per-mentor overall rating (kept for future use; board shows per-sub-topic Technical)
  const [subRatings, setSubRatings] = useState<any>({}) // `${mentor_id}:${subtopic scope_id}` -> Technical avg (sub-topic level)
  const [dailyRating, setDailyRating] = useState<any>({}) // mentor_id -> Daily corporate etiquette avg (general, once a day)
  const [dailyHistory, setDailyHistory] = useState<any>({}) // mentor_id -> [{ date, avg, cats:{cat:score}, remark }] daily etiquette per day
  const [progPop, setProgPop] = useState(false)
  const [treeData, setTreeData] = useState<any[]>([])
  const [open, setOpen] = useState<any>(null)
  const [rateRow, setRateRow] = useState<any>(null)
  const [wd, setWd] = useState<any>(null); const [wdText, setWdText] = useState('')
  const [histTopic, setHistTopic] = useState<any>(null)
  const [nameById, setNameById] = useState<any>({})
  const [deps, setDeps] = useState<any[]>([]) // mentor_deployment summary (mentor_id, status) — powers pipeline counts (v34)
  async function load() {
    let p: any = await supabase.from('person').select('id, full_name, employee_id, role, is_active, lead_id, program_id, mentor_status, mentor_status_reason, mentor_status_at')
    if (p.error) p = await supabase.from('person').select('id, full_name, employee_id, role, is_active, lead_id, program_id')
    if (p.error) p = await supabase.from('person').select('id, full_name, role, is_active, lead_id, program_id')
    if (p.error) p = await supabase.from('person').select('id, full_name, role, is_active')
    const allMentors = (p.data || []).filter((x: any) => x.role === 'mentor' && x.is_active)
    // multiple managing leads (v28); falls back to the single lead_id when absent
    const lm: any = {}
    if (MOCK_MENTOR_SUBTOPIC) Object.assign(lm, mockAllMentorLeads())
    else { const ml = await supabase.from('mentor_lead').select('mentor_id, lead_id'); if (!ml.error) (ml.data || []).forEach((x: any) => { (lm[x.mentor_id] = lm[x.mentor_id] || []).push(x.lead_id) }) }
    setLeadsMap(lm)
    const leadsOf = (m: any) => (lm[m.id]?.length ? lm[m.id] : (m.lead_id ? [m.lead_id] : []))
    // co-assigned programs (v29) also belong to this lead → they see mentors they manage OR mentors tagged to a co-assigned program
    const co = await coAssignedPrograms(person.id)
    const visMentors = isAdmin ? allMentors : allMentors.filter((m: any) => leadsOf(m).includes(person.id) || (m.program_id && co.has(m.program_id)))
    // mock mode: overlay locally-saved training status so the sandbox is fully interactive (no prod writes)
    if (MOCK_MENTOR_SUBTOPIC) { const ms = mockAllMentorStatus(); visMentors.forEach((m: any) => { if (ms[m.id]) { m.mentor_status = ms[m.id].status; m.mentor_status_reason = ms[m.id].reason } }) }
    setMentors(visMentors)
    // deployment summary for pipeline counts (v34) — deployed / back-to-bench are derived from these
    if (MOCK_MENTOR_SUBTOPIC) setDeps(mockListDeployments())
    else { const dp = await supabase.from('mentor_deployment').select('mentor_id, status'); setDeps(dp.error ? [] : (dp.data || [])) }
    const nm: any = {}; (p.data || []).forEach((x: any) => nm[x.id] = x.full_name); setNameById(nm)
    // a Lead/Manager sees ONLY the programs they OWN (Navya = Python only), regardless of mentor tagging
    let lp: Set<string> | null = null
    if (!isAdmin && !isMentor) {
      const [ms, sj] = await Promise.all([
        supabase.from('main_subject').select('id').eq('default_trainer_id', person.id),
        supabase.from('subject').select('main_subject_id').eq('default_trainer_id', person.id),
      ])
      lp = new Set<string>()
      ;(ms.data || []).forEach((x: any) => lp!.add(x.id))
      ;(sj.data || []).forEach((x: any) => x.main_subject_id && lp!.add(x.main_subject_id))
      co.forEach((pid) => lp!.add(pid)) // co-assigned programs (v29) count as the lead's programs here too
    }
    // PUBLISHED topics — a topic is assignable as soon as at least one sub-topic under it is published
    if (canManage) {
      const ci = await selectAll('content_item', 'id, subtopic:subtopic_id(name, topic:topic_id(id, name, chapter:chapter_id(name, subject:subject_id(name, main_subject:main_subject_id(id, name))))), item_stage(status)')
      const byT: any = {}; const tree: any = {}
      ;(ci || []).forEach((x: any) => {
        const t = x.subtopic?.topic; if (!t?.id) return
        const prog = t.chapter?.subject?.main_subject, subjN = t.chapter?.subject?.name || '—', chapN = t.chapter?.name || '—'
        const stages = x.item_stage || []
        const pub = stages.length > 0 && stages.every((s: any) => s.status === 'Completed')
        const e = byT[t.id] || (byT[t.id] = { topicId: t.id, topic: t.name, chapter: chapN, subject: subjN, program: prog?.name, programId: prog?.id, total: 0, pub: 0 })
        e.total++; if (pub) e.pub++
        // full tree (Program → Subject → Chapter → Topic → Sub-topic), scoped to the lead's programs
        if (prog?.id && (isAdmin || (lp && lp.has(prog.id)))) {
          const P = tree[prog.id] || (tree[prog.id] = { title: prog.name, key: 'p_' + prog.id, c: {} })
          const S = P.c[subjN] || (P.c[subjN] = { title: subjN, key: P.key + '|s' + subjN, c: {} })
          const C = S.c[chapN] || (S.c[chapN] = { title: chapN, key: S.key + '|c' + chapN, c: {} })
          const T = C.c[t.id] || (C.c[t.id] = { title: t.name, key: 't_' + t.id, c: {} })
          if (x.subtopic?.name) T.c[x.subtopic.name] = { title: x.subtopic.name, key: T.key + '|st' + x.subtopic.name, isLeaf: true }
        }
      })
      const toArr = (o: any): any[] => Object.values(o).map((n: any) => n.c ? { title: n.title, key: n.key, children: toArr(n.c) } : n)
      setTreeData(toArr(tree))
      let pts: any[] = Object.values(byT).filter((e: any) => e.pub > 0)
      if (lp) pts = pts.filter((e: any) => lp!.has(e.programId)) // lead → only their programs
      setPubTopics(pts)
      // per-mentor overall rating + latest remark (for the Deploy-ready popup) + per-sub-topic rating (board column)
      const mids0 = [...new Set(visMentors.map((m: any) => m.id))] as string[]
      const rtData: any[] = MOCK_MENTOR_SUBTOPIC ? mockListRatings(mids0)
        : await selectAll('mentor_rating', 'mentor_id, category, score, scope_id, remarks, rated_on') // selectAll pages past the 1000-row cap so recent ratings aren't dropped
      // overall rating = mean of per-category averages (each category averaged day one to date)
      const byM: any = {}; rtData.forEach((x: any) => { (byM[x.mentor_id] = byM[x.mentor_id] || []).push(x) })
      const res: any = {}
      Object.keys(byM).forEach((mid: string) => {
        const cat: any = {}; byM[mid].forEach((x: any) => { if (x.score != null) (cat[x.category] = cat[x.category] || []).push(Number(x.score)) })
        const avgs = Object.keys(cat).map((c) => cat[c].reduce((a: number, b: number) => a + b, 0) / cat[c].length)
        const remark = byM[mid].slice().sort((a: any, b: any) => String(b.rated_on).localeCompare(String(a.rated_on))).find((x: any) => x.remarks)?.remarks || null
        res[mid] = { overall: avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null, remark }
      })
      setRatingByMentor(res)
      // Technical (per sub-topic) = average of the TECHNICAL-category ratings tied to that sub-topic.
      // Keyed by mentor+scope_id, but ONLY technical categories count (etiquette never lands here even
      // if an old row carried a stray scope_id).
      const subAgg: any = {}; rtData.forEach((x: any) => { if (x.score == null || !x.scope_id || !TECH_CAT_KEYS.has(x.category)) return; const k = x.mentor_id + ':' + x.scope_id; (subAgg[k] = subAgg[k] || []).push(Number(x.score)) })
      const sr: any = {}; Object.keys(subAgg).forEach((k) => sr[k] = subAgg[k].reduce((a: number, b: number) => a + b, 0) / subAgg[k].length); setSubRatings(sr)
      // Daily corporate etiquette (per mentor) = average of the ETIQUETTE-category ratings, by category
      // (not by null scope_id) so daily ratings always reflect regardless of any legacy scope_id.
      const dayAgg: any = {}; rtData.forEach((x: any) => { if (x.score == null || !DAILY_CAT_KEYS.has(x.category)) return; (dayAgg[x.mentor_id] = dayAgg[x.mentor_id] || []).push(Number(x.score)) })
      const dr2: any = {}; Object.keys(dayAgg).forEach((m) => dr2[m] = dayAgg[m].reduce((a: number, b: number) => a + b, 0) / dayAgg[m].length); setDailyRating(dr2)
      // per-day daily-etiquette breakdown (by etiquette category, grouped by mentor+date) for the Daily tab history
      const dh: any = {}
      rtData.forEach((x: any) => { if (x.score == null || !DAILY_CAT_KEYS.has(x.category)) return; const dt = String(x.rated_on || '').slice(0, 10); if (!dt) return; const perM = dh[x.mentor_id] = dh[x.mentor_id] || {}; const row = perM[dt] = perM[dt] || { date: dt, cats: {}, remark: null }; row.cats[x.category] = Number(x.score); if (x.remarks) row.remark = x.remarks })
      const dhArr: any = {}; Object.keys(dh).forEach((m) => { dhArr[m] = Object.values(dh[m]).map((row: any) => { const vals = Object.values(row.cats) as number[]; return { ...row, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null } }).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date))) })
      setDailyHistory(dhArr)
    }
    if (isMentor) { const mr = await supabase.from('mentor_rating').select('category, score, rated_on, weight_snapshot, remarks').eq('mentor_id', person.id); setMyRatings(mr.error ? [] : (mr.data || [])) }
    // A mentor sees only their own prep (small). Admin/leads need EVERY prep row — page past
    // Supabase's 1000-row cap, otherwise mentors beyond the newest 1000 rows show "unmapped"
    // in the board, assign list and pipeline even though they are assigned.
    // IMPORTANT: paginate over the UNIQUE primary key (id), not created_at — offset pagination
    // over a non-unique column (bulk assigns share a timestamp) silently SKIPS rows between
    // pages, which dropped already-assigned mentors from the board. Re-sort for display after.
    const mkQ = async (cols: string): Promise<{ data: any[] | null; error: any }> => {
      if (isMentor) return await supabase.from('mentor_prep').select(cols).eq('mentor_id', person.id).order('created_at', { ascending: false })
      const out: any[] = []; const step = 1000; let from = 0
      for (;;) {
        const q = await supabase.from('mentor_prep').select(cols).order('id', { ascending: true }).range(from, from + step - 1)
        if (q.error) return { data: null, error: q.error }
        const d = q.data || []; out.push(...d)
        if (d.length < step) break
        from += step
      }
      out.sort((a: any, b: any) => String(b.created_at || '').localeCompare(String(a.created_at || ''))) // restore newest-first for display
      return { data: out, error: null }
    }
    let r = await mkQ('*, mentor:mentor_id(full_name), topic:topic_id(name, chapter:chapter_id(name, subject:subject_id(name, main_subject:main_subject_id(id, name))), subtopic(id, name, sequence))')
    // fallback: if embedding sub-topics isn't available, fetch without it so the board still renders
    if (r.error && /subtopic/.test(r.error.message || '')) r = await mkQ('*, mentor:mentor_id(full_name), topic:topic_id(name, chapter:chapter_id(name, subject:subject_id(name, main_subject:main_subject_id(id, name))))')
    if (r.error) { setMissing(true); setRows([]) }
    else {
      setMissing(false)
      const allPrep = (r.data || []).filter((row: any) => (row.state || 'active') !== 'withdrawn')
      // global topic→mentor map so the assign list knows what's already taken (across all leads)
      const am: any = {}; allPrep.forEach((x: any) => { if (x.topic_id) (am[x.topic_id] = am[x.topic_id] || []).push(x.mentor?.full_name || 'Assigned') }); setAssignedMap(am)
      // global mentor → set of programs they currently have ACTIVE prep in (single-domain eligibility; ignores withdrawn)
      const mpg: any = {}; allPrep.forEach((x: any) => { const pid = x.topic?.chapter?.subject?.main_subject?.id; if (pid) (mpg[x.mentor_id] = mpg[x.mentor_id] || new Set()).add(pid) }); setMentorPrograms(mpg)
      let data = allPrep
      if (lp) data = data.filter((row: any) => lp!.has(row.topic?.chapter?.subject?.main_subject?.id)) // lead/manager → only prep in THEIR programs
      setRows(data)
      // per-sub-topic 4-step progress for the mentors shown on the board
      const mids = [...new Set(data.map((x: any) => x.mentor_id).filter(Boolean))] as string[]
      if (MOCK_MENTOR_SUBTOPIC) { const map: any = {}; mockListSubProg(mids).forEach((x: any) => { map[x.mentor_id + ':' + x.subtopic_id] = x }); setSubProg(map) }
      else if (mids.length) {
        const sp = await supabase.from('mentor_subtopic_prep').select('mentor_id, subtopic_id, watched, notes_done, practice_done, presentation_done').in('mentor_id', mids as any)
        const map: any = {}; if (!sp.error) (sp.data || []).forEach((x: any) => { map[x.mentor_id + ':' + x.subtopic_id] = x }); setSubProg(map)
      } else setSubProg({})
    }
  }
  useEffect(() => { if (person?.id) load() }, [person?.id])
  const pubCount = pubTopics.length
  const assignedCount = pubTopics.filter((t: any) => (assignedMap[t.topicId] || []).length).length
  // ----- tree drill-down (Program → Subject → Chapter → Topic), published-only, lead-scoped -----
  const sq = search.trim().toLowerCase()
  const searching = sq.length > 0
  const level: 'program' | 'subject' | 'chapter' | 'topic' = searching ? 'topic' : !nav.programId ? 'program' : !nav.subject ? 'subject' : !nav.chapter ? 'chapter' : 'topic'
  const inView = pubTopics.filter((t: any) => (!nav.programId || t.programId === nav.programId) && (!nav.subject || t.subject === nav.subject) && (!nav.chapter || t.chapter === nav.chapter))
  // build the rows for the current level (or flat search results when searching)
  const nodes: any[] = (() => {
    if (searching) {
      // search across program/subject/chapter/topic names → flat topic rows with their path + status
      return pubTopics.filter((t: any) => [t.program, t.subject, t.chapter, t.topic].some((x: any) => String(x || '').toLowerCase().includes(sq)))
        .map((t: any) => ({ key: t.topicId, label: t.topic, path: `${t.program} › ${t.subject} › ${t.chapter}`, programId: t.programId, program: t.program, isTopic: true, topicIds: [t.topicId], mentors: new Set<string>(assignedMap[t.topicId] || []) }))
        .sort((a: any, b: any) => String(a.label).localeCompare(String(b.label)))
    }
    const group: any = {}
    inView.forEach((t: any) => {
      const key = level === 'program' ? t.programId : level === 'subject' ? t.subject : level === 'chapter' ? t.chapter : t.topicId
      const label = level === 'program' ? t.program : level === 'subject' ? t.subject : level === 'chapter' ? t.chapter : t.topic
      const e = group[key] || (group[key] = { key, label, programId: t.programId, program: t.program, isTopic: level === 'topic', topicIds: [], mentors: new Set<string>() })
      e.topicIds.push(t.topicId); (assignedMap[t.topicId] || []).forEach((n: string) => e.mentors.add(n))
    })
    return Object.values(group).sort((a: any, b: any) => String(a.label).localeCompare(String(b.label)))
  })()
  const selNodes = nodes.filter((n: any) => sel.has(n.key))
  const selTopicIds = [...new Set(selNodes.flatMap((n: any) => n.topicIds))]
  const selProgramIds = [...new Set(selNodes.map((n: any) => n.programId))]
  // a mentor is eligible if they have NO active prep (free agent), or their only active program is the one selected.
  // (Uses live active prep — a withdrawn mentor is freed even though person.program_id may still be cached.)
  // v34: a mentor may hold MULTIPLE subjects/programs — every visible mentor is eligible.
  // (Terminated / dropout mentors are excluded so they aren't assigned new work.)
  const eligibleMentors = mentors.filter((m: any) => !MENTOR_EXITED.has(m.mentor_status))
  function drill(n: any) {
    if (n.isTopic) return
    setSel(new Set())
    if (level === 'program') setNav({ programId: n.programId, program: n.program, subject: null, chapter: null })
    else if (level === 'subject') setNav({ ...nav, subject: n.label })
    else if (level === 'chapter') setNav({ ...nav, chapter: n.label })
  }
  function toggleSel(k: string) { setSel(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n }) }
  async function bulkAssign() {
    const mids = [...popMentors]; if (!mids.length || !selTopicIds.length) { msg.warning('Pick at least one mentor.'); return }
    let ok = 0, fail = 0, lastErr = ''
    for (const mid of mids) {
      for (const tid of selTopicIds) {
        const base: any = { mentor_id: mid, topic_id: tid, assigned_by: person?.id || null }
        let { error } = await supabase.from('mentor_prep').upsert(base, { onConflict: 'mentor_id,topic_id' })
        if (error && /assigned_by/.test(error.message)) { const { assigned_by, ...rest } = base; ({ error } = await supabase.from('mentor_prep').upsert(rest, { onConflict: 'mentor_id,topic_id' })) }
        if (error) { fail++; lastErr = error.message } else ok++
      }
      const m = mentors.find((x: any) => x.id === mid)
      // keep the cached single-domain program in sync (covers first assignment AND reassignment to a new program)
      if (m && selProgramIds.length === 1 && m.program_id !== selProgramIds[0]) await supabase.from('person').update({ program_id: selProgramIds[0] }).eq('id', mid)
    }
    if (ok) msg.success(`Assigned ${selTopicIds.length} topic(s) to ${mids.length} mentor(s)${fail ? ` · ${fail} failed` : ''}`)
    else msg.error(/mentor_prep|relation|does not exist/.test(lastErr) ? 'Run RecTrack_v17.sql first.' : (lastErr || 'Could not assign'))
    setAssignOpen(false); setPopMentors(new Set()); setSel(new Set()); load()
  }
  async function withdraw() {
    if (!wdText.trim()) { msg.warning('Give a reason for the withdrawal.'); return }
    const { error } = await supabase.from('mentor_prep').update({ state: 'withdrawn', withdrawn_by: person?.id || null, withdrawn_at: new Date().toISOString(), withdraw_reason: wdText.trim() }).eq('id', wd.id)
    if (error) { msg.error(/state|withdraw/.test(error.message) ? 'Run RecTrack_v20.sql first to enable withdraw.' : error.message); return }
    setWd(null); setWdText(''); msg.success(`Withdrawn — “${wd.topic?.name || 'topic'}”`); load()
  }
  // deselect a mentor from a whole subject — withdraw all their active topics under it
  async function deselectSubject(mentorId: string, subject: string) {
    const ids = rows.filter((r: any) => r.mentor_id === mentorId && r.topic?.chapter?.subject?.name === subject && (r.state || 'active') !== 'withdrawn').map((r: any) => r.id)
    if (!ids.length) { msg.info('Nothing active to deselect.'); return }
    const { error } = await supabase.from('mentor_prep').update({ state: 'withdrawn', withdrawn_by: person?.id || null, withdrawn_at: new Date().toISOString(), withdraw_reason: `Deselected from ${subject}` }).in('id', ids)
    if (error) { msg.error(/state|withdraw/.test(error.message) ? 'Run RecTrack_v20.sql first to enable withdraw.' : error.message); return }
    msg.success(`Deselected from ${subject} — ${ids.length} topic(s) freed`); load()
  }
  if (!rows) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  // live lifecycle buckets (v34). Deployed / Back-to-bench derive from mentor_deployment; the rest from mentor_status.
  // "Back to bench" = has COMPLETED any training (Branch / Online / College / Corporate / College grooming).
  const activeDeployedSet = new Set(deps.filter((d: any) => d.status === 'approved').map((d: any) => d.mentor_id))
  const returnedSet = new Set(deps.filter((d: any) => d.status === 'completed').map((d: any) => d.mentor_id))
  const bcount: Record<string, number> = {}
  mentors.forEach((m: any) => { const b = mentorBucket(m, activeDeployedSet as Set<string>, returnedSet as Set<string>); bcount[b] = (bcount[b] || 0) + 1 })
  const trainingCount = (bcount.in_training || 0) + (bcount.upskilling || 0)
  const grp = (r: any) => ({ rowSpan: r.firstOfTopic ? r.groupSize : 0 }) // topic-level cells span their sub-topic rows
  const cols = [
    { title: 'Mentor', onCell: grp, render: (_: any, r: any) => <span><Avatar size={24} style={{ background: '#c2410c', marginRight: 8, fontSize: 11 }}>{(r.prep.mentor?.full_name || '?')[0]}</Avatar>{r.prep.mentor?.full_name || '—'}</span> },
    { title: 'Sub-topic', render: (_: any, r: any) => <div>
      <div style={{ fontSize: 11, color: '#9aa1ad' }}>{[r.prep.topic?.chapter?.subject?.main_subject?.name, r.prep.topic?.chapter?.subject?.name, r.prep.topic?.chapter?.name, r.prep.topic?.name].filter(Boolean).join(' › ')}<ATooltip title="View full history / audit trail"><InfoCircleOutlined onClick={(e: any) => { e.stopPropagation(); setHistTopic({ id: r.prep.topic_id, name: r.prep.topic?.name }) }} style={{ marginLeft: 6, color: '#9aa1ad', cursor: 'pointer' }} /></ATooltip></div>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#161a22', marginTop: 2 }}>{r.subtopic?.name || <span style={{ color: '#9aa1ad', fontWeight: 400 }}>No sub-topics under this topic</span>}</div>
    </div> },
    { title: '4-step progress', width: 150, render: (_: any, r: any) => r.subtopic ? <SubtopicSteps mentorId={r.prep.mentor_id} subtopicId={r.subtopic.id} prog={subProg[r.prep.mentor_id + ':' + r.subtopic.id]} canEdit={isAdmin || (isMentor && r.prep.mentor_id === person.id)} onSaved={(stid: string, next: any) => setSubProg((m: any) => ({ ...m, [r.prep.mentor_id + ':' + stid]: { ...next } }))} /> : <span style={{ color: '#9aa1ad', fontSize: 12 }}>—</span> },
    { title: 'Status', width: 140, render: (_: any, r: any) => { if (!r.subtopic) return <span style={{ color: '#9aa1ad' }}>—</span>; const p = subProg[r.prep.mentor_id + ':' + r.subtopic.id] || {}; const n = MENTOR_STEPS.filter(s => p[s.key]).length; return n === 4 ? <Tag color="green">Done</Tag> : n === 0 ? <Tag>Not started</Tag> : <Tag color="orange">In progress ({n}/4)</Tag> } },
    { title: 'Technical', width: 100, render: (_: any, r: any) => { if (!r.subtopic) return <span style={{ color: '#9aa1ad' }}>—</span>; const v = subRatings[r.prep.mentor_id + ':' + r.subtopic.id]; return v != null ? <Tag color={v >= 4 ? 'green' : v >= 3 ? 'orange' : 'red'}>{v.toFixed(1)}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> } },
    { title: 'SLA', width: 100, onCell: grp, render: (_: any, r: any) => { if ((r.prep.review_status || 'open') === 'completed') return <span style={{ color: '#16a34a', fontSize: 12 }}>Done</span>; const dl = dayjs(r.prep.created_at).add(MENTOR_SLA_DAYS, 'day').diff(dayjs(), 'day'); return <span style={{ fontSize: 12, color: dl < 0 ? '#dc2626' : dl <= 1 ? '#d97706' : '#69707d' }}>{dl < 0 ? `${-dl}d overdue` : `${dl}d left`}</span> } },
    ...(!isMentor ? [{ title: 'Assigned lead', width: 150, onCell: grp, render: (_: any, r: any) => { const m = mentors.find((x: any) => x.id === r.prep.mentor_id); const lids = leadsMap[r.prep.mentor_id]?.length ? leadsMap[r.prep.mentor_id] : (m?.lead_id ? [m.lead_id] : []); return lids.length ? lids.map((lid: string) => nameById[lid] || '—').join(', ') : <span style={{ color: '#9aa1ad' }}>—</span> } }] : []),
    { title: '', width: 400, render: (_: any, r: any) => <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      {!isMentor && r.subtopic && <Button size="small" icon={<StarOutlined />} onClick={() => setRateRow({ ...r.prep, subtopic: r.subtopic, mode: 'technical' })}>Technical</Button>}
      <Button size="small" onClick={() => setOpen(r.prep)}>Open</Button>
      {isAdmin && r.firstOfTopic && <Popconfirm title={`Deselect this mentor from “${r.prep.topic?.chapter?.subject?.name || 'this subject'}”? Frees all their topics under it.`} okText="Deselect" okButtonProps={{ danger: true }} onConfirm={() => deselectSubject(r.prep.mentor_id, r.prep.topic?.chapter?.subject?.name)}><Button size="small" type="text" danger>Deselect subject</Button></Popconfirm>}
      {isAdmin && r.firstOfTopic && <Button size="small" type="text" danger title="Withdraw (Program Head only)" onClick={() => { setWdText(''); setWd(r.prep) }}>Withdraw</Button>}
    </span> },
  ]
  // tree browser — full Program → Subject → Chapter → Topic → Sub-topic (lead = their programs; mentor = their assigned topics)
  const treeForView = (() => {
    if (!isMentor) return treeData
    const t: any = {}
    rows.filter((r: any) => r.topic).forEach((r: any) => {
      const prog = r.topic?.chapter?.subject?.main_subject?.name || '—', subj = r.topic?.chapter?.subject?.name || '—'
      const P = t[prog] || (t[prog] = { title: prog, key: 'p' + prog, c: {} })
      const S = P.c[subj] || (P.c[subj] = { title: subj, key: P.key + 's' + subj, c: {} })
      const rs = r.review_status || 'open'
      S.c[r.id] = { title: `${r.topic?.name} — ${rs === 'completed' ? 'Completed' : rs === 'ready_for_review' ? 'In review' : 'In progress'}`, key: 't' + r.id, isLeaf: true }
    })
    const toArr = (o: any): any[] => Object.values(o).map((n: any) => n.c ? { title: n.title, key: n.key, children: toArr(n.c) } : n)
    return toArr(t)
  })()
  const treeCard = treeForView.length > 0 ? <Card title={isMentor ? 'My topics — tree' : 'Program tree (published topics)'} size="small" style={{ marginBottom: 16 }}>
    <Tree treeData={treeForView} showLine selectable={false} height={340} />
  </Card> : null
  const kpis = !missing && <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
    <Col xs={12} md={8}><div onClick={() => !isMentor && setProgPop(true)} style={{ cursor: isMentor ? 'default' : 'pointer' }}><KpiCard icon={<ReadOutlined />} tint={PRIMARY} label={isMentor ? 'My topics' : 'Topics in prep · tap for programs'} value={rows.length} /></div></Col>
    {!isMentor && <Col xs={12} md={8}><KpiCard icon={<TeamOutlined />} tint="#d97706" label="Mentors under training" value={trainingCount} /></Col>}
  </Row>
  const assignCard = canManage && <Card title="Assign published topics to mentors" style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
      <div style={{ background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 10, padding: '8px 16px' }}><div style={{ fontSize: 11, color: '#69707d' }}>Published topics</div><div style={{ fontSize: 20, fontWeight: 800 }}>{pubCount}</div></div>
      <div style={{ background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 10, padding: '8px 16px' }}><div style={{ fontSize: 11, color: '#69707d' }}>Assigned</div><div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{assignedCount}</div></div>
      <div style={{ background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 10, padding: '8px 16px' }}><div style={{ fontSize: 11, color: '#69707d' }}>Pending</div><div style={{ fontSize: 20, fontWeight: 800, color: pubCount - assignedCount > 0 ? '#d97706' : '#9aa1ad' }}>{pubCount - assignedCount}</div></div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
      <Input prefix={<SearchOutlined style={{ color: '#9aa1ad' }} />} allowClear placeholder="Search program / subject / chapter / topic…" style={{ maxWidth: 320 }} value={search} onChange={e => { setSearch(e.target.value); setSel(new Set()) }} />
      {searching ? <span style={{ fontSize: 12, color: '#69707d' }}>{nodes.length} match{nodes.length === 1 ? '' : 'es'} for “{search.trim()}”</span>
        : <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, flexWrap: 'wrap' }}>
          <span style={{ color: nav.programId ? PRIMARY : '#161a22', fontWeight: nav.programId ? 400 : 600, cursor: nav.programId ? 'pointer' : 'default' }} onClick={() => { setNav({ programId: null, program: null, subject: null, chapter: null }); setSel(new Set()) }}>Programs</span>
          {nav.program && <><span style={{ color: '#c0c4cc' }}>›</span><span style={{ color: nav.subject ? PRIMARY : '#161a22', fontWeight: nav.subject ? 400 : 600, cursor: nav.subject ? 'pointer' : 'default' }} onClick={() => { setNav({ ...nav, subject: null, chapter: null }); setSel(new Set()) }}>{nav.program}</span></>}
          {nav.subject && <><span style={{ color: '#c0c4cc' }}>›</span><span style={{ color: nav.chapter ? PRIMARY : '#161a22', fontWeight: nav.chapter ? 400 : 600, cursor: nav.chapter ? 'pointer' : 'default' }} onClick={() => { setNav({ ...nav, chapter: null }); setSel(new Set()) }}>{nav.subject}</span></>}
          {nav.chapter && <><span style={{ color: '#c0c4cc' }}>›</span><span style={{ fontWeight: 600 }}>{nav.chapter}</span></>}
        </div>}
    </div>
    {sel.size > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#eef0ff', border: '1px solid #d9defb', borderRadius: 8, padding: '8px 12px', marginBottom: 10, flexWrap: 'wrap' }}>
      <b>{sel.size} {level}{sel.size === 1 ? '' : 's'} selected</b>
      <Button type="primary" size="small" onClick={() => { setPopMentors(new Set()); setAssignOpen(true) }}>Assign to mentors</Button>
      <Button type="text" size="small" onClick={() => setSel(new Set())}>Clear</Button>
    </div>}
    <div style={{ border: '1px solid #eef0f3', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', background: '#f7f8fb', fontSize: 11, color: '#69707d', letterSpacing: .3 }}>
        <span style={{ width: 28 }} /><span style={{ flex: 1, textTransform: 'uppercase' }}>{level}</span><span style={{ width: 210 }}>ASSIGNED MENTORS</span>
      </div>
      {nodes.length === 0 ? <div style={{ padding: 16 }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No published topics here yet." /></div> : nodes.map((n: any) => {
        const ms = [...n.mentors].sort((a: string, b: string) => String(a).localeCompare(String(b)))
        return <div key={n.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid #f0f0f0', background: sel.has(n.key) ? '#eef0ff' : undefined }}>
          <span style={{ width: 28 }}><Checkbox checked={sel.has(n.key)} onChange={() => toggleSel(n.key)} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <div onClick={() => drill(n)} style={{ color: n.isTopic ? '#161a22' : PRIMARY, fontWeight: 500, cursor: n.isTopic ? 'default' : 'pointer' }}>{n.label}{!n.isTopic && ' ›'}</div>
            {n.path ? <div style={{ fontSize: 11, color: '#9aa1ad' }}>{n.path}</div> : <span style={{ fontSize: 11, color: '#9aa1ad' }}>{n.topicIds.length} topic{n.topicIds.length === 1 ? '' : 's'}</span>}
          </span>
          <span style={{ width: 210, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>{ms.length === 0 ? <Tag>Unassigned</Tag> : <>
            {ms.slice(0, 2).map((nm: string, i: number) => <Tag key={i} color="blue" style={{ margin: 0 }}>{nm}</Tag>)}
            {ms.length > 2 && <Popover trigger="click" title={`Assigned mentors (${ms.length})`} content={<div style={{ minWidth: 200, maxHeight: 280, overflow: 'auto' }}>{ms.map((nm: string, i: number) => <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 13, borderTop: i ? '1px solid #f0f0f0' : undefined }}><span style={{ color: '#9aa1ad', width: 18, textAlign: 'right' }}>{i + 1}</span><span>{nm}</span></div>)}</div>}><a onClick={(e: any) => e.stopPropagation()} style={{ fontSize: 12 }}>+{ms.length - 2} more</a></Popover>}
          </>}</span>
          <span style={{ width: 22 }}>{n.isTopic && <ATooltip title="View full history / audit trail"><InfoCircleOutlined onClick={() => setHistTopic({ id: n.topicIds[0], name: n.label })} style={{ color: '#9aa1ad', cursor: 'pointer' }} /></ATooltip>}</span>
        </div>
      })}
    </div>
    <div style={{ fontSize: 11, color: '#9aa1ad', marginTop: 6 }}>Tick one or more {level}s → “Assign to mentors”, or click a name’s › to drill deeper.</div>
  </Card>
  // one display row per SUB-TOPIC; topic-level cells (mentor/status/SLA/lead/actions) span the group via rowSpan
  const boardRows = (mentorF ? rows.filter((r: any) => r.mentor_id === mentorF) : rows).filter((r: any) => r.topic).flatMap((prep: any) => {
    const subs = [...(prep.topic?.subtopic || [])].sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0))
    if (subs.length === 0) return [{ key: prep.id, prep, subtopic: null, firstOfTopic: true, groupSize: 1 }]
    return subs.map((st: any, i: number) => ({ key: prep.id + ':' + st.id, prep, subtopic: st, firstOfTopic: i === 0, groupSize: subs.length }))
  })
  const boardCard = <Card title={isMentor ? 'My Preparation' : 'Mentor Preparation Board'}
    extra={!isMentor ? <Select allowClear showSearch optionFilterProp="label" placeholder="Filter by mentor" style={{ minWidth: 200 }} value={mentorF} onChange={setMentorF} options={mentors.map((m: any) => ({ value: m.id, label: m.full_name }))} /> : undefined}>
    <Table size="middle" rowKey="key" columns={cols as any} dataSource={boardRows} pagination={{ pageSize: 20 }} locale={{ emptyText: <Empty description={isMentor ? 'Nothing assigned to you yet' : 'No topics assigned to your mentors yet'} /> }} />
  </Card>
  // Daily corporate etiquette — rated ONCE A DAY per mentor (not per topic). One row per mentor under training.
  const dailyMentors = Array.from(new Map((rows as any[]).filter((r: any) => r.mentor_id && r.topic).map((r: any) => [r.mentor_id, r])).values())
  const dailyCard = <Card title="Daily corporate etiquette" extra={<span style={{ fontSize: 12, color: '#69707d' }}>Punctuality · discipline · dedication · attire · leadership — once a day per mentor</span>}>
    <Table size="middle" rowKey={(r: any) => r.mentor_id} dataSource={dailyMentors} pagination={{ pageSize: 20 }}
      expandable={{
        rowExpandable: (r: any) => (dailyHistory[r.mentor_id] || []).length > 0,
        expandedRowRender: (r: any) => {
          const hist = dailyHistory[r.mentor_id] || []
          if (!hist.length) return <span style={{ color: '#9aa1ad', fontSize: 12 }}>No daily ratings recorded yet.</span>
          return <Table size="small" rowKey="date" pagination={false} dataSource={hist} columns={[
            { title: 'Date', dataIndex: 'date', width: 130, render: (d: string) => dayjs(d).format('DD MMM YYYY') },
            { title: 'Scores given', render: (_: any, h: any) => <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{Object.keys(h.cats).map((k: string) => <Tag key={k}>{(RATING_CAT_LABEL[k] || k)}: {Number(h.cats[k]).toFixed(1)}</Tag>)}</span> },
            { title: 'Day avg', width: 90, render: (_: any, h: any) => h.avg != null ? <Tag color={h.avg >= 4 ? 'green' : h.avg >= 3 ? 'orange' : 'red'}>{h.avg.toFixed(1)}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
            { title: 'Remark', render: (_: any, h: any) => h.remark || <span style={{ color: '#9aa1ad' }}>—</span> },
          ] as any} />
        },
      }}
      columns={[
        { title: 'Mentor', render: (_: any, r: any) => <span><Avatar size={24} style={{ background: '#c2410c', marginRight: 8, fontSize: 11 }}>{(r.mentor?.full_name || '?')[0]}</Avatar>{r.mentor?.full_name || '—'}</span> },
        { title: 'Subject', render: (_: any, r: any) => r.topic?.chapter?.subject?.name || <span style={{ color: '#9aa1ad' }}>—</span> },
        { title: 'Etiquette rating (till date)', width: 180, render: (_: any, r: any) => { const v = dailyRating[r.mentor_id]; return v != null ? <Tag color={v >= 4 ? 'green' : v >= 3 ? 'orange' : 'red'}>{v.toFixed(1)} / 5</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> } },
        { title: 'Days rated', width: 100, render: (_: any, r: any) => { const n = (dailyHistory[r.mentor_id] || []).length; return n ? <span>{n}</span> : <span style={{ color: '#9aa1ad' }}>0</span> } },
        { title: '', width: 120, render: (_: any, r: any) => <span style={{ display: 'flex', justifyContent: 'flex-end' }}><Button size="small" icon={<StarOutlined />} onClick={() => setRateRow({ ...r, mode: 'daily' })}>Rate</Button></span> },
      ] as any}
      locale={{ emptyText: <Empty description="No mentors under training yet" /> }} />
  </Card>
  // mentor's own ratings (read-only)
  const myCard = isMentor && (() => {
    // average per category from day one to date; overall = mean of those category averages
    const g: any = {}; myRatings.forEach((x: any) => { if (x.score != null) (g[x.category] = g[x.category] || []).push(Number(x.score)) })
    const lp: any = {}; Object.keys(g).forEach((c) => lp[c] = { score: g[c].reduce((a: number, b: number) => a + b, 0) / g[c].length })
    const cats = Object.keys(lp); const overall = cats.length ? cats.reduce((s, c) => s + lp[c].score, 0) / cats.length : null
    // every distinct remark the leads have left (deduped by date+text — the 3 technical cats share one remark), newest first
    const remarkList: { date: string; text: string }[] = []
    const seenR = new Set<string>()
    myRatings.slice().sort((a: any, b: any) => String(b.rated_on).localeCompare(String(a.rated_on))).forEach((x: any) => {
      if (!x.remarks) return; const k = String(x.rated_on).slice(0, 10) + '|' + x.remarks
      if (seenR.has(k)) return; seenR.add(k); remarkList.push({ date: String(x.rated_on).slice(0, 10), text: x.remarks })
    })
    return <Card title="My ratings" style={{ marginBottom: 16 }} extra={overall != null ? <Tag color="blue">Overall {overall.toFixed(1)} / 5</Tag> : null}>
      {cats.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No ratings yet — your Lead will rate you as you progress." /> : <>
        {cats.map(c => <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}><span style={{ width: 200, fontSize: 13, color: '#69707d' }}>{RATING_CAT_LABEL[c] || c}</span><div style={{ flex: 1, height: 8, borderRadius: 4, background: '#eef0f3' }}><div style={{ width: `${(lp[c].score / 5) * 100}%`, height: '100%', borderRadius: 4, background: PRIMARY }} /></div><span style={{ width: 28, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{lp[c].score.toFixed(1)}</span></div>)}
        {remarkList.length > 0 && <div style={{ background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginTop: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Remarks from your Lead</div>
          {remarkList.slice(0, 6).map((r, i) => <div key={i} style={{ padding: '5px 0', borderTop: i ? '1px solid #eef0f3' : 'none' }}>
            <span style={{ fontSize: 11, color: '#9aa1ad', marginRight: 8 }}>{dayjs(r.date).format('DD MMM YYYY')}</span>{r.text}
          </div>)}
        </div>}
      </>}
    </Card>
  })()
  const progAgg = Object.values(rows.filter((r: any) => r.topic).reduce((a: any, r: any) => { const pn = r.topic?.chapter?.subject?.main_subject?.name || '—'; const e = a[pn] || (a[pn] = { program: pn, total: 0, completed: 0 }); e.total++; if ((r.review_status || 'open') === 'completed') e.completed++; return a }, {}))
  const drawers = <>
    {open && <MentorPrepDrawer row={open} canEdit={(isAdmin || (isMentor && open.mentor_id === person.id)) && (open.review_status || 'open') === 'open'} canLead={canManage && !isMentor} onClose={() => setOpen(null)} onSaved={load} />}
    {histTopic && <TopicHistory topicId={histTopic.id} topicName={histTopic.name} onClose={() => setHistTopic(null)} />}
    {rateRow && <MentorRateDrawer row={rateRow} onClose={() => setRateRow(null)} onSaved={load} />}
    <Modal open={progPop} title="Programs in prep" footer={null} onCancel={() => setProgPop(false)}>
      {progAgg.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No programs in prep yet" /> : (progAgg as any[]).map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f0f0f0' }}>
          <b>{p.program}</b><span style={{ fontSize: 13, color: '#69707d' }}>{p.completed}/{p.total} completed · {p.total - p.completed} in progress</span>
        </div>
      ))}
    </Modal>
    <Modal open={assignOpen} title={`Assign ${sel.size} ${level}${sel.size === 1 ? '' : 's'} to mentors`} okText={`Assign${popMentors.size ? ` (${popMentors.size})` : ''}`} okButtonProps={{ disabled: !popMentors.size }} onOk={bulkAssign} onCancel={() => setAssignOpen(false)} forceRender>
      <div style={{ fontSize: 12, color: '#69707d', marginBottom: 12 }}>{selNodes.map((n: any) => n.label).join(', ')} · covers <b>{selTopicIds.length} published topic{selTopicIds.length === 1 ? '' : 's'}</b></div>
      <div style={{ fontSize: 12, color: '#69707d', marginBottom: 6 }}>Select one or more mentors</div>
      {eligibleMentors.length === 0 ? <div style={{ fontSize: 12, color: '#dc2626' }}>No eligible mentors — add one in People (Managing Lead). A mentor can hold multiple subjects; terminated / dropout mentors are hidden.</div>
        : eligibleMentors.map((m: any) => (
          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', fontSize: 14, borderTop: '1px solid #f0f0f0' }}>
            <Checkbox checked={popMentors.has(m.id)} onChange={() => setPopMentors(s => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n })} />
            {m.full_name}{(mentorPrograms[m.id] && mentorPrograms[m.id].size > 0) ? '' : <span style={{ fontSize: 11, color: '#9aa1ad' }}> · free (program tags on assign)</span>}
          </label>
        ))}
    </Modal>
    <Modal open={!!wd} title={<span style={{ color: '#dc2626' }}>Withdraw topic from mentor</span>} okText="Withdraw" okButtonProps={{ danger: true, disabled: !wdText.trim() }} onOk={withdraw} onCancel={() => setWd(null)} forceRender>
      <div style={{ fontSize: 13, marginBottom: 10 }}>Withdraw <b>{wd?.topic?.name}</b> from <b>{wd?.mentor?.full_name}</b>. This is recorded with your reason and removed from their active prep.</div>
      <Input.TextArea rows={3} placeholder="Reason for withdrawal (documented)…" value={wdText} onChange={e => setWdText(e.target.value)} />
    </Modal>
  </>
  if (missing) return <div><PageHead title="Mentor Management" /><Card><Empty description={<span>Run <b>RecTrack_v17.sql</b> in Supabase to enable Mentor Management (adds the mentor role + prep table).</span>} /></Card></div>
  if (isMentor) return <div><PageHead title="Mentor Management" />{kpis}{myCard}{boardCard}{drawers}</div>
  const subjectByMentor: any = {}
  rows.forEach((r: any) => { const s = r.topic?.chapter?.subject?.name; if (s && !subjectByMentor[r.mentor_id]) subjectByMentor[r.mentor_id] = s })
  // v34: a mentor can hold MULTIPLE subjects — full set per mentor for the pipeline/subject metrics
  const mentorSubjects: Record<string, Set<string>> = {}
  rows.forEach((r: any) => { const s = r.topic?.chapter?.subject?.name; if (s) (mentorSubjects[r.mentor_id] = mentorSubjects[r.mentor_id] || new Set()).add(s) })
  // per-subject count of mentors currently UNDER TRAINING (a mentor holding 2 subjects counts in both)
  const subjTraining: Record<string, number> = {}
  mentors.forEach((m: any) => {
    const b = mentorBucket(m, activeDeployedSet as Set<string>, returnedSet as Set<string>)
    if (b !== 'in_training' && b !== 'upskilling') return
    const ss = mentorSubjects[m.id]
    if (ss && ss.size) ss.forEach((s: string) => { subjTraining[s] = (subjTraining[s] || 0) + 1 })
    else subjTraining['— no subject —'] = (subjTraining['— no subject —'] || 0) + 1
  })
  const subjTrainingRows = Object.keys(subjTraining).sort((a, b) => subjTraining[b] - subjTraining[a])
  const subjTrainingCards = subjTrainingRows.length > 0 && <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
    {subjTrainingRows.map((s) => <Col xs={12} md={8} lg={6} key={s}>
      <Card styles={{ body: { padding: 14 } }}><Statistic title={<span style={{ fontSize: 12 }}>{s}</span>} value={subjTraining[s]} suffix={<span style={{ fontSize: 11, color: '#9aa1ad' }}>under training</span>} valueStyle={{ color: '#d97706', fontWeight: 800, fontSize: 22 }} /></Card>
    </Col>)}
  </Row>
  return <div>
    <PageHead title="My workspace" sub="Your training topics and mentor management" />
    <Tabs defaultActiveKey="content" items={[
      { key: 'content', label: 'Training topics', children: <ContentExplorer /> },
      { key: 'pipeline', label: 'Pipeline & subjects', children: <MentorPipeline mentors={mentors} mentorSubjects={mentorSubjects} deps={deps} onChanged={load} /> },
      { key: 'mentor', label: `Mentor under training (${trainingCount})`, children: <div>{kpis}{subjTrainingCards}<Tabs defaultActiveKey="prep" items={[
        { key: 'prep', label: 'Preparation board', children: <div>{assignCard}{boardCard}</div> },
        { key: 'daily', label: 'Daily corporate etiquette', children: dailyCard },
      ]} /></div> },
      { key: 'deployed', label: `Mentors deployed (${bcount.deployed || 0})`, children: <MentorDeployments mentors={mentors} mode="deployed" subjectOf={subjectByMentor} /> },
      { key: 'bench', label: `Mentors Back to bench (${bcount.bench || 0})`, children: <MentorDeployments mentors={mentors} mode="bench" subjectOf={subjectByMentor} /> },
      { key: 'holidays', label: 'Attendance & Holidays', children: <Tabs defaultActiveKey="att" items={[
        { key: 'att', label: 'Daily attendance', children: <MentorAttendance mentors={mentors} /> },
        { key: 'hol', label: 'Holidays', children: <MentorHolidays mentors={mentors} /> },
      ]} /> },
      { key: 'analytics', label: 'Mentor analytics', children: <MentorAnalytics /> },
    ]} />
    {drawers}
  </div>
}

/* ===================== reviews (two gates + quality) ===================== */
function QualitySelect({ contentItemId, value, reload }: any) {
  const { message: msg } = AntApp.useApp()
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return <Select size="small" value={v} placeholder="rate" style={{ width: 130 }}
    onChange={async (val) => {
      const prev = v; setV(val)
      const { data, error } = await supabase.from('video_version').upsert({ content_item_id: contentItemId, version_no: 1, quality_rating: val }, { onConflict: 'content_item_id,version_no' }).select('id')
      if (error) { setV(prev); msg.error(error.message); return }
      if (!data || !data.length) { setV(prev); msg.error("Couldn't save — your role doesn't have edit access to Reviews. The Program Head can grant it in Manage → Menu access."); return }
      reload && reload()
    }}
    options={QUALITY_OPTS.map(o => ({ value: o, label: o }))} />
}
function FeedbackCell({ contentItemId, value, reload }: any) {
  const { message: msg } = AntApp.useApp()
  const [v, setV] = useState(value || '')
  useEffect(() => setV(value || ''), [value])
  async function commit() {
    if ((value || '') === v) return
    const { error } = await supabase.from('video_version').upsert({ content_item_id: contentItemId, version_no: 1, feedback: v.trim() || null }, { onConflict: 'content_item_id,version_no' })
    if (error) { msg.error(/feedback/.test(error.message) ? 'Run RecTrack_v5.sql to enable feedback.' : error.message); return }
    reload && reload()
  }
  return <Input.TextArea size="small" value={v} onChange={e => setV(e.target.value)} onBlur={commit} autoSize={{ minRows: 1, maxRows: 4 }} placeholder="Reviewer notes — audio, lighting, pacing…" style={{ width: 260 }} />
}
function Reviews() {
  const { message: msg } = AntApp.useApp()
  const { person, seesAll } = useAuth()
  // Non-admin reviewers/leads see ONLY items in their assigned scope, so the queue AND the
  // Program/Subject/Chapter/Topic pickers stay limited to their programs (e.g. Navya = Python).
  const scoped = person?.role !== 'admin' && !seesAll
  const [items, setItems] = useState<any>(null)
  const [visIds, setVisIds] = useState<Set<string> | null>(null)
  const [qmap, setQmap] = useState<any>({})
  const [fmap, setFmap] = useState<any>({})
  const [stageDates, setStageDates] = useState<any>({}) // content_item_id -> { shooting, review } completed dates
  const [trainerMap, setTrainerMap] = useState<any>({}) // content_item_id -> owning trainer name
  const [foMap, setFoMap] = useState<any>({})           // content_item_id -> editor's final_output status
  const [programF, setProgramF] = useState<any>(null); const [subjectF, setSubjectF] = useState<any>(null)
  const [chap, setChap] = useState<any>(null); const [topicF, setTopicF] = useState<any>(null)
  async function load() {
    const all = await fetchAllItems()
    setItems(all)
    if (scoped && person?.id) { const inScope = await buildScope(person); setVisIds(new Set(all.filter(inScope).map((i: any) => i.id))) }
    else setVisIds(null)
    let v = await supabase.from('video_version').select('content_item_id, quality_rating, feedback')
    if (v.error) v = await supabase.from('video_version').select('content_item_id, quality_rating')
    const m: any = {}; const fm: any = {}
    ;(v.data || []).forEach((x: any) => { m[x.content_item_id] = x.quality_rating; fm[x.content_item_id] = x.feedback })
    setQmap(m); setFmap(fm)
    // stage completion dates (Shooting completed, Shooting-Review date) + the owning trainer
    const isr = await selectAll('item_stage', 'content_item_id, completed_on, stage:stage_id(code)')
    const dm: any = {}; isr.forEach((x: any) => { const c = x.stage?.code; if (!c || !x.content_item_id) return; const e = dm[x.content_item_id] = dm[x.content_item_id] || {}; if (c === 'SHOOTING') e.shooting = x.completed_on; if (c === 'SHOOT_REVIEW') e.review = x.completed_on }); setStageDates(dm)
    const ow = await selectAll('v_item_owner', 'content_item_id, trainer_id')
    const ppl = await supabase.from('person').select('id, full_name'); const nm: any = {}; (ppl.data || []).forEach((p: any) => nm[p.id] = p.full_name)
    const tm: any = {}; ow.forEach((o: any) => { if (o.trainer_id && o.content_item_id) tm[o.content_item_id] = nm[o.trainer_id] || null }); setTrainerMap(tm)
    // the editor's final-output status per sub-topic (so reviewers see "Output completed" etc.)
    const et = await selectAll('editing_task', 'content_item_id, final_output')
    const fom: any = {}; et.forEach((x: any) => { if (x.content_item_id) fom[x.content_item_id] = x.final_output || 'Pending' }); setFoMap(fom)
  }
  useEffect(() => { load() }, [])
  // Approve → mark the review complete so the sub-topic becomes Published.
  async function approve(r: any) {
    try {
      if (r.byCode.SHOOT_REVIEW?.id) await setItemStage(r.byCode.SHOOT_REVIEW.id, 'Completed')
      if (r.byCode.FINAL_REVIEW?.id) await setItemStage(r.byCode.FINAL_REVIEW.id, 'Completed')
      msg.success('Approved → Published ✓'); load()
    } catch (e: any) { msg.error(e.message) }
  }
  // Reject → send it back to the trainer to re-record (Shooting reopens, Editing resets).
  async function reject(r: any) {
    try {
      if (r.byCode.SHOOTING?.id) await setItemStage(r.byCode.SHOOTING.id, 'In Progress')
      if (r.byCode.EDITING?.id) await setItemStage(r.byCode.EDITING.id, 'Not Started')
      msg.success('Sent back to the trainer to re-record'); load()
    } catch (e: any) { msg.error(e.message) }
  }
  if (!items || (scoped && visIds === null)) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  // ONE review across the portal: after Editing is completed, approve to publish or reject back to the trainer.
  // Scoped users only ever see/approve items inside their assigned scope (drives the pickers too).
  const base = items.filter((i: any) => i.byCode.EDITING?.status === 'Completed' && i.byCode.FINAL_REVIEW?.status !== 'Completed' && (!scoped || (!!visIds && visIds.has(i.id))))
  const programs = [...new Set(base.map((i: any) => i.program))].filter(Boolean)
  const subjects = [...new Set(base.filter((i: any) => !programF || i.program === programF).map((i: any) => i.subject))].filter(Boolean)
  const chapters = [...new Set(base.filter((i: any) => (!programF || i.program === programF) && (!subjectF || i.subject === subjectF)).map((i: any) => i.chapter))].filter(Boolean)
  const topics = [...new Set(base.filter((i: any) => (!programF || i.program === programF) && (!subjectF || i.subject === subjectF) && (!chap || i.chapter === chap)).map((i: any) => i.topic))].filter(Boolean)
  const queue = base.filter((i: any) => (!programF || i.program === programF) && (!subjectF || i.subject === subjectF) && (!chap || i.chapter === chap) && (!topicF || i.topic === topicF))
  const fmtDate = (v: any) => v ? dayjs(v).format('DD MMM YYYY') : <span style={{ color: '#9aa1ad' }}>—</span>
  const cols = [
    { title: 'Sub-topic', render: (_: any, r: any) => nameCell(r) },
    { title: 'Trainer', width: 140, render: (_: any, r: any) => trainerMap[r.id] || <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Editor output', width: 150, render: (_: any, r: any) => { const s = foMap[r.id] || 'Pending'; return <Tag color={FO_COLOR[s] || 'default'}>{s}</Tag> } },
    { title: 'Shooting completed', width: 140, render: (_: any, r: any) => fmtDate(stageDates[r.id]?.shooting) },
    { title: 'Reviewer date', width: 130, render: (_: any, r: any) => fmtDate(stageDates[r.id]?.review) },
    { title: 'Recording quality', width: 150, render: (_: any, r: any) => <QualitySelect contentItemId={r.id} value={qmap[r.id]} reload={load} /> },
    { title: 'Reviewer feedback', render: (_: any, r: any) => <FeedbackCell contentItemId={r.id} value={fmap[r.id]} reload={load} /> },
    { title: 'Decision', width: 190, render: (_: any, r: any) => <span style={{ display: 'flex', gap: 8 }}>
      <Button size="small" type="primary" onClick={() => approve(r)}>Approve</Button>
      <Popconfirm title="Send back to the trainer to re-record?" okText="Reject" cancelText="Cancel" okButtonProps={{ danger: true }} onConfirm={() => reject(r)}><Button size="small" danger>Reject</Button></Popconfirm>
    </span> },
    { title: 'Overall', dataIndex: 'completion', width: 120, render: (v: number) => <Progress percent={v} size="small" strokeColor="#f59e0b" /> },
  ]
  return <div>
    <PageHead title="Reviews & Approvals" sub="One review after editing — Approve to publish, Reject sends it back to the trainer" />
    <Card styles={{ body: { padding: 16 } }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <Select placeholder="Program" allowClear showSearch style={{ minWidth: 150 }} value={programF} onChange={(v) => { setProgramF(v); setSubjectF(null); setChap(null); setTopicF(null) }} options={programs.map((p: any) => ({ value: p, label: p }))} />
        <Select placeholder="Subject" allowClear showSearch disabled={!programF} style={{ minWidth: 150 }} value={subjectF} onChange={(v) => { setSubjectF(v); setChap(null); setTopicF(null) }} options={subjects.map((s: any) => ({ value: s, label: s }))} />
        <Select placeholder="Chapter" allowClear showSearch disabled={!subjectF} style={{ minWidth: 140 }} value={chap} onChange={(v) => { setChap(v); setTopicF(null) }} options={chapters.map((c: any) => ({ value: c, label: c }))} />
        <Select placeholder="Topic" allowClear showSearch disabled={!chap} style={{ minWidth: 140 }} value={topicF} onChange={setTopicF} options={topics.map((t: any) => ({ value: t, label: t }))} />
        <div style={{ marginLeft: 'auto', alignSelf: 'center', color: '#9aa1ad', fontSize: 12 }}>{queue.length} shown</div>
      </div>
      <Table columns={cols as any} dataSource={queue.map((r: any) => ({ ...r, key: r.id }))} pagination={{ pageSize: 12 }} locale={{ emptyText: <Empty description="Nothing waiting for review" /> }} />
    </Card>
  </div>
}

/* ===================== slot edit ===================== */
function SlotEdit({ slot, onClose, onSaved }: any) {
  const { message: msg } = AntApp.useApp()
  const { person } = useAuth()
  // Program Head always; a trainer may manage their OWN slot (update status etc.) through the whole recording lifecycle. They cannot add/delete slots or touch others' slots.
  const isAdmin = person?.role === 'admin'
  const canEdit = isAdmin || slot.trainer_id === person?.id
  const [ss, setSs] = useState(slot.slot_status)
  const [rs, setRs] = useState(slot.recording_status)
  const [reason, setReason] = useState(slot.reason_missed || undefined)
  const [revised, setRevised] = useState<any>(slot.revised_date ? dayjs(slot.revised_date) : null)
  const [saving, setSaving] = useState(false)
  const [ci, setCi] = useState<any>(slot.content_item_id || undefined)
  const [tid, setTid] = useState<any>(slot.trainer_id || undefined) // assigned trainer — only the Program Head can change it
  const [trainers, setTrainers] = useState<any[]>([])
  const [bSubj, setBSubj] = useState<any>(); const [bChap, setBChap] = useState<any>(); const [bTopic, setBTopic] = useState<any>()
  const [subsList, setSubsList] = useState<any[]>([])
  useEffect(() => { (async () => { const c = await selectAll('content_item', 'id, subtopic:subtopic_id(name, topic:topic_id(name, chapter:chapter_id(name, subject:subject_id(name))))'); setSubsList((c || []).map((x: any) => ({ value: x.id, label: x.subtopic?.name, subject: x.subtopic?.topic?.chapter?.subject?.name, chapter: x.subtopic?.topic?.chapter?.name, topic: x.subtopic?.topic?.name })).filter((x: any) => x.label)) })() }, [])
  useEffect(() => { (async () => { const t = await supabase.from('person').select('id, full_name').eq('role', 'trainer').eq('is_active', true).order('full_name'); setTrainers(t.data || []) })() }, [])
  // always show the slot's current trainer as an option, even if inactive / not in the active list
  const trainerOpts = (() => {
    const opts = trainers.map((t: any) => ({ value: t.id, label: t.full_name }))
    if (slot.trainer_id && !opts.some((o: any) => o.value === slot.trainer_id)) opts.unshift({ value: slot.trainer_id, label: slot.trainer?.full_name || 'Current trainer' })
    return opts
  })()
  const isMissed = ss === 'Missed' || ss === 'Swapped' || ss === 'Rescheduled'
  async function save() {
    // trainers must say WHAT they recorded — the sub-topic is mandatory for them (admins may leave a slot unassigned)
    if (!isAdmin && !ci) { msg.warning('Pick what to record (the sub-topic) before saving.'); return }
    setSaving(true)
    const patch: any = { slot_status: ss, recording_status: rs, content_item_id: ci || null, reason_missed: isMissed ? reason : null, revised_date: isMissed && revised ? revised.format('YYYY-MM-DD') : null }
    if (isAdmin) patch.trainer_id = tid || null // only the Program Head reassigns the trainer
    const { data, error } = await supabase.from('slot').update(patch).eq('id', slot.id).select('id')
    setSaving(false)
    if (error) { msg.error(error.message); return }
    if (!data || !data.length) { msg.error('Couldn’t save — only the Program Head can change slots.'); return }
    msg.success('Slot updated ✓'); onSaved()
  }
  const lbl: any = { fontSize: 12, fontWeight: 600, color: '#69707d', margin: '10px 0 4px' }
  return (
    <Modal open title={`${canEdit ? 'Update' : 'View'} slot — ${slot.content_item?.subtopic?.name || 'recording'}`} onOk={save} confirmLoading={saving} onCancel={onClose} okText="Save" okButtonProps={{ style: canEdit ? undefined : { display: 'none' } }} cancelText={canEdit ? 'Cancel' : 'Close'}>
      {!canEdit && <div style={{ background: '#fff7e6', border: '1px solid #ffe0a3', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13 }}>View only — studio slots are booked and changed by the Program Head.</div>}
      <div style={{ marginTop: 8 }}>
        <div style={lbl}>Slot status</div>
        <Select disabled={!canEdit} value={ss} onChange={setSs} style={{ width: '100%' }} options={SLOT_STATUS_OPTS.map(o => ({ value: o, label: o }))} />
        <div style={lbl}>Recording status</div>
        <Select disabled={!canEdit} value={rs} onChange={setRs} style={{ width: '100%' }} options={REC_OPTS.map(o => ({ value: o, label: o }))} />
        <div style={lbl}>Trainer name <span style={{ fontWeight: 400, color: '#9aa1ad' }}>— {isAdmin ? 'only the Program Head can change this' : 'set by the Program Head'}</span></div>
        <Select disabled={!isAdmin} value={tid} onChange={setTid} allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="Assign a trainer" options={trainerOpts} />
        <div style={lbl}>What to record {!isAdmin && <span style={{ color: '#dc2626' }} title="Required">*</span>} <span style={{ fontWeight: 400, color: '#9aa1ad' }}>— narrow by Subject → Chapter → Topic</span></div>
        <Row gutter={8}>
          <Col span={8}><Select allowClear showSearch placeholder="Subject" disabled={!canEdit} style={{ width: '100%' }} value={bSubj} onChange={(v) => { setBSubj(v); setBChap(undefined); setBTopic(undefined); setCi(undefined) }} options={[...new Set(subsList.map((s: any) => s.subject))].filter(Boolean).map((s: any) => ({ value: s, label: s }))} /></Col>
          <Col span={8}><Select allowClear showSearch placeholder="Chapter" disabled={!canEdit || !bSubj} style={{ width: '100%' }} value={bChap} onChange={(v) => { setBChap(v); setBTopic(undefined); setCi(undefined) }} options={[...new Set(subsList.filter((s: any) => !bSubj || s.subject === bSubj).map((s: any) => s.chapter))].filter(Boolean).map((s: any) => ({ value: s, label: s }))} /></Col>
          <Col span={8}><Select allowClear showSearch placeholder="Topic" disabled={!canEdit || !bChap} style={{ width: '100%' }} value={bTopic} onChange={(v) => { setBTopic(v); setCi(undefined) }} options={[...new Set(subsList.filter((s: any) => (!bSubj || s.subject === bSubj) && (!bChap || s.chapter === bChap)).map((s: any) => s.topic))].filter(Boolean).map((s: any) => ({ value: s, label: s }))} /></Col>
        </Row>
        <div style={lbl}>Sub-topic to record {!isAdmin && <span style={{ color: '#dc2626' }} title="Required">*</span>}</div>
        <Select allowClear showSearch optionFilterProp="label" disabled={!canEdit} style={{ width: '100%' }} value={ci} onChange={setCi} placeholder="Pick the sub-topic" status={!isAdmin && !ci ? 'error' : undefined} options={subsList.filter((s: any) => (!bSubj || s.subject === bSubj) && (!bChap || s.chapter === bChap) && (!bTopic || s.topic === bTopic))} />
        {isMissed && <>
          <div style={lbl}>Reason (names the defaulter)</div>
          <Select disabled={!canEdit} value={reason} onChange={setReason} style={{ width: '100%' }} placeholder="Why was it missed?" options={REASONS.map(o => ({ value: o, label: o }))} />
          <div style={lbl}>Revised recording date</div>
          <DatePicker disabled={!canEdit} value={revised} onChange={setRevised} style={{ width: '100%' }} />
        </>}
      </div>
    </Modal>
  )
}

/* ===================== Weekly Goals (trainers & editors) ===================== */
// Monday (00:00) of the week containing d — dayjs week starts Sunday, so normalise.
const mondayOf = (d: any) => d.subtract((d.day() + 6) % 7, 'day').startOf('day')
const GOAL_KINDS: { value: 'recording' | 'editing'; label: string }[] = [
  { value: 'recording', label: 'Trainers · recording' },
  { value: 'editing', label: 'Editors · editing' },
]
// Drop already-completed sub-topics from the goal picker tree (so a done item can never be re-selected),
// but KEEP any that are already part of the current goal (keepSet) so existing goals don't lose items.
// Empty parent nodes (all children pruned) are removed too.
function pruneDoneTree(nodes: any[], done: Set<string>, keep: Set<string>): any[] {
  return (nodes || []).map((n: any) => {
    if (n.isLeaf) { const id = String(n.key).slice(3); return (keep.has(id) || !done.has(id)) ? n : null }
    const kids = pruneDoneTree(n.children || [], done, keep)
    return kids.length ? { ...n, children: kids } : null
  }).filter(Boolean)
}
function WeeklyGoals() {
  const { person } = useAuth()
  const { message: msg } = AntApp.useApp()
  const isAdmin = person?.role === 'admin'
  const [week, setWeek] = useState<any>(mondayOf(dayjs()))
  const [kind, setKind] = useState<'recording' | 'editing'>('recording')
  const [programId, setProgramId] = useState<any>(null)
  const [programs, setPrograms] = useState<any[]>([])
  const [topicMeta, setTopicMeta] = useState<any>({})        // topicId -> { name, subject, chapter, program, programId, ciIds:[] }
  const [treeByProgram, setTreeByProgram] = useState<any>({}) // programId -> antd treeData (Subject → Chapter → Topic)
  const [goals, setGoals] = useState<any[]>([])              // weekly_goal rows for the week (with topicIds)
  const [recSet, setRecSet] = useState<Set<string>>(new Set())
  const [editSet, setEditSet] = useState<Set<string>>(new Set())
  const [recEver, setRecEver] = useState<Set<string>>(new Set()) // sub-topics recorded (Shooting/Review done) EVER, any week
  const [editEver, setEditEver] = useState<Set<string>>(new Set()) // sub-topics edited (Editing done) EVER, any week
  const [prevGoals, setPrevGoals] = useState<any[]>([])           // the PREVIOUS week's goals (for carry-forward)
  const [ownerMap, setOwnerMap] = useState<any>({})  // content_item_id -> trainer_id (who owns the sub-topic)
  const [names, setNames] = useState<any>({})        // person_id -> full_name
  const [checked, setChecked] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [missing, setMissing] = useState(false)
  const weekStart = week.format('YYYY-MM-DD')
  const weekEnd = week.add(7, 'day').format('YYYY-MM-DD')

  // static: programs, per-sub-topic (content_item) meta, and the create-picker trees down to sub-topic
  async function loadStatic() {
    const ci = await selectAll('content_item', 'id, subtopic:subtopic_id(name, topic:topic_id(id, name, chapter:chapter_id(name, subject:subject_id(name, main_subject:main_subject_id(id, name)))))')
    const meta: any = {}; const progs: any = {}; const raw: any = {}
    ;(ci || []).forEach((x: any) => {
      const t = x.subtopic?.topic; if (!t?.id) return
      const prog = t.chapter?.subject?.main_subject; const subjN = t.chapter?.subject?.name || '—'; const chapN = t.chapter?.name || '—'; const stN = x.subtopic?.name || '—'
      if (prog?.id) progs[prog.id] = prog.name
      meta[x.id] = { name: stN, topicName: t.name, subject: subjN, chapter: chapN, program: prog?.name, programId: prog?.id, topicId: t.id }
      if (prog?.id) { const P = raw[prog.id] || (raw[prog.id] = {}); const S = P[subjN] || (P[subjN] = {}); const C = S[chapN] || (S[chapN] = {}); const T = C[t.name] || (C[t.name] = {}); T[x.id] = stN }
    })
    setTopicMeta(meta)
    setPrograms(Object.entries(progs).map(([id, name]) => ({ id, name })).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name))))
    const trees: any = {}
    Object.entries(raw).forEach(([pid, subs]: any) => {
      trees[pid] = Object.entries(subs).sort((a: any, b: any) => a[0].localeCompare(b[0])).map(([sName, chaps]: any) => ({
        title: sName, key: 's_' + pid + '_' + sName, selectable: false,
        children: Object.entries(chaps).sort((a: any, b: any) => a[0].localeCompare(b[0])).map(([cName, tops]: any) => ({
          title: cName, key: 'c_' + pid + '_' + sName + '_' + cName, selectable: false,
          children: Object.entries(tops).sort((a: any, b: any) => a[0].localeCompare(b[0])).map(([tName, sts]: any) => ({
            title: tName, key: 'top_' + pid + '_' + sName + '_' + cName + '_' + tName, selectable: false,
            children: Object.entries(sts).sort((a: any, b: any) => String(a[1]).localeCompare(String(b[1]))).map(([ciId, stName]: any) => ({ title: stName, key: 'ci_' + ciId, isLeaf: true })),
          })),
        })),
      }))
    })
    setTreeByProgram(trees)
    // who owns each sub-topic + person names → lets us attribute weekly-goal progress to trainers
    const ow = await selectAll('v_item_owner', 'content_item_id, trainer_id')
    const om: any = {}; ow.forEach((o: any) => { if (o.content_item_id && o.trainer_id) om[o.content_item_id] = o.trainer_id })
    const ppl = await supabase.from('person').select('id, full_name')
    const nm: any = {}; (ppl.data || []).forEach((p: any) => nm[p.id] = p.full_name)
    setOwnerMap(om); setNames(nm)
    // sub-topics that are ALREADY completed (any week) — recording = Shooting or Shooting Review done,
    // editing = Editing done. Used to drop them from future goals (never carry / re-select a done item).
    const allI = await fetchAllItems()
    const re = new Set<string>(); const ee = new Set<string>()
    allI.forEach((it: any) => { if (it.byCode.SHOOTING?.status === 'Completed' || it.byCode.SHOOT_REVIEW?.status === 'Completed') re.add(it.id); if (it.byCode.EDITING?.status === 'Completed') ee.add(it.id) })
    setRecEver(re); setEditEver(ee)
  }
  // week-bound: the goals plus what was actually recorded / edited that week
  async function loadWeek() {
    setBusy(true)
    const prevStart = week.subtract(7, 'day').format('YYYY-MM-DD') // previous week, for carry-forward
    if (MOCK_GOALS) {
      setMissing(false); setGoals(mockListGoals(weekStart).map((g: any) => ({ ...g, itemIds: g.topicIds || [] }))) // local-only: goals from this browser
      setPrevGoals(mockListGoals(prevStart).map((g: any) => ({ ...g, itemIds: g.topicIds || [] })))
    }
    else {
      const g = await supabase.from('weekly_goal').select('id, program_id, week_start, kind, weekly_goal_item(content_item_id)').eq('week_start', weekStart)
      if (g.error) { setMissing(true); setGoals([]); setBusy(false); return }
      setMissing(false)
      setGoals((g.data || []).map((x: any) => ({ ...x, itemIds: (x.weekly_goal_item || []).map((t: any) => t.content_item_id) })))
      const pg = await supabase.from('weekly_goal').select('id, program_id, week_start, kind, weekly_goal_item(content_item_id)').eq('week_start', prevStart)
      setPrevGoals(pg.error ? [] : (pg.data || []).map((x: any) => ({ ...x, itemIds: (x.weekly_goal_item || []).map((t: any) => t.content_item_id) })))
    }
    // recording goals → a sub-topic is achieved IN THE WEEK it was RECORDED: its Shooting stage
    // is Completed (recording done → the sub-topic reaches "Shooting Review"), OR its Shooting
    // Review stage is Completed. Attribution is week-strict: the completion counts only in the
    // week its completed_on falls in, so an item finished in an earlier week shows completed in
    // THAT earlier week, not carried forward into later weeks.
    const sr = await supabase.from('stage').select('id, code').in('code', ['SHOOTING', 'SHOOT_REVIEW'])
    const recStageIds = (sr.data || []).map((s: any) => s.id)
    let recRows: any[] = []
    if (recStageIds.length) { const is = await supabase.from('item_stage').select('content_item_id, completed_on').in('stage_id', recStageIds).eq('status', 'Completed').gte('completed_on', weekStart).lt('completed_on', weekEnd); recRows = is.data || [] }
    setRecSet(new Set(recRows.filter((x: any) => x.content_item_id).map((x: any) => x.content_item_id)))
    let et: any = await supabase.from('editing_task').select('content_item_id, completed_at, final_output').in('final_output', FO_DONE)
    if (et.error) et = await supabase.from('editing_task').select('content_item_id, final_output').in('final_output', FO_DONE)
    const wStart = week.toISOString(); const wEnd = week.add(7, 'day').toISOString()
    setEditSet(new Set((et.data || []).filter((e: any) => e.content_item_id && (e.completed_at === undefined || (e.completed_at && e.completed_at >= wStart && e.completed_at < wEnd))).map((e: any) => e.content_item_id)))
    setBusy(false)
  }
  useEffect(() => { (async () => { await loadStatic(); setLoaded(true) })() }, [])
  useEffect(() => { loadWeek() }, [weekStart])
  // Seed the picker: if a goal already exists for this week, use it. Otherwise CARRY FORWARD the
  // previous week's sub-topics that are STILL not completed (finished ones drop off). The admin
  // reviews the carried-over selection and Saves to confirm.
  useEffect(() => {
    const g = goals.find((x: any) => x.program_id === programId && x.kind === kind)
    if (g) { setChecked((g.itemIds || []).map((id: string) => 'ci_' + id)); return }
    const pg = prevGoals.find((x: any) => x.program_id === programId && x.kind === kind)
    const done = kind === 'recording' ? recEver : editEver
    const carry = (pg?.itemIds || []).filter((id: string) => !done.has(id)) // unfinished only
    setChecked(carry.map((id: string) => 'ci_' + id))
  }, [programId, kind, goals, prevGoals, recEver, editEver])

  // each goal item is a SUB-TOPIC (content_item): met when it was recorded / edited that week
  const goalItems = (g: any) => (g?.itemIds || []).map((id: string) => ({ id, ...(topicMeta[id] || { name: '(removed sub-topic)' }), trainer: names[ownerMap[id]] || null, met: (kind === 'recording' ? recSet : editSet).has(id) }))
    .sort((a: any, b: any) => (a.subject || '').localeCompare(b.subject || '') || (a.topicName || '').localeCompare(b.topicName || '') || (a.name || '').localeCompare(b.name || ''))
  // goal picker with already-completed sub-topics removed (keep any that are already in this week's goal)
  const pickerDone = kind === 'recording' ? recEver : editEver
  const pickerKeep = new Set<string>((goals.find((x: any) => x.program_id === programId && x.kind === kind)?.itemIds) || [])
  const pickerTree = programId ? pruneDoneTree(treeByProgram[programId] || [], pickerDone, pickerKeep) : []

  async function saveGoal() {
    if (!programId) { msg.warning('Pick a program first.'); return }
    const itemIds = checked.filter((k: string) => k.startsWith('ci_')).map((k: string) => k.slice(3))
    setSaving(true)
    if (MOCK_GOALS) { mockSaveGoal(programId, weekStart, kind, itemIds); setSaving(false); msg.success(`Weekly goal saved in this browser (mock) — ${itemIds.length} sub-topic(s) ✓`); loadWeek(); return }
    const up = await supabase.from('weekly_goal').upsert({ program_id: programId, week_start: weekStart, kind, created_by: person?.id || null }, { onConflict: 'program_id,week_start,kind' }).select('id').maybeSingle()
    if (up.error || !up.data) { setSaving(false); msg.error(up.error?.message?.includes('weekly_goal') ? 'Run RecTrack_v26_weekly_goals.sql first.' : (up.error?.message || 'Could not save the goal.')); return }
    const gid = up.data.id
    await supabase.from('weekly_goal_item').delete().eq('goal_id', gid)
    if (itemIds.length) {
      const ins = await supabase.from('weekly_goal_item').insert(itemIds.map((cid: string) => ({ goal_id: gid, content_item_id: cid })))
      if (ins.error) { setSaving(false); msg.error(/weekly_goal_item|relation|does not exist/.test(ins.error.message) ? 'Re-run RecTrack_v26_weekly_goals.sql (adds the sub-topic table).' : ins.error.message); return } }
    setSaving(false); msg.success(`Weekly goal saved — ${itemIds.length} sub-topic(s) ✓`); loadWeek()
  }

  if (!loaded) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  const kindLabel = kind === 'recording' ? 'recorded' : 'edited'
  const kindGoals = goals.filter((g: any) => g.kind === kind)
  const selGoal = programId ? kindGoals.find((g: any) => g.program_id === programId) : null
  // overall numbers for the current view (selected program, or all programs of this kind)
  const viewGoals = programId ? (selGoal ? [selGoal] : []) : kindGoals
  const allItems = viewGoals.flatMap((g: any) => goalItems(g))
  const metCount = allItems.filter((t: any) => t.met).length
  const pct = allItems.length ? Math.round((metCount / allItems.length) * 100) : 0
  // per-trainer performance on THIS week's goal sub-topics (who owns them, how many they got done)
  const byTrainer: any = {}
  allItems.forEach((t: any) => { const nm = t.trainer || 'Unassigned'; const e = byTrainer[nm] = byTrainer[nm] || { name: nm, assigned: 0, achieved: 0, unassigned: !t.trainer, subjects: new Set() }; e.assigned++; if (t.met) e.achieved++; if (t.subject) e.subjects.add(t.subject) })
  const trainerPerf = (Object.values(byTrainer) as any[]).map((e: any) => ({ ...e, subjects: [...e.subjects], pct: e.assigned ? Math.round(e.achieved / e.assigned * 100) : 0, done: e.assigned > 0 && e.achieved === e.assigned }))
    // achievers first (fully hit their target), then those closest to the target, then unassigned last
    .sort((a: any, b: any) => (a.unassigned ? 1 : 0) - (b.unassigned ? 1 : 0) || (b.done ? 1 : 0) - (a.done ? 1 : 0) || b.pct - a.pct || b.achieved - a.achieved)
  const maxAch = trainerPerf.reduce((m: number, e: any) => e.unassigned ? m : Math.max(m, e.achieved), 0)
  const stat: any = { background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 10, padding: '8px 16px' }
  const lbl: any = { fontSize: 11, color: '#69707d' }
  const big: any = { fontSize: 20, fontWeight: 800 }

  const itemCols = [
    { title: 'Sub-topic', render: (_: any, r: any) => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 11, color: '#9aa1ad' }}>{[r.subject, r.chapter, r.topicName].filter(Boolean).join(' › ')}</div></div> },
    { title: 'Trainer', width: 170, render: (_: any, r: any) => r.trainer ? <span><Avatar size={20} style={{ background: '#c2410c', marginRight: 6, fontSize: 10 }}>{(r.trainer || '?')[0]}</Avatar>{r.trainer}</span> : <span style={{ color: '#9aa1ad' }}>Unassigned</span> },
    { title: 'Status', dataIndex: 'met', width: 150, render: (v: boolean) => v ? <Tag color="green">Achieved ({kindLabel})</Tag> : <Tag color="orange">Pending</Tag> },
  ]
  const progCols = [
    { title: 'Program', dataIndex: 'program_id', render: (pid: string) => <b>{programs.find((p: any) => p.id === pid)?.name || '—'}</b> },
    { title: 'Sub-topics', render: (_: any, g: any) => goalItems(g).length },
    { title: 'Achieved', render: (_: any, g: any) => { const ts = goalItems(g); const m = ts.filter((t: any) => t.met).length; return <span>{m} / {ts.length}</span> } },
    { title: '% met', width: 160, render: (_: any, g: any) => { const ts = goalItems(g); const p = ts.length ? Math.round(ts.filter((t: any) => t.met).length / ts.length * 100) : 0; return <Progress percent={p} size="small" strokeColor={p === 100 ? '#16a34a' : PRIMARY} /> } },
  ]

  return (
    <div>
      <PageHead title="Weekly Goals" sub="Per-program recording & editing targets for the week — pick the sub-topics, track what gets done"
        extra={MOCK_GOALS ? <Tag color="gold">Mock mode — goals saved in this browser only</Tag> : undefined} />
      <Card styles={{ body: { padding: 16 } }} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmented value={kind} onChange={(v: any) => setKind(v)} options={GOAL_KINDS} />
          <DatePicker picker="week" allowClear={false} value={week} onChange={(d: any) => d && setWeek(mondayOf(d))} />
          <span style={{ fontSize: 12, color: '#9aa1ad' }}>{week.format('DD MMM')} – {week.add(6, 'day').format('DD MMM YYYY')}</span>
          <Select placeholder="All programs" allowClear showSearch optionFilterProp="label" style={{ minWidth: 180 }} value={programId} onChange={setProgramId} options={programs.map((p: any) => ({ value: p.id, label: p.name }))} />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            <div style={stat}><div style={lbl}>Sub-topics targeted</div><div style={big}>{allItems.length}</div></div>
            <div style={stat}><div style={lbl}>Achieved</div><div style={{ ...big, color: '#16a34a' }}>{metCount}</div></div>
            <div style={stat}><div style={lbl}>% met</div><div style={{ ...big, color: pct === 100 ? '#16a34a' : PRIMARY }}>{pct}%</div></div>
          </div>
        </div>
      </Card>

      {missing && <Card style={{ marginBottom: 16 }}><Empty description={<span>Run <b>RecTrack_v26_weekly_goals.sql</b> in Supabase to enable Weekly Goals.</span>} /></Card>}

      {isAdmin && !missing && (
        <Card title={`Set this week's ${kind === 'recording' ? 'recording' : 'editing'} goal`} style={{ marginBottom: 16 }}
          extra={<Button type="primary" loading={saving} disabled={!programId} onClick={saveGoal}>Save goal</Button>}>
          {!programId ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pick a program above to choose its sub-topics for the week." />
            : (!treeByProgram[programId]?.length ? <Empty description="This program has no sub-topics yet." />
              : (pickerTree.length
                ? <div>
                    <div style={{ fontSize: 12, color: '#69707d', marginBottom: 8 }}>Tick the Subjects → Topics → Sub-topics that must be {kindLabel} in <b>{week.format('DD MMM')} – {week.add(6, 'day').format('DD MMM YYYY')}</b>. Already-{kindLabel} sub-topics are hidden; last week's unfinished ones are pre-ticked. <b>{checked.filter((k: string) => k.startsWith('ci_')).length}</b> selected.</div>
                    <Tree checkable selectable={false} checkedKeys={checked} onCheck={(keys: any) => setChecked(Array.isArray(keys) ? keys : keys.checked)} treeData={pickerTree} height={360} />
                  </div>
                : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`Every sub-topic in this program is already ${kindLabel} — nothing left to target.`} />))}
        </Card>
      )}

      {!missing && allItems.length > 0 && (
        <Card title="Trainer performance — this week's goal" size="small" style={{ marginBottom: 16 }}
          extra={<span style={{ fontSize: 12, color: '#9aa1ad' }}>Who owns the target sub-topics and how many they've {kindLabel}</span>}>
          <Table rowKey="name" size="small" pagination={false} dataSource={trainerPerf}
            columns={[
              { title: 'Trainer', render: (_: any, e: any) => e.unassigned ? <span style={{ color: '#9aa1ad' }}>Unassigned</span> : <span><Avatar size={22} style={{ background: '#c2410c', marginRight: 8, fontSize: 11 }}>{(e.name || '?')[0]}</Avatar>{e.name}{!e.unassigned && e.achieved === maxAch && maxAch > 0 ? <Tag color="orange" style={{ marginLeft: 8 }}>★ Top</Tag> : null}</span> },
              { title: 'Subject', width: 200, render: (_: any, e: any) => e.subjects.length ? e.subjects.join(', ') : <span style={{ color: '#9aa1ad' }}>—</span> },
              { title: 'Targeted', width: 100, render: (_: any, e: any) => e.assigned },
              { title: `Achieved (${kindLabel})`, width: 130, render: (_: any, e: any) => <b style={{ color: e.achieved ? '#16a34a' : '#9aa1ad' }}>{e.achieved}</b> },
              { title: 'Status', width: 150, render: (_: any, e: any) => e.unassigned ? <span style={{ color: '#9aa1ad' }}>—</span> : e.done ? <Tag color="green">Achieved ✓</Tag> : e.achieved > 0 ? <Tag color="orange">Reaching target</Tag> : <Tag>Not started</Tag> },
              { title: '% done', width: 200, render: (_: any, e: any) => <Progress percent={e.pct} size="small" strokeColor={e.pct === 100 ? '#16a34a' : PRIMARY} /> },
            ] as any} />
        </Card>
      )}

      {!missing && (programId
        ? <Card title={`${programs.find((p: any) => p.id === programId)?.name || 'Program'} — sub-topic status`} size="small">
            {selGoal ? <Table rowKey="id" size="small" columns={itemCols as any} dataSource={goalItems(selGoal)} pagination={{ pageSize: 15 }} loading={busy} />
              : <Empty description={`No ${kind} goal set for this program this week.`} />}
          </Card>
        : <Card title="All programs — this week" size="small">
            <Table rowKey="id" size="small" columns={progCols as any} dataSource={kindGoals} loading={busy} pagination={false}
              expandable={{ expandedRowRender: (g: any) => <Table rowKey="id" size="small" columns={itemCols as any} dataSource={goalItems(g)} pagination={false} /> }}
              locale={{ emptyText: <Empty description={`No ${kind} goals set for any program this week.`} /> }} />
          </Card>)}
    </div>
  )
}

/* ===================== SLA & delays ===================== */
function SLADelays() {
  const [breaches, setBreaches] = useState<any>(null)
  const [missed, setMissed] = useState<any>(null)
  useEffect(() => {
    (async () => {
      const b = await supabase.from('item_stage').select('id,due_on,delay_days,status, stage:stage_id(name), content_item:content_item_id(subtopic:subtopic_id(name))').eq('breached', true)
      setBreaches(b.data || [])
      const m = await supabase.from('slot').select('slot_date,start_time,slot_status,reason_missed,revised_date, studio:studio_id(name), trainer:trainer_id(full_name), content_item:content_item_id(subtopic:subtopic_id(name))').in('slot_status', ['Missed', 'Swapped', 'Rescheduled']).order('slot_date', { ascending: false })
      setMissed(m.data || [])
    })()
  }, [])
  if (!breaches || !missed) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  const bCols = [
    { title: 'Sub-topic', render: (_: any, r: any) => <b>{r.content_item?.subtopic?.name || '—'}</b> },
    { title: 'Stuck at stage', render: (_: any, r: any) => r.stage?.name },
    { title: 'Was due', dataIndex: 'due_on' },
    { title: 'Days over', dataIndex: 'delay_days', render: (v: number) => <Tag color="red">{v}d</Tag> },
  ]
  const mCols = [
    { title: 'Date', dataIndex: 'slot_date' },
    { title: 'Slot', render: (_: any, r: any) => <span>{String(r.start_time).slice(0, 5)} · {r.studio?.name}</span> },
    { title: 'Trainer', render: (_: any, r: any) => r.trainer?.full_name || '—' },
    { title: 'Sub-topic', render: (_: any, r: any) => r.content_item?.subtopic?.name || '—' },
    { title: 'Status', dataIndex: 'slot_status', render: (v: string) => <Tag color="red">{v}</Tag> },
    { title: 'Reason', dataIndex: 'reason_missed', render: (v: string) => v || '—' },
  ]
  return (
    <div>
      <PageHead title="SLA & Delays" sub="Breached stages and missed or rescheduled slots" />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><LiveTile color="#dc2626" label="Window breaches" value={breaches.length} /></Col>
        <Col xs={12} md={6}><LiveTile color="#c2790a" label="Missed / swapped slots" value={missed.length} /></Col>
      </Row>
      <Card title="Breaching the 2-day window" style={{ marginBottom: 16 }}>
        <Table size="middle" columns={bCols as any} dataSource={breaches.map((r: any) => ({ ...r, key: r.id }))} pagination={false} locale={{ emptyText: <Empty description="No breaches — all stages on time" /> }} />
      </Card>
      <Card title="Defaulters — missed, swapped or rescheduled slots">
        <Table size="middle" columns={mCols as any} dataSource={missed.map((r: any, i: number) => ({ ...r, key: i }))} pagination={false} locale={{ emptyText: <Empty description="No defaulters 🎉" /> }} />
      </Card>
    </div>
  )
}

/* ===================== my day (trainer) ===================== */
function MyDay() {
  const { person } = useAuth()
  const { message: msg } = AntApp.useApp()
  const [trainers, setTrainers] = useState<any[]>([])
  const [trainerId, setTrainerId] = useState<any>(null)
  const [date, setDate] = useState<any>(dayjs())
  const [slots, setSlots] = useState<any>(null)
  const [shootStageId, setShootStageId] = useState<any>(null)
  const [upload, setUpload] = useState<any>(null)
  const [url, setUrl] = useState('')
  const [recordedSet, setRecordedSet] = useState<Set<string>>(new Set())
  useEffect(() => {
    (async () => {
      const t = await supabase.from('person').select('id,full_name').eq('role', 'trainer').order('full_name')
      setTrainers(t.data || [])
      const stg = await supabase.from('stage').select('id').eq('code', 'SHOOTING').maybeSingle()
      setShootStageId(stg.data?.id)
      setTrainerId(person?.role === 'trainer' ? person.id : (t.data?.[0]?.id || null))
    })()
  }, [person])
  async function load() {
    if (!trainerId) { setSlots([]); return }
    const sl = await supabase.from('slot').select('id,start_time,end_time,slot_status,recording_status,content_item_id, studio:studio_id(name), content_item:content_item_id(subtopic:subtopic_id(name))').eq('slot_date', date.format('YYYY-MM-DD')).eq('trainer_id', trainerId).order('start_time')
    setSlots(sl.data || [])
    const cids = (sl.data || []).map((s: any) => s.content_item_id).filter(Boolean)
    let rec = new Set<string>()
    if (cids.length) { const vv = await supabase.from('video_version').select('content_item_id,file_link').in('content_item_id', cids); rec = new Set((vv.data || []).filter((v: any) => v.file_link).map((v: any) => v.content_item_id)) }
    setRecordedSet(rec)
  }
  useEffect(() => { load() }, [trainerId, date])
  async function doUpload() {
    if (!url.trim()) { msg.error('Paste the recording link first'); return }
    const s = upload
    const vv = await supabase.from('video_version').upsert({ content_item_id: s.content_item_id, slot_id: s.id, version_no: 1, file_link: url.trim(), recorded_on: date.format('YYYY-MM-DD') }, { onConflict: 'content_item_id,version_no' }).select('id')
    if (vv.error) { msg.error(vv.error.message); return }
    if (shootStageId) await supabase.from('item_stage').update({ status: 'Completed', completed_on: date.format('YYYY-MM-DD') }).eq('content_item_id', s.content_item_id).eq('stage_id', shootStageId)
    msg.success('Recording logged ✓ — the Program Head will close the slot.'); setUpload(null); setUrl(''); load()
  }
  return (
    <div>
      <PageHead title="My Day" sub={date.format('dddd, D MMM YYYY')}
        extra={<div style={{ display: 'flex', gap: 10 }}>
          {person?.role === 'admin' && <Select value={trainerId} onChange={setTrainerId} style={{ minWidth: 160 }} options={trainers.map(t => ({ value: t.id, label: t.full_name }))} />}
          <DatePicker value={date} onChange={(v) => v && setDate(v)} allowClear={false} />
        </div>} />
      {!slots ? <div style={{ display: 'grid', placeItems: 'center', height: 200 }}><Spin /></div>
        : slots.length === 0 ? <Card><Empty description="No slots scheduled for this day" /></Card>
          : slots.map((s: any) => (
            <Card key={s.id} style={{ marginBottom: 12 }} styles={{ body: { padding: 16 } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ textAlign: 'center', minWidth: 64 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{String(s.start_time).slice(0, 5)}</div>
                  <div style={{ fontSize: 11, color: '#9aa1ad' }}>{s.studio?.name}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{s.content_item?.subtopic?.name || 'Recording'}</div>
                  <div style={{ fontSize: 12, color: '#69707d' }}>{s.recording_status}</div>
                </div>
                {recordedSet.has(s.content_item_id) || s.slot_status === 'Completed'
                  ? <Tag color="green">Recorded ✓</Tag>
                  : <Button type="primary" onClick={() => { setUpload(s); setUrl('') }}>Add recording link</Button>}
              </div>
            </Card>
          ))}
      <Modal open={!!upload} title="Log your recording" onOk={doUpload} onCancel={() => setUpload(null)} okText="Save">
        <p style={{ color: '#69707d', fontSize: 13 }}>Paste the Google Drive / shared link. The file stays in your Drive — we just store the link.</p>
        <Input placeholder="https://drive.google.com/…" value={url} onChange={e => setUrl(e.target.value)} onPressEnter={doUpload} />
      </Modal>
    </div>
  )
}

/* ===================== curriculum helpers ===================== */
// escape LIKE wildcards so names with % or _ match literally
function escLike(s: string) { return s.replace(/([%_\\])/g, '\\$1') }
async function findOrCreateMain(name: string) {
  const n = name.trim()
  const f = await supabase.from('main_subject').select('id').eq('name', n).maybeSingle()
  if (f.data) return f.data.id
  // case-insensitive match — "Core Java" and "core java" are the same program (reused, never duplicated)
  const ci = await supabase.from('main_subject').select('id').ilike('name', escLike(n)).limit(1)
  if (ci.data && ci.data.length) return ci.data[0].id
  const r = await supabase.from('main_subject').insert({ name: n }).select('id').single()
  // the DB unique rule (v14) is the final guarantee — surface it as a clear message, not a raw error
  if (r.error) throw new Error(/duplicate|unique/i.test(r.error.message) ? `A program named “${n}” already exists — pick it from the list instead of creating a duplicate.` : r.error.message)
  return r.data.id
}
async function findOrCreateChild(table: string, parentCol: string, parentId: string, name: string) {
  const n = name.trim()
  const f = await supabase.from(table).select('id').eq(parentCol, parentId).eq('name', n).maybeSingle()
  if (f.data) return f.data.id
  const ci = await supabase.from(table).select('id').eq(parentCol, parentId).ilike('name', escLike(n)).limit(1)
  if (ci.data && ci.data.length) return ci.data[0].id
  const r = await supabase.from(table).insert({ [parentCol]: parentId, name: n }).select('id').single()
  if (r.error) throw r.error
  return r.data.id
}

/* ===================== custom fields (#2) ===================== */
function CustomFields() {
  const { message: msg } = AntApp.useApp()
  const [fields, setFields] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [ftype, setFtype] = useState('text')
  const [form] = Form.useForm()
  async function load() { setFields((await supabase.from('custom_field').select('*').order('sort')).data || []) }
  useEffect(() => { load() }, [])
  async function save() {
    const v = await form.validateFields()
    const options = ftype === 'dropdown' ? String(v.options || '').split(',').map((x: string) => x.trim()).filter(Boolean) : null
    const { error } = await supabase.from('custom_field').insert({ label: v.label, field_type: ftype, options, sort: (fields?.length || 0) + 1 })
    if (error) { msg.error(error.message); return }
    msg.success('Field added ✓'); setOpen(false); form.resetFields(); setFtype('text'); load()
  }
  async function del(id: string) { await supabase.from('custom_field').delete().eq('id', id); load() }
  if (!fields) return null
  return (
    <Card title="Custom fields (on sub-topics)" style={{ marginBottom: 16 }} extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Add field</Button>}>
      {fields.length === 0
        ? <div style={{ color: '#9aa1ad', fontSize: 13 }}>No custom fields yet. Add text / number / dropdown fields — they appear on every sub-topic (Content → click a sub-topic).</div>
        : <Table size="small" pagination={false} dataSource={fields.map((f: any) => ({ ...f, key: f.id }))}
            columns={[
              { title: 'Label', dataIndex: 'label', render: (v: string) => <b>{v}</b> },
              { title: 'Type', dataIndex: 'field_type', render: (v: string) => <Tag>{v}</Tag> },
              { title: 'Options', dataIndex: 'options', render: (v: any) => v ? v.join(', ') : '—' },
              { title: '', width: 70, render: (_: any, r: any) => <Button size="small" danger type="text" onClick={() => del(r.id)}>Remove</Button> },
            ] as any} />}
      <Modal open={open} title="Add a custom field" onOk={save} onCancel={() => setOpen(false)} okText="Add field">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="label" label="Field label" rules={[{ required: true }]}><Input placeholder="e.g. Difficulty" /></Form.Item>
          <Form.Item label="Type"><Select value={ftype} onChange={setFtype} options={[{ value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }, { value: 'dropdown', label: 'Dropdown' }]} /></Form.Item>
          {ftype === 'dropdown' && <Form.Item name="options" label="Dropdown options (comma-separated)" rules={[{ required: true }]}><Input placeholder="Easy, Medium, Hard" /></Form.Item>}
        </Form>
      </Modal>
    </Card>
  )
}

/* ===================== teams performance ===================== */
// Which trainers are performing well: their owned sub-topics that have progressed through Editing
// (recording → shooting review → editing all Completed). Shows Trainer · Subject · Status, ranks
// trainers by throughput, and blinks a spotlight on whoever is clearly ahead of the pack.
function TeamsPerformance() {
  const [items, setItems] = useState<any>(null)
  const [ownerMap, setOwnerMap] = useState<any>({}) // content_item_id -> trainer_id
  const [names, setNames] = useState<any>({})       // person_id -> full_name
  const [subjectF, setSubjectF] = useState<any>(null)
  const [q, setQ] = useState('')
  async function load() {
    const all = await fetchAllItems()
    const ow = await selectAll('v_item_owner', 'content_item_id, trainer_id')
    const om: any = {}; ow.forEach((o: any) => { if (o.content_item_id && o.trainer_id) om[o.content_item_id] = o.trainer_id })
    const ppl = await supabase.from('person').select('id, full_name')
    const nm: any = {}; (ppl.data || []).forEach((p: any) => nm[p.id] = p.full_name)
    setItems(all); setOwnerMap(om); setNames(nm)
  }
  useEffect(() => { load() }, [])
  if (!items) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  // "completed till Editing" = the Editing stage is Completed (so Shooting + Shooting Review are too)
  const done = items.filter((i: any) => i.byCode.EDITING?.status === 'Completed')
  const rows = done.map((i: any) => { const tid = ownerMap[i.id]; return { key: i.id, trainerId: tid, trainer: names[tid] || null, subject: i.subject, name: i.name, topic: i.topic, published: i.byCode.FINAL_REVIEW?.status === 'Completed' } })
    .filter((r: any) => r.trainerId && r.trainer)
  // per-trainer throughput
  const byT: any = {}
  rows.forEach((r: any) => { const e = byT[r.trainerId] = byT[r.trainerId] || { trainerId: r.trainerId, name: r.trainer, count: 0, published: 0, subjects: new Set() }; e.count++; if (r.published) e.published++; e.subjects.add(r.subject) })
  const perf = (Object.values(byT) as any[]).map((e: any) => ({ ...e, subjects: [...e.subjects] })).sort((a, b) => b.count - a.count || b.published - a.published)
  const maxCount = perf.length ? perf[0].count : 0
  const avg = perf.length ? perf.reduce((s, e) => s + e.count, 0) / perf.length : 0
  // "extraordinary" spotlights EVERY standout, not just #1: the top scorer(s) always qualify, plus
  // anyone who is both above the team average AND within reach of the leader (≥60% of the top count).
  // So a strong leading cluster all blink; a lone runaway leaves just the leader lit.
  const isStar = (e: any) => maxCount > 1 && (e.count === maxCount || (e.count > avg && e.count >= maxCount * 0.6))
  const subjects = [...new Set(rows.map((r: any) => r.subject))].filter(Boolean).sort()
  const shown = rows
    .filter((r: any) => (!subjectF || r.subject === subjectF) && (!q.trim() || String(r.trainer).toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a: any, b: any) => String(a.trainer).localeCompare(String(b.trainer)) || String(a.subject).localeCompare(String(b.subject)) || String(a.name).localeCompare(String(b.name)))
  const stars = perf.filter(isStar); const starCount = stars.length; const topName = stars.map(e => e.name).join(', ')
  const stat: any = { background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 10, padding: '10px 16px' }
  const detailCols = [
    { title: 'Trainer', width: 200, render: (_: any, r: any) => <span><Avatar size={22} style={{ background: '#c2410c', marginRight: 8, fontSize: 11 }}>{(r.trainer || '?')[0]}</Avatar>{r.trainer}{byT[r.trainerId] && isStar(byT[r.trainerId]) ? <span className="tp-blinktext" title="Extraordinary performer" style={{ marginLeft: 6 }}>🌟</span> : null}</span> },
    { title: 'Subject', width: 200, render: (_: any, r: any) => r.subject },
    { title: 'Sub-topic', render: (_: any, r: any) => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 11, color: '#9aa1ad' }}>{r.topic}</div></div> },
    { title: 'Status', width: 190, render: (_: any, r: any) => r.published ? <Tag color="green">Published (review done)</Tag> : <Tag color="blue">Completed through Editing</Tag> },
  ]
  return <div>
    <PageHead title="Teams Performance" sub="Trainers whose sub-topics have progressed through Editing (recording → review → editing done)" />
    <style>{`@keyframes tppulse{0%,100%{box-shadow:0 0 0 0 rgba(234,88,12,.55)}50%{box-shadow:0 0 0 7px rgba(234,88,12,0)}}@keyframes tpfade{50%{opacity:.25}}.tp-star{animation:tppulse 1.3s ease-in-out infinite}.tp-blinktext{animation:tpfade 1s steps(1) infinite}`}</style>
    <Row gutter={12} style={{ marginBottom: 16 }}>
      <Col span={6}><div style={stat}><div style={{ fontSize: 11, color: '#69707d' }}>Sub-topics edited</div><div style={{ fontSize: 22, fontWeight: 800 }}>{rows.length}</div></div></Col>
      <Col span={6}><div style={stat}><div style={{ fontSize: 11, color: '#69707d' }}>Trainers contributing</div><div style={{ fontSize: 22, fontWeight: 800 }}>{perf.length}</div></div></Col>
      <Col span={6}><div style={stat}><div style={{ fontSize: 11, color: '#69707d' }}>Published (review done)</div><div style={{ fontSize: 22, fontWeight: 800 }}>{rows.filter((r: any) => r.published).length}</div></div></Col>
      <Col span={6}><div style={{ ...stat, background: topName ? '#fff7ed' : '#f7f8fb', borderColor: topName ? '#fdba74' : '#eef0f3' }}><div style={{ fontSize: 11, color: '#69707d' }}>Extraordinary performers {starCount > 0 ? `(${starCount})` : ''}</div><div style={{ fontSize: 15, fontWeight: 800, color: '#ea580c', lineHeight: 1.3 }} className={topName ? 'tp-blinktext' : ''}>{topName || '—'}</div></div></Col>
    </Row>
    <Card title={<span><TrophyOutlined style={{ color: '#ea580c', marginRight: 8 }} />Top performers — sub-topics completed through Editing</span>} style={{ marginBottom: 16 }}>
      {perf.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No sub-topics have reached completed-Editing yet." /> : perf.map((e: any, i: number) => {
        const star = isStar(e)
        return <div key={e.trainerId} className={star ? 'tp-star' : ''} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, marginBottom: 8, border: '1px solid ' + (star ? '#fdba74' : '#eef0f3'), background: star ? '#fff7ed' : '#fff' }}>
          <div style={{ width: 24, textAlign: 'center', fontWeight: 800, color: i === 0 ? '#ea580c' : '#9aa1ad' }}>{i + 1}</div>
          <Avatar style={{ background: '#c2410c', flexShrink: 0 }}>{(e.name || '?')[0]}</Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{e.name}{star && <span className="tp-blinktext" style={{ color: '#ea580c', fontWeight: 700, marginLeft: 8 }}>🌟 Extraordinary</span>}</div>
            <div style={{ fontSize: 12, color: '#69707d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.subjects.slice(0, 4).join(' · ')}{e.subjects.length > 4 ? ` +${e.subjects.length - 4} more` : ''}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#161a22' }}>{e.count}</div>
            <div style={{ fontSize: 11, color: '#69707d' }}>edited · {e.published} published</div>
          </div>
        </div>
      })}
    </Card>
    <Card title="Detail — trainer · subject · status" extra={<span style={{ display: 'flex', gap: 8 }}>
      <Select allowClear placeholder="Filter by subject" style={{ minWidth: 200 }} value={subjectF} onChange={setSubjectF} options={subjects.map((s: any) => ({ value: s, label: s }))} />
      <Input allowClear prefix={<SearchOutlined style={{ color: '#9aa1ad' }} />} placeholder="Search trainer…" value={q} onChange={e => setQ(e.target.value)} style={{ width: 220 }} />
    </span>}>
      <Table size="middle" rowKey="key" columns={detailCols as any} dataSource={shown} pagination={{ pageSize: 20 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing completed through Editing yet." /> }} />
    </Card>
  </div>
}

/* ===================== role menu access (#3) ===================== */
const MENU_ITEMS: [string, string][] = [['/', 'Command Center'], ['/studio', 'Studio Board'], ['/myday', 'My Day (trainers)'], ['/mywork', 'My Work / Workspace'], ['/content', 'Content (Training topics)'], ['/assignments', 'Assignments'], ['/editing', 'Editing'], ['/goals', 'Weekly Goals'], ['/mentor', 'Mentor Management'], ['/reviews', 'Reviews'], ['/sla', 'SLA & Delays'], ['/management', 'Management'], ['/teams', 'Teams Performance'], ['/people', 'People'], ['/assets', 'Assets'], ['/manage', 'Manage']]
const ACCESS_ROLES = ROLES.filter(r => r !== 'admin')
function AccessMatrix() {
  const [acc, setAcc] = useState<any>(null)
  async function load() {
    const { data } = await supabase.from('role_access').select('role, menu_key, allowed')
    const m: any = {}; (data || []).forEach((r: any) => { m[r.role + '|' + r.menu_key] = r.allowed })
    setAcc(m)
  }
  useEffect(() => { load() }, [])
  async function toggle(role: string, key: string, checked: boolean) {
    setAcc((a: any) => ({ ...a, [role + '|' + key]: checked }))
    await supabase.from('role_access').upsert({ role, menu_key: key, allowed: checked }, { onConflict: 'role,menu_key' })
  }
  if (!acc) return null
  const isAllowed = (role: string, key: string) => acc[role + '|' + key] !== false
  const cols = [
    { title: 'Menu', dataIndex: 'label', render: (v: string) => <b>{v}</b> },
    ...ACCESS_ROLES.map((role) => ({ title: role.charAt(0).toUpperCase() + role.slice(1), align: 'center' as const, render: (_: any, r: any) => <Checkbox checked={isAllowed(role, r.key)} onChange={(e) => toggle(role, r.key, e.target.checked)} /> })),
  ]
  return (
    <Card title="Menu access by role" style={{ marginBottom: 16 }} extra={<span style={{ fontSize: 12, color: '#9aa1ad' }}>Program Head always sees everything</span>}>
      <Table size="small" pagination={false} dataSource={MENU_ITEMS.map(([key, label]) => ({ key, label }))} columns={cols as any} />
      <div style={{ marginTop: 8, fontSize: 12, color: '#9aa1ad' }}>Controls the left menu per role. Unchecked = hidden for that role.</div>
    </Card>
  )
}

/* ===================== curriculum adders (cascading dropdowns) ===================== */
function useChildren(table: string, parentCol: string, parentId?: string) {
  const [opts, setOpts] = useState<any[]>([])
  useEffect(() => {
    let live = true
    if (!parentId) { setOpts([]); return }
    supabase.from(table).select('id,name').eq(parentCol, parentId).order('name').then(({ data }: any) => { if (live) setOpts(data || []) })
    return () => { live = false }
  }, [table, parentCol, parentId])
  return opts
}
function LevelField({ label, value, onChange, options, placeholder, disabled, forceNew }: any) {
  const exists = !!options.find((o: any) => o.name === value)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#69707d', marginBottom: 4 }}>
        {label}
        {forceNew ? <Tag color="gold" style={{ marginInlineEnd: 0 }}>new</Tag> : value ? (exists ? <Tag style={{ marginInlineEnd: 0 }}>existing</Tag> : <Tag color="gold" style={{ marginInlineEnd: 0 }}>new</Tag>) : null}
      </div>
      <AutoComplete
        style={{ width: '100%' }} value={value} disabled={disabled} allowClear
        options={options.map((o: any) => ({ value: o.name }))}
        filterOption={(input: string, opt: any) => String(opt?.value || '').toLowerCase().includes(input.toLowerCase())}
        onChange={onChange} placeholder={placeholder} />
    </div>
  )
}
function AddSubjectModal({ open, onClose, onSaved, defaultProgram }: any) {
  const { message: msg } = AntApp.useApp()
  const [progs, setProgs] = useState<any[]>([])
  const [prog, setProg] = useState<string>(); const [subj, setSubj] = useState<string>(); const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setSubj(undefined)
    supabase.from('main_subject').select('id,name').order('name').then(({ data }: any) => { setProgs(data || []); setProg(defaultProgram || ((data || []).length === 1 ? data[0].name : undefined)) })
  }, [open])
  const progId = progs.find(p => p.name === prog)?.id
  const subjects = useChildren('subject', 'main_subject_id', progId)
  async function save() {
    if (![prog, subj].every(x => x && String(x).trim())) { msg.error('Pick a program and name the subject.'); return }
    setBusy(true)
    try {
      const mainId = await findOrCreateMain(prog!.trim())
      await findOrCreateChild('subject', 'main_subject_id', mainId, subj!.trim())
      msg.success('Subject added ✓'); setSubj(undefined); onSaved()
    } catch (e: any) { msg.error(e.message || 'Could not add') } finally { setBusy(false) }
  }
  return (
    <Modal open={open} title="Add a subject" onCancel={onClose} okText="Add subject" cancelText="Close" confirmLoading={busy} onOk={save} maskClosable={false}>
      <p style={{ fontSize: 12, color: '#9aa1ad', marginTop: 4 }}>Pick the program from the dropdown so you never re-type it.</p>
      <div style={{ marginTop: 8 }}>
        <LevelField label="Program" value={prog} options={progs} placeholder="Pick or type a program" onChange={(v: string) => { setProg(v); setSubj(undefined) }} />
        <LevelField label="Subject" value={subj} options={subjects} disabled={!prog} placeholder={prog ? 'Pick existing or type a new subject' : 'Choose a program first'} onChange={(v: string) => setSubj(v)} />
      </div>
    </Modal>
  )
}
function AddSubtopicModal({ open, onClose, onSaved, defaultProgram, defaultSubject }: any) {
  const { message: msg } = AntApp.useApp()
  const [progs, setProgs] = useState<any[]>([])
  const [prog, setProg] = useState<string>(); const [subj, setSubj] = useState<string>()
  const [chap, setChap] = useState<string>(); const [top, setTop] = useState<string>()
  const [sub, setSub] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setSubj(defaultSubject || undefined); setChap(undefined); setTop(undefined); setSub('')
    supabase.from('main_subject').select('id,name').order('name').then(({ data }: any) => { setProgs(data || []); setProg(defaultProgram || ((data || []).length === 1 ? data[0].name : undefined)) })
  }, [open])
  const progId = progs.find(p => p.name === prog)?.id
  const subjects = useChildren('subject', 'main_subject_id', progId)
  const subjId = subjects.find(s => s.name === subj)?.id
  const chapters = useChildren('chapter', 'subject_id', subjId)
  const chapId = chapters.find(c => c.name === chap)?.id
  const topics = useChildren('topic', 'chapter_id', chapId)
  async function save() {
    if (![prog, subj, chap, top].every(x => x && String(x).trim())) { msg.error('Pick or type Program, Subject, Chapter and Topic.'); return }
    setBusy(true)
    try {
      const mainId = await findOrCreateMain(prog!.trim())
      const sId = await findOrCreateChild('subject', 'main_subject_id', mainId, subj!.trim())
      const cId = await findOrCreateChild('chapter', 'subject_id', sId, chap!.trim())
      const tId = await findOrCreateChild('topic', 'chapter_id', cId, top!.trim())
      const hasSub = !!(sub && sub.trim())
      const subName = hasSub ? sub.trim() : top!.trim()   // sub-topic optional → track the whole topic
      const st = await supabase.from('subtopic').insert({ topic_id: tId, name: subName, sequence: 999 }).select('id').single()
      if (st.error) throw st.error
      const ci = await supabase.from('content_item').insert({ subtopic_id: st.data.id })
      if (ci.error) throw ci.error
      msg.success(hasSub ? 'Sub-topic added ✓ (with its 7 pipeline stages)' : 'Topic added as a trackable item ✓ (with its 7 stages)'); setSub(''); onSaved()
    } catch (e: any) { msg.error(e.message || 'Could not add') } finally { setBusy(false) }
  }
  return (
    <Modal open={open} title="Add a sub-topic" onCancel={onClose} okText="Add sub-topic" cancelText="Close" confirmLoading={busy} onOk={save} maskClosable={false}>
      <p style={{ fontSize: 12, color: '#9aa1ad', marginTop: 4 }}>Pick the existing Program → Subject → Chapter → Topic from the dropdowns (a <Tag color="gold" style={{ marginInlineEnd: 0 }}>new</Tag> tag warns if you've typed something that doesn't exist). Parents stay selected so you can add several in a row.</p>
      <div style={{ marginTop: 8 }}>
        <LevelField label="Program" value={prog} options={progs} placeholder="Pick a program" onChange={(v: string) => { setProg(v); setSubj(undefined); setChap(undefined); setTop(undefined) }} />
        <LevelField label="Subject" value={subj} options={subjects} disabled={!prog} placeholder={prog ? 'Pick or type a subject' : 'Choose a program first'} onChange={(v: string) => { setSubj(v); setChap(undefined); setTop(undefined) }} />
        <LevelField label="Chapter" value={chap} options={chapters} disabled={!subj} placeholder={subj ? 'Pick or type a chapter' : 'Choose a subject first'} onChange={(v: string) => { setChap(v); setTop(undefined) }} />
        <LevelField label="Topic" value={top} options={topics} disabled={!chap} placeholder={chap ? 'Pick or type a topic' : 'Choose a chapter first'} onChange={(v: string) => setTop(v)} />
        <LevelField label="Sub-topic (optional)" value={sub} options={[]} placeholder="Leave blank to track the whole topic" onChange={(v: string) => setSub(v || '')} />
        <div style={{ fontSize: 11, color: '#9aa1ad', marginTop: -6 }}>If a topic has no sub-topics, leave this blank — the topic becomes the trackable item with its own 7 stages.</div>
      </div>
    </Modal>
  )
}

/* ===================== bulk curriculum via Excel ===================== */
async function fetchCurriculumPaths() {
  const { data } = await supabase.from('content_item').select('id, subtopic:subtopic_id(name, topic:topic_id(name, chapter:chapter_id(name, subject:subject_id(name, main_subject:main_subject_id(name)))))')
  return (data || []).map((ci: any) => ({
    program: ci.subtopic?.topic?.chapter?.subject?.main_subject?.name || '',
    subject: ci.subtopic?.topic?.chapter?.subject?.name || '',
    chapter: ci.subtopic?.topic?.chapter?.name || '',
    topic: ci.subtopic?.topic?.name || '',
    subtopic: ci.subtopic?.name || '',
  }))
}
const CURR_COLS = ['Program', 'Subject', 'Chapter', 'Topic', 'Sub-topic']
const CURR_CAP = 1000
const pathKey = (r: any) => [r.program, r.subject, r.chapter, r.topic, r.subtopic].map((x: string) => String(x || '').trim().toLowerCase()).join(' ▸ ')

function CurriculumExcel({ onDone }: any) {
  const { message: msg } = AntApp.useApp()
  const [preview, setPreview] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  async function download() {
    const rows = await fetchCurriculumPaths()
    const out = (rows.length ? rows : [{ program: '', subject: '', chapter: '', topic: '', subtopic: '' }]).map((r: any) => ({
      Program: r.program, Subject: r.subject, Chapter: r.chapter, Topic: r.topic, 'Sub-topic': r.subtopic,
    }))
    const ws = XLSX.utils.json_to_sheet(out, { header: CURR_COLS })
    ws['!cols'] = CURR_COLS.map(() => ({ wch: 26 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Curriculum')
    XLSX.writeFile(wb, 'Trackademy_curriculum.xlsx')
  }

  async function onFile(e: any) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''
    try {
      const wb = XLSX.read(await file.arrayBuffer())
      const raw: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      if (!raw.length) { msg.error('That sheet has no rows.'); return }
      const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z]/g, '')
      const keymap: any = {}; Object.keys(raw[0]).forEach(k => { keymap[norm(k)] = k })
      const missing = ['program', 'subject', 'chapter', 'topic'].filter(n => !(n in keymap))
      if (missing.length) { msg.error('Missing column(s): ' + missing.join(', ') + '. Use Download as the template.'); return }
      const parsed = raw.map(r => {
        const topic = String(r[keymap.topic] || '').trim()
        const subRaw = keymap.subtopic ? String(r[keymap.subtopic] || '').trim() : ''
        return {
          program: String(r[keymap.program] || '').trim(), subject: String(r[keymap.subject] || '').trim(),
          chapter: String(r[keymap.chapter] || '').trim(), topic,
          subtopic: subRaw || topic, // sub-topic optional → blank tracks the whole topic
        }
      })
      const valid = parsed.filter(r => r.program && r.subject && r.chapter && r.topic)
      const invalidCount = parsed.length - valid.length
      const paths = await fetchCurriculumPaths()
      const existing = new Set(paths.map(pathKey))
      const lc = (s: string) => String(s || '').trim().toLowerCase()
      const progSet = new Set(paths.map((p: any) => lc(p.program)))
      const subjSet = new Set(paths.map((p: any) => lc(p.program) + '|' + lc(p.subject)))
      const chapSet = new Set(paths.map((p: any) => lc(p.program) + '|' + lc(p.subject) + '|' + lc(p.chapter)))
      const topSet = new Set(paths.map((p: any) => lc(p.program) + '|' + lc(p.subject) + '|' + lc(p.chapter) + '|' + lc(p.topic)))
      const seen = new Set<string>(); const newRows: any[] = []
      valid.forEach(r => { const k = pathKey(r); if (existing.has(k) || seen.has(k)) return; seen.add(k); newRows.push(r) })
      // flag rows whose parents don't already exist — usually a typo / case slip that would create a stray Program/Subject/Chapter/Topic
      const np = new Set<string>(), ns = new Set<string>(), nc = new Set<string>(), nt = new Set<string>()
      newRows.forEach(r => {
        const pk = lc(r.program), sk = pk + '|' + lc(r.subject), ck = sk + '|' + lc(r.chapter), tk = ck + '|' + lc(r.topic)
        r._np = !progSet.has(pk); r._ns = !subjSet.has(sk); r._nc = !chapSet.has(ck); r._nt = !topSet.has(tk)
        if (r._np) np.add(pk); if (r._ns) ns.add(sk); if (r._nc) nc.add(ck); if (r._nt) nt.add(tk)
      })
      setPreview({ newRows, dupCount: valid.length - newRows.length, invalidCount, total: parsed.length, newParents: { programs: np.size, subjects: ns.size, chapters: nc.size, topics: nt.size } })
    } catch (err: any) { msg.error('Could not read file: ' + (err.message || err)) }
  }

  async function commit() {
    if (!preview) return
    const rows: any[] = preview.newRows
    if (!rows.length) { setPreview(null); return }
    if (rows.length > CURR_CAP) { msg.error(`Too many new rows (${rows.length}). Max ${CURR_CAP} per upload — split the file.`); return }
    setBusy(true); setProgress(0)
    try {
      const cache = new Map<string, string>()
      const foMain = async (name: string) => { const ck = 'm|' + name.toLowerCase(); if (!cache.has(ck)) cache.set(ck, await findOrCreateMain(name)); return cache.get(ck)! }
      const foChild = async (table: string, col: string, pid: string, name: string) => { const ck = table + '|' + pid + '|' + name.toLowerCase(); if (!cache.has(ck)) cache.set(ck, await findOrCreateChild(table, col, pid, name)); return cache.get(ck)! }
      const leaves: any[] = []
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const m = await foMain(r.program)
        const s = await foChild('subject', 'main_subject_id', m, r.subject)
        const c = await foChild('chapter', 'subject_id', s, r.chapter)
        const t = await foChild('topic', 'chapter_id', c, r.topic)
        leaves.push({ topic_id: t, name: r.subtopic, sequence: 999 })
        setProgress(Math.round(((i + 1) / rows.length) * 50))
      }
      const CHUNK = 100; const subIds: string[] = []
      for (let i = 0; i < leaves.length; i += CHUNK) {
        const ins = await supabase.from('subtopic').insert(leaves.slice(i, i + CHUNK)).select('id')
        if (ins.error) throw ins.error
        ;(ins.data || []).forEach((d: any) => subIds.push(d.id))
        setProgress(50 + Math.round((Math.min(i + CHUNK, leaves.length) / leaves.length) * 25))
      }
      for (let i = 0; i < subIds.length; i += CHUNK) {
        const ins = await supabase.from('content_item').insert(subIds.slice(i, i + CHUNK).map(id => ({ subtopic_id: id })))
        if (ins.error) throw ins.error
        setProgress(75 + Math.round((Math.min(i + CHUNK, subIds.length) / subIds.length) * 25))
      }
      setProgress(100)
      msg.success(`Added ${subIds.length} sub-topics ✓ (each with its 7 pipeline stages)`)
      setPreview(null); onDone && onDone()
    } catch (e: any) { msg.error(e.message || 'Upload failed') } finally { setBusy(false) }
  }

  return (
    <Card title="Bulk curriculum via Excel" style={{ marginBottom: 16 }}
      extra={<div style={{ display: 'flex', gap: 8 }}>
        <Button icon={<DownloadOutlined />} onClick={download}>Download</Button>
        <Button type="primary" icon={<UploadOutlined />} onClick={() => fileRef.current?.click()}>Upload</Button>
      </div>}>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ display: 'none' }} />
      <div style={{ fontSize: 13, color: '#69707d' }}>
        Columns: <b>Program · Subject · Chapter · Topic</b> · <i>Sub-topic (optional)</i>. Leave Sub-topic blank (or drop the column) to track the whole topic. <b>Download</b> exports your current curriculum as the template, then <b>Upload</b> the edited file.
        <ul style={{ margin: '8px 0 0', paddingInlineStart: 18 }}>
          <li><b>Add-new-only:</b> rows that already exist are skipped — re-uploading the same file changes nothing.</li>
          <li>You see a <b>preview</b> (new vs. skipped) and confirm before anything is written.</li>
          <li>Each new sub-topic auto-creates its content item + 7 pipeline stages. Max {CURR_CAP} new rows per upload.</li>
        </ul>
      </div>
      <Modal open={!!preview} title="Confirm bulk upload" okText={preview ? `Create ${preview.newRows.length} sub-topics` : 'Create'} cancelText="Cancel"
        onOk={commit} confirmLoading={busy} okButtonProps={{ disabled: !preview || preview.newRows.length === 0 || preview.newRows.length > CURR_CAP }} onCancel={() => !busy && setPreview(null)} maskClosable={false} width={760}>
        {preview && <div>
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col span={8}><Statistic title="New (will create)" value={preview.newRows.length} valueStyle={{ color: '#16a34a' }} /></Col>
            <Col span={8}><Statistic title="Already exist (skip)" value={preview.dupCount} valueStyle={{ color: '#c2790a' }} /></Col>
            <Col span={8}><Statistic title="Invalid (skip)" value={preview.invalidCount} valueStyle={{ color: '#dc2626' }} /></Col>
          </Row>
          {preview.newRows.length > CURR_CAP && <div style={{ color: '#dc2626', marginBottom: 8 }}>Over the {CURR_CAP}-row cap — split the file into smaller uploads.</div>}
          {preview.newParents && (preview.newParents.programs + preview.newParents.subjects + preview.newParents.chapters + preview.newParents.topics) > 0 &&
            <div style={{ background: '#fff7e6', border: '1px solid #ffe0a3', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13 }}>
              ⚠️ This will also create new {[preview.newParents.programs && `${preview.newParents.programs} program(s)`, preview.newParents.subjects && `${preview.newParents.subjects} subject(s)`, preview.newParents.chapters && `${preview.newParents.chapters} chapter(s)`, preview.newParents.topics && `${preview.newParents.topics} topic(s)`].filter(Boolean).join(', ')}. If you only meant to add sub-topics, a <Tag color="gold" style={{ marginInlineEnd: 0 }}>new</Tag> parent below is likely a typo or capitalisation slip — fix it in Excel and re-upload. (Matching is case-insensitive, so "Core Java" and "core java" are treated as the same.)
            </div>}
          {preview.newRows.length > 0 && <Table size="small" pagination={{ pageSize: 6 }} dataSource={preview.newRows.map((r: any, i: number) => ({ ...r, key: i }))}
            columns={[
              { title: 'Program', dataIndex: 'program', render: (v: string, r: any) => r._np ? <span>{v} <Tag color="gold" style={{ marginInlineEnd: 0 }}>new</Tag></span> : v },
              { title: 'Subject', dataIndex: 'subject', render: (v: string, r: any) => r._ns ? <span>{v} <Tag color="gold" style={{ marginInlineEnd: 0 }}>new</Tag></span> : v },
              { title: 'Chapter', dataIndex: 'chapter', render: (v: string, r: any) => r._nc ? <span>{v} <Tag color="gold" style={{ marginInlineEnd: 0 }}>new</Tag></span> : v },
              { title: 'Topic', dataIndex: 'topic', render: (v: string, r: any) => r._nt ? <span>{v} <Tag color="gold" style={{ marginInlineEnd: 0 }}>new</Tag></span> : v },
              { title: 'Sub-topic', dataIndex: 'subtopic', render: (v: string) => <b>{v}</b> },
            ] as any} />}
          {busy && <Progress percent={progress} status="active" style={{ marginTop: 10 }} />}
        </div>}
      </Modal>
    </Card>
  )
}

/* ===================== manage (studios / team / curriculum) ===================== */
// ---- Appearance: switch the brand theme (per browser; reverts instantly) ----
function AppearanceCard() {
  const [val, setVal] = useState(ACTIVE_THEME)
  return (
    <Card title="Appearance" style={{ marginBottom: 16 }} extra={<span style={{ fontSize: 12, color: '#9aa1ad' }}>Brand theme — switch any time</span>}>
      <div style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 12 }}>Choose the colour theme for the whole app. Your choice is saved on this device and can be switched back here at any time.</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Segmented value={val} onChange={(v: any) => setVal(v)} options={Object.entries(THEMES).map(([k, t]) => ({ label: t.label, value: k }))} />
        <Button type="primary" disabled={val === ACTIVE_THEME} onClick={() => { try { localStorage.setItem('rt_theme', val) } catch {} ; location.reload() }}>Apply &amp; reload</Button>
        <span style={{ fontSize: 12, color: '#9aa1ad' }}>Currently active: <b>{THEMES[ACTIVE_THEME]?.label}</b></span>
      </div>
    </Card>
  )
}

// ---- Turnaround Time (TAT) per workflow step → stage.sla_days (drives SLA + analytics) ----
function StageTAT({ isAdmin }: { isAdmin: boolean }) {
  const { message: msg } = AntApp.useApp()
  const [stages, setStages] = useState<any[] | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  async function load() { setStages((await supabase.from('stage').select('id,code,name,sequence,is_gate,sla_days').order('sequence')).data || []) }
  useEffect(() => { load() }, [])
  async function setDays(id: string, days: number) {
    setSaving(id)
    const { data, error } = await supabase.from('stage').update({ sla_days: days }).eq('id', id).select('id')
    setSaving(null)
    if (error) { msg.error(error.message); return }
    if (!data || !data.length) { msg.error("Couldn't save — only the Program Head can change turnaround times."); return }
    msg.success('TAT updated ✓'); setStages(s => (s || []).map(x => x.id === id ? { ...x, sla_days: days } : x))
  }
  if (!stages) return null
  const total = stages.reduce((a, b) => a + (b.sla_days || 0), 0)
  return (
    <Card title="Turnaround Time (TAT) per stage" style={{ marginBottom: 16 }}
      extra={<span style={{ fontSize: 12, color: '#9aa1ad' }}>Total per sub-topic: <b style={{ color: PRIMARY }}>{total} days</b></span>}>
      <div style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 12 }}>Target number of days for each workflow step. The clock for a step starts when that step begins; the overall clock for an item starts when it is assigned to a trainer. These targets drive the SLA window, on-time tracking and the bottleneck analytics. {isAdmin ? '' : '(Only the Program Head can change these.)'}</div>
      <Table size="middle" pagination={false} dataSource={stages.map(s => ({ ...s, key: s.id }))}
        columns={[
          { title: '#', dataIndex: 'sequence', width: 50 },
          { title: 'Workflow step', dataIndex: 'name', render: (v: string, r: any) => <span><b>{v}</b> {r.is_gate ? <Tag color="gold" style={{ marginLeft: 6 }}>gate</Tag> : null}</span> },
          {
            title: 'TAT (days)', width: 150, render: (_: any, r: any) => isAdmin
              ? <Select size="small" value={r.sla_days} loading={saving === r.id} style={{ width: 110 }} onChange={(v: number) => setDays(r.id, v)} options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: `${i + 1} day${i ? 's' : ''}` }))} />
              : <b>{r.sla_days} day{r.sla_days === 1 ? '' : 's'}</b>
          },
        ] as any} />
    </Card>
  )
}

// ---- Program-level due dates (auto-suggested from total TAT, override-able) ----
// the ONE account allowed to delete a whole program from the UI (Program Head). Everyone else never sees the button.
const SUPER_DELETE_EMAIL = 'saichitrav@qspiders.com'
function ProgramDueDates({ isAdmin }: { isAdmin: boolean }) {
  const { message: msg } = AntApp.useApp()
  const { person: me } = useAuth()
  const canDelete = (me?.email || '').toLowerCase() === SUPER_DELETE_EMAIL
  const [progs, setProgs] = useState<any[] | null>(null)
  const [totalTat, setTotalTat] = useState(0)
  const [delTarget, setDelTarget] = useState<any>(null); const [delText, setDelText] = useState(''); const [delBusy, setDelBusy] = useState(false)
  async function load() {
    setProgs((await supabase.from('main_subject').select('id,name,due_date,due_date_manual').order('name')).data || [])
    const st = await supabase.from('stage').select('sla_days')
    setTotalTat((st.data || []).reduce((a: number, b: any) => a + (b.sla_days || 0), 0))
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (!delTarget) setDelText('') }, [delTarget])
  async function deleteProgram() {
    setDelBusy(true)
    const { data, error } = await supabase.from('main_subject').delete().eq('id', delTarget.id).select('id')
    setDelBusy(false)
    if (error) { msg.error(error.message); return }
    if (!data || !data.length) { msg.error("Couldn't delete — the database is blocking it (only saichitrav@qspiders.com is allowed)."); return }
    msg.success(`Program “${delTarget.name}” and everything under it was deleted.`)
    setDelTarget(null); load()
  }
  const suggested = dayjs().add(totalTat, 'day')
  async function save(id: string, date: any, manual: boolean) {
    const { data, error } = await supabase.from('main_subject').update({ due_date: date ? date.format('YYYY-MM-DD') : null, due_date_manual: manual }).eq('id', id).select('id')
    if (error) { msg.error(/column .*due_date/i.test(error.message) ? 'Run RecTrack_v10.sql first — the due_date column is missing.' : error.message); return }
    if (!data || !data.length) { msg.error("Couldn't save — only the Program Head can set due dates."); return }
    msg.success('Due date saved ✓'); load()
  }
  if (!progs) return null
  return (
    <Card title="Program due dates" style={{ marginBottom: 16 }}
      extra={<span style={{ fontSize: 12, color: '#9aa1ad' }}>Suggested baseline: <b>{suggested.format('DD MMM YYYY')}</b> (today + {totalTat}d TAT)</span>}>
      <div style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 12 }}>An absolute target date for each program — different from TAT, which is a duration per step. We suggest a baseline from your total stage TAT; set or override it per program. {isAdmin ? '' : '(Only the Program Head can set these.)'}</div>
      <Table size="middle" pagination={false} dataSource={progs.map((p: any) => ({ ...p, key: p.id }))}
        columns={[
          { title: 'Program', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
          {
            title: 'Due date', width: 200, render: (_: any, r: any) => isAdmin
              ? <DatePicker size="small" value={r.due_date ? dayjs(r.due_date) : null} format="DD MMM YYYY" style={{ width: 160 }} onChange={(d: any) => save(r.id, d, true)} />
              : (r.due_date ? <span>{dayjs(r.due_date).format('DD MMM YYYY')}</span> : <span style={{ color: '#9aa1ad' }}>—</span>)
          },
          { title: 'Status', width: 130, render: (_: any, r: any) => { const m = dueMeta(r.due_date); return m ? <Tag color={m.days < 0 ? 'red' : m.days <= 7 ? 'orange' : 'green'}>{m.text}</Tag> : <span style={{ color: '#9aa1ad' }}>not set</span> } },
          {
            title: 'Source', width: 90, render: (_: any, r: any) => r.due_date ? (r.due_date_manual ? <Tag>manual</Tag> : <Tag color="blue">auto</Tag>) : null
          },
          ...(isAdmin ? [{ title: '', width: 180, render: (_: any, r: any) => <span style={{ whiteSpace: 'nowrap' }}>
            <Button size="small" onClick={() => save(r.id, suggested, false)} title={'Set to ' + suggested.format('DD MMM YYYY')}>Use suggested</Button>
            {canDelete && <Button size="small" danger type="text" icon={<DeleteOutlined />} style={{ marginInlineStart: 4 }} title="Delete this entire program" onClick={() => setDelTarget(r)} />}
          </span> }] : []),
        ] as any} />
      {canDelete && <div style={{ fontSize: 11, color: '#9aa1ad', marginTop: 8 }}><i> Delete is restricted to {SUPER_DELETE_EMAIL} only.</i></div>}
      <Modal open={!!delTarget} title={<span style={{ color: '#dc2626' }}>Delete program “{delTarget?.name}”?</span>}
        okText="Delete entire program" okButtonProps={{ danger: true, loading: delBusy, disabled: delText.trim() !== delTarget?.name }}
        onOk={deleteProgram} onCancel={() => setDelTarget(null)} forceRender>
        <div style={{ background: '#fdeaea', border: '1px solid #f6d2d2', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
          ⚠️ This permanently removes <b>{delTarget?.name}</b> and <b>everything under it</b> — all subjects, chapters, topics, sub-topics, their stages, recordings, edits and reviews. Studio bookings are kept but unlinked. <b>This cannot be undone.</b>
        </div>
        <div style={{ fontSize: 13, marginBottom: 6 }}>Type the program name <b>{delTarget?.name}</b> to confirm:</div>
        <Input value={delText} onChange={e => setDelText(e.target.value)} placeholder={delTarget?.name} onPressEnter={() => { if (delText.trim() === delTarget?.name) deleteProgram() }} />
      </Modal>
    </Card>
  )
}

function Manage() {
  const { person: me } = useAuth(); const isAdmin = me?.role === 'admin'; const canManagePeople = isAdmin || PEOPLE_MANAGER_ROLES.includes(me?.role)
  const { message: msg } = AntApp.useApp()
  const [studios, setStudios] = useState<any>(null)
  const [people, setPeople] = useState<any>(null)
  const [counts, setCounts] = useState<any>({})
  const [addStudio, setAddStudio] = useState(false)
  const [editPerson, setEditPerson] = useState<any>(null)
  const [provisioning, setProvisioning] = useState(false)
  const [addSubj, setAddSubj] = useState(false)
  const [addSub, setAddSub] = useState(false)
  const [sf] = Form.useForm()
  async function load() {
    setStudios((await supabase.from('studio').select('*').order('sort')).data || [])
    setPeople((await supabase.from('person').select('*').order('role')).data || [])
    const subs = await supabase.from('subject').select('id', { count: 'exact', head: true })
    const tops = await supabase.from('topic').select('id', { count: 'exact', head: true })
    const stc = await supabase.from('subtopic').select('id', { count: 'exact', head: true })
    setCounts({ subjects: subs.count || 0, topics: tops.count || 0, subtopics: stc.count || 0 })
  }
  useEffect(() => { load() }, [])
  async function provisionAll() {
    const missing = (people || []).filter((p: any) => !p.auth_user_id)
    if (!missing.length) { msg.info('All teammates already have logins.'); return }
    setProvisioning(true)
    let ok = 0
    for (const p of missing) {
      const r = await supabase.rpc('rt_provision_login', { p_email: p.email })
      if (!r.error && r.data?.ok) ok++
    }
    setProvisioning(false)
    if (ok) msg.success(`${ok} login${ok > 1 ? 's' : ''} created ✓`)
    else msg.warning('No logins created — run the provision SQL in Supabase SQL Editor first (see setup guide).')
    load()
  }
  async function saveStudio() {
    const v = await sf.validateFields()
    const { error } = await supabase.from('studio').insert({ name: v.name, sort: (studios?.length || 0) + 1 })
    if (error) { msg.error(/unique|duplicate/i.test(error.message) ? 'A studio with that name already exists.' : error.message); return }
    msg.success('Studio added ✓'); setAddStudio(false); sf.resetFields(); load()
  }
  if (!studios || !people) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  return (
    <div>
      <PageHead title="Manage" />
      <Card title="Curriculum" style={{ marginBottom: 16 }}
        extra={<div style={{ display: 'flex', gap: 8 }}><Button onClick={() => setAddSubj(true)}>Add subject</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => setAddSub(true)}>Add sub-topic</Button></div>}>
        <div style={{ display: 'flex', gap: 32 }}>
          <Statistic title="Subjects" value={counts.subjects} />
          <Statistic title="Topics" value={counts.topics} />
          <Statistic title="Sub-topics" value={counts.subtopics} />
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#9aa1ad' }}>Adding a sub-topic auto-creates its content-item + 7 pipeline stages. Existing names are reused (no duplicates).</div>
      </Card>
      <CurriculumExcel onDone={load} />
      <StageTAT isAdmin={isAdmin} />
      <ProgramDueDates isAdmin={isAdmin} />
      <Card title="Recording Studios" style={{ marginBottom: 16 }} extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setAddStudio(true)}>Add studio</Button>}>
        <Table size="middle" pagination={false} dataSource={studios.map((s: any) => ({ ...s, key: s.id }))}
          columns={[{ title: 'Studio', dataIndex: 'name', render: (v: string) => <b>{v}</b> }, { title: 'Active', dataIndex: 'is_active', render: (v: boolean) => v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag> }] as any} />
      </Card>
      <Card title="Team" extra={canManagePeople ? <div style={{ display: 'flex', gap: 8 }}>{(people || []).some((p: any) => !p.auth_user_id) && <Button loading={provisioning} onClick={provisionAll}>Provision logins ({(people || []).filter((p: any) => !p.auth_user_id).length} pending)</Button>}<Button type="primary" icon={<PlusOutlined />} onClick={() => setEditPerson({})}>Add teammate</Button></div> : undefined}>
        <Table size="middle" pagination={false} dataSource={people.map((p: any) => ({ ...p, key: p.id }))}
          columns={[
            { title: 'Name', dataIndex: 'full_name', render: (v: string) => <b>{v}</b> },
            { title: 'Email', dataIndex: 'email' },
            { title: 'Role', dataIndex: 'role', render: (v: string) => <Tag color={roleColor[v]}>{roleLabel(v)}</Tag> },
            { title: 'Type', dataIndex: 'trainer_type', render: (v: string) => v || '—' },
            { title: 'Active', dataIndex: 'is_active', render: (v: boolean) => v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag> },
            ...(canManagePeople ? [{ title: '', width: 56, render: (_: any, r: any) => <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditPerson(r)} title="Edit teammate" /> }] : []),
          ] as any} />
      </Card>

      <CustomFields />
      <AccessMatrix />
      <AppearanceCard />

      <Modal open={addStudio} title="Add a recording studio" onOk={saveStudio} onCancel={() => setAddStudio(false)} okText="Add studio">
        <Form form={sf} layout="vertical" style={{ marginTop: 12 }}><Form.Item name="name" label="Studio name" rules={[{ required: true }]}><Input placeholder="e.g. Studio 5" /></Form.Item></Form>
      </Modal>
      <PersonModal open={!!editPerson} person={editPerson} onClose={() => setEditPerson(null)} onSaved={() => { setEditPerson(null); load() }} />
      <AddSubjectModal open={addSubj} onClose={() => setAddSubj(false)} onSaved={load} />
      <AddSubtopicModal open={addSub} onClose={() => setAddSub(false)} onSaved={load} />
    </div>
  )
}

/* ===================== management dashboard (analytics) ===================== */
// custom treemap tile: size = volume, colour = completion (red → green)
function HeatTile(props: any) {
  const { x, y, width, height, name } = props
  const completion = props.completion ?? props.payload?.completion ?? 0
  const c = completion >= 80 ? '#16a34a' : completion >= 60 ? '#52a91a' : completion >= 40 ? '#c2790a' : completion >= 20 ? '#e8743b' : '#dc2626'
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} style={{ fill: c, stroke: '#fff', strokeWidth: 2 }} />
      {width > 64 && height > 26 && <text x={x + 6} y={y + 18} fill="#fff" fontSize={12} fontWeight={600}>{String(name).length > 18 ? String(name).slice(0, 17) + '…' : name}</text>}
      {width > 64 && height > 42 && <text x={x + 6} y={y + 34} fill="#fff" fontSize={11} opacity={0.9}>{completion}%</text>}
    </g>
  )
}
// small "i" with a tooltip explaining a widget
function InfoDot({ text }: { text: string }) {
  return <ATooltip title={text}><InfoCircleOutlined style={{ color: '#9aa1ad', fontSize: 13, marginLeft: 5, cursor: 'help' }} /></ATooltip>
}
const RISK_INFO = 'Early-warning score 0–100, weighted: rating level 30% · rating trend 20% · prep stall 20% · weak mock/technical 15% · send-backs 10% · rating staleness 5%.  0–30 on track · 30–60 watch · 60+ at risk.'

// ===================== mentor analytics (Management → Tab 2) =====================
function MentorAnalytics() {
  const { person } = useAuth()
  const isAdmin = person?.role === 'admin'
  const [d, setD] = useState<any>(null)
  const [histQ, setHistQ] = useState('')
  const [histSubj, setHistSubj] = useState<string | null>(null)  // Rating history → filter by subject
  const [histBand, setHistBand] = useState<string | null>(null)  // Rating history → filter by rating band
  async function load() {
    const p = await supabase.from('person').select('id, full_name, role, is_active, lead_id, program_id')
    const people = p.data || []
    const nameById: any = {}; people.forEach((x: any) => nameById[x.id] = x.full_name)
    const allMentors = people.filter((x: any) => x.role === 'mentor' && x.is_active)
    const coPrograms = await coAssignedPrograms(person.id) // co-assigned programs (v29) widen a lead's mentor view
    // multiple managing leads (v28); falls back to the single lead_id when absent
    const lm: any = {}
    if (MOCK_MENTOR_SUBTOPIC) Object.assign(lm, mockAllMentorLeads())
    else { const ml = await supabase.from('mentor_lead').select('mentor_id, lead_id'); if (!ml.error) (ml.data || []).forEach((x: any) => { (lm[x.mentor_id] = lm[x.mentor_id] || []).push(x.lead_id) }) }
    const leadsOf = (m: any) => (lm[m.id]?.length ? lm[m.id] : (m.lead_id ? [m.lead_id] : []))
    const visMentors = isAdmin ? allMentors : allMentors.filter((m: any) => leadsOf(m).includes(person.id) || (m.program_id && coPrograms.has(m.program_id)))
    const mIds = new Set(visMentors.map((m: any) => m.id))
    const pr = await supabase.from('mentor_prep').select('mentor_id, topic_id, watched, notes_done, practice_done, presentation_done, state, review_status, last_progress_at, created_at, send_back_count, topic:topic_id(name)')
    const prep = (pr.data || []).filter((r: any) => mIds.has(r.mentor_id) && (r.state || 'active') !== 'withdrawn')
    // selectAll pages past Supabase's 1000-row cap — a plain select truncates and silently drops the
    // NEWEST ratings (recent daily etiquette), which is why they went missing from analytics.
    const rtAll = await selectAll('mentor_rating', 'mentor_id, category, score, rated_on, weight_snapshot, scope_id, scope_level')
    let ratings: any[] = rtAll.filter((r: any) => mIds.has(r.mentor_id))
    if (MOCK_MENTOR_SUBTOPIC) ratings = [...ratings, ...mockListRatings([...mIds])] // include locally-saved (mock) ratings
    // topic_id -> { subject, topic } so topic-scoped ratings can be shown by Subject › Topic
    const tp = await selectAll('topic', 'id, name, chapter:chapter_id(subject:subject_id(name))')
    const topicMap: any = {}; tp.forEach((t: any) => topicMap[t.id] = { topic: t.name, subject: t.chapter?.subject?.name || '—' })
    // also resolve SUB-TOPIC ids → subject (ratings can be scoped at the sub-topic level)
    const stp = await selectAll('subtopic', 'id, name, topic:topic_id(name, chapter:chapter_id(subject:subject_id(name)))')
    stp.forEach((st: any) => topicMap[st.id] = { topic: st.topic?.name || st.name, subject: st.topic?.chapter?.subject?.name || '—' })
    setD({ visMentors, nameById, prep, ratings, topicMap })
  }
  useEffect(() => { if (person?.id) load() }, [person?.id])
  if (!d) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  const today = dayjs()
  const STEPS = ['watched', 'notes_done', 'practice_done', 'presentation_done']
  const mRatings = (mid: string) => d.ratings.filter((r: any) => r.mentor_id === mid)
  // average per category from day one to date (NOT the latest score) — e.g. Depth of topic = mean of all its scores
  const avgPerCat = (rs: any[]) => { const g: any = {}; rs.forEach((r: any) => { if (r.score != null) (g[r.category] = g[r.category] || []).push(Number(r.score)) }); const m: any = {}; Object.keys(g).forEach((c) => m[c] = { score: g[c].reduce((a: number, b: number) => a + b, 0) / g[c].length, w: 1 }); return m }
  // a mentor's overall rating = the mean of their per-category averages (each category counts once)
  const overallOf = (mid: string) => { const lp = avgPerCat(mRatings(mid)); const vals = Object.values(lp) as any[]; return vals.length ? vals.reduce((s: number, x: any) => s + x.score, 0) / vals.length : null }
  function metrics(m: any) {
    const mid = m.id
    const prep = d.prep.filter((r: any) => r.mentor_id === mid)
    const totalSteps = prep.length * 4
    const doneSteps = prep.reduce((s: number, r: any) => s + STEPS.filter(k => r[k]).length, 0)
    const readiness = totalSteps ? doneSteps / totalSteps : 0
    const topicsDone = prep.filter((r: any) => (r.review_status || 'open') === 'completed').length // deploy-ready = Completed
    const deployReady = prep.length > 0 && topicsDone === prep.length
    const overall = overallOf(mid)
    const dated = mRatings(mid).filter((r: any) => r.score != null).slice().sort((a: any, b: any) => String(a.rated_on).localeCompare(String(b.rated_on)))
    let trend = 0
    if (dated.length >= 4) { const h = Math.floor(dated.length / 2); const avg = (a: any[]) => a.reduce((s: number, x: any) => s + Number(x.score), 0) / a.length; trend = avg(dated.slice(h)) - avg(dated.slice(0, h)) }
    const lp = avgPerCat(mRatings(mid))
    const weak = Math.min(lp['mock_interview']?.score ?? lp['mock_performance']?.score ?? 5, lp['depth_of_topic']?.score ?? lp['technical']?.score ?? 5)
    const lastProg = prep.map((r: any) => r.last_progress_at || r.created_at).filter(Boolean).sort().slice(-1)[0]
    const stallDays = lastProg ? today.diff(dayjs(lastProg), 'day') : (prep.length ? 30 : 0)
    const lastRated = mRatings(mid).map((r: any) => r.rated_on).filter(Boolean).sort().slice(-1)[0]
    const staleDays = lastRated ? today.diff(dayjs(lastRated), 'day') : 30
    const sendBacks = prep.reduce((s: number, r: any) => s + (Number(r.send_back_count) || 0), 0)
    const cl = (x: number) => Math.max(0, Math.min(1, x))
    const risk = Math.round(100 * (0.30 * (overall == null ? 0.4 : cl((4.0 - overall) / 1.5)) + 0.20 * (trend < 0 ? cl(-trend) : 0) + 0.15 * (weak < 3.5 ? cl((3.5 - weak) / 1.5) : 0) + 0.20 * cl(stallDays / 14) + 0.05 * cl(staleDays / 14) + 0.10 * cl(sendBacks / 3)))
    const reasons: string[] = []
    if (overall != null && overall < 3.8) reasons.push(`low rating ${overall.toFixed(1)}`)
    if (trend < -0.2) reasons.push(`rating ↓ ${trend.toFixed(1)}`)
    if (weak < 3.5) reasons.push(`weak mock/tech ${weak.toFixed(1)}`)
    if (stallDays >= 7 && prep.length) reasons.push(`stalled ${stallDays}d`)
    if (staleDays >= 10) reasons.push(`no rating ${staleDays}d`)
    if (sendBacks >= 2) reasons.push(`${sendBacks} send-backs`)
    return { readiness, deployReady, overall, risk, reasons, topicsDone, topics: prep.length, lp, prep }
  }
  const rows = d.visMentors.map((m: any) => ({ m, ...metrics(m) }))
  // a mentor's subject (single-domain) from their assigned prep, falling back to any topic-scoped rating
  const mentorSubjectOf = (mid: string) => {
    const cnt: any = {}; d.prep.forEach((p: any) => { if (p.mentor_id !== mid) return; const s = d.topicMap[p.topic_id]?.subject; if (s) cnt[s] = (cnt[s] || 0) + 1 })
    let best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]
    if (!best) { const r = d.ratings.find((x: any) => x.mentor_id === mid && x.scope_id && d.topicMap[x.scope_id]?.subject); best = r ? d.topicMap[r.scope_id].subject : '' }
    return best || null
  }
  // rating history — every rating from day one to date; "avg" = mean of per-category averages (overallOf)
  const histRows = d.visMentors.map((m: any) => {
    const rs = d.ratings.filter((r: any) => r.mentor_id === m.id && r.score != null).slice().sort((a: any, b: any) => String(a.rated_on).localeCompare(String(b.rated_on)))
    return { key: m.id, name: m.full_name, subject: mentorSubjectOf(m.id), count: rs.length, first: rs[0]?.rated_on || null, last: rs[rs.length - 1]?.rated_on || null, avg: overallOf(m.id), entries: rs }
  }).sort((a: any, b: any) => (b.avg ?? -1) - (a.avg ?? -1))
  // subject options come from the mentors actually in view
  const histSubjOpts = [...new Set(histRows.map((r: any) => r.subject).filter(Boolean))].sort() as string[]
  const RATING_BANDS = [
    { value: 'gte45', label: '4.5 – 5 (excellent)' },
    { value: 'gte4', label: '4 – 4.5 (good)' },
    { value: 'gte3', label: '3 – 4 (average)' },
    { value: 'lt3', label: 'Below 3 (needs attention)' },
    { value: 'none', label: 'Not rated yet' },
  ]
  const inBand = (avg: number | null) => {
    if (!histBand) return true
    if (histBand === 'none') return avg == null
    if (avg == null) return false
    if (histBand === 'gte45') return avg >= 4.5
    if (histBand === 'gte4') return avg >= 4 && avg < 4.5
    if (histBand === 'gte3') return avg >= 3 && avg < 4
    if (histBand === 'lt3') return avg < 3
    return true
  }
  const histShown = histRows.filter((r: any) =>
    (!histQ.trim() || String(r.name || '').toLowerCase().includes(histQ.trim().toLowerCase()))
    && (!histSubj || r.subject === histSubj)
    && inBand(r.avg))
  const histCols = [
    { title: 'Mentor', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Subject', dataIndex: 'subject', width: 150, render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Ratings', dataIndex: 'count', width: 80 },
    { title: 'First rated', dataIndex: 'first', width: 120, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Last rated', dataIndex: 'last', width: 120, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Average rating', dataIndex: 'avg', width: 130, render: (v: number) => v != null ? <Tag color={v >= 4 ? 'green' : v >= 3 ? 'orange' : 'red'}>{v.toFixed(2)} / 5</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
  ]
  const nMentors = rows.length
  const withR = rows.filter((r: any) => r.overall != null)
  const avgRating = withR.length ? withR.reduce((s: number, r: any) => s + r.overall, 0) / withR.length : null
  const avgReadiness = nMentors ? rows.reduce((s: number, r: any) => s + r.readiness, 0) / nMentors : 0
  const atRisk = rows.filter((r: any) => r.risk >= 60).length
  // needs attention = average rating below 3 (to date)
  const attention = rows.filter((r: any) => r.overall != null && r.overall < 3).sort((a: any, b: any) => a.overall - b.overall)
  const kpis: any[] = [
    ['Mentors', String(nMentors), 'Active mentors in your view.'],
    ['Avg readiness', `${Math.round(avgReadiness * 100)}%`, 'Average % of the 4 prep steps completed across all assigned topics.'],
    ['Avg rating', avgRating != null ? avgRating.toFixed(1) : '—', "Average of each mentor's rating to date (per-category averages, day one to now), out of 5."],
    ['At risk', String(atRisk), RISK_INFO],
  ]
  return <div>
    <div style={{ fontSize: 12, color: '#9aa1ad', marginBottom: 12 }}>{isAdmin ? 'All leads · whole company' : 'Your mentors only'}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: 18 }}>
      {kpis.map((k: any, i: number) => (
        <div key={i} style={{ background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, color: '#69707d' }}>{k[0]}<InfoDot text={k[2]} /></div>
          <div style={{ fontSize: 24, fontWeight: 800, color: k[0] === 'At risk' && atRisk > 0 ? '#dc2626' : '#161a22' }}>{k[1]}</div>
        </div>
      ))}
    </div>
    <Card style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>Rating history — day one to date<InfoDot text="Every rating each mentor has received since day one, with their subject and the dates. Expand a row to see the per-category average on top, then each day's scores." /></div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <Input allowClear prefix={<SearchOutlined style={{ color: '#9aa1ad' }} />} placeholder="Search mentor…" value={histQ} onChange={e => setHistQ(e.target.value)} style={{ maxWidth: 260 }} />
        <Select allowClear showSearch optionFilterProp="label" placeholder="All subjects" value={histSubj} onChange={(v) => setHistSubj(v ?? null)} style={{ minWidth: 190 }} options={histSubjOpts.map((s) => ({ value: s, label: s }))} />
        <Select allowClear placeholder="All ratings" value={histBand} onChange={(v) => setHistBand(v ?? null)} style={{ minWidth: 210 }} options={RATING_BANDS} />
        {(histSubj || histBand || histQ.trim()) && <>
          <Tag color="blue">{histShown.length} mentor{histShown.length === 1 ? '' : 's'}</Tag>
          <Button size="small" type="text" onClick={() => { setHistQ(''); setHistSubj(null); setHistBand(null) }}>Clear</Button>
        </>}
      </div>
      <Table size="small" rowKey="key" columns={histCols as any} dataSource={histShown} pagination={{ pageSize: 12 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No ratings yet — rate mentors from the Mentor Preparation Board." /> }}
        expandable={{
          rowExpandable: (rec: any) => rec.count > 0,
          expandedRowRender: (rec: any) => {
            // one row per day; each rating category is its own column (mock & etiquette are daily)
            const byDate: any = {}
            rec.entries.forEach((e: any) => { (byDate[e.rated_on] = byDate[e.rated_on] || []).push(e) })
            const subRows = Object.keys(byDate).sort().map((dt: string) => {
              const es = byDate[dt]
              const scoreByCat: any = {}; es.forEach((e: any) => { scoreByCat[e.category] = Number(e.score) })
              // subject/topic label comes ONLY from a technical (topic-scoped) rating — a daily etiquette
              // entry (even one with a legacy scope_id) must never masquerade as a topic rating.
              const scoped = es.find((e: any) => e.scope_id && TECH_CAT_KEYS.has(e.category)); const tm = scoped ? d.topicMap[scoped.scope_id] : null
              const hasDaily = es.some((e: any) => DAILY_CAT_KEYS.has(e.category))
              const row: any = { key: dt, date: dt, subject: tm?.subject || '—', topic: tm?.topic || (hasDaily && !tm ? 'Daily etiquette' : '—') }
              RATING_CATS.forEach(c => { row[c.key] = scoreByCat[c.key] })
              return row
            })
            // per-category average from day one to date — shown as the FIRST row (on top), before the date-wise rows
            const catAvg: any = {}; RATING_CATS.forEach(c => { const vv = rec.entries.filter((e: any) => e.category === c.key && e.score != null).map((e: any) => Number(e.score)); catAvg[c.key] = vv.length ? vv.reduce((a: number, b: number) => a + b, 0) / vv.length : null })
            const avgRow: any = { key: '__avg', _avg: true }; RATING_CATS.forEach(c => { avgRow[c.key] = catAvg[c.key] })
            const catCols = RATING_CATS.map(c => ({ title: c.label, dataIndex: c.key, width: 92, align: 'center' as const, render: (v: number, r: any) => r._avg ? <b>{v != null ? v.toFixed(2) : '—'}</b> : (v != null ? v.toFixed(1) : <span style={{ color: '#d9d9d9' }}>—</span>) }))
            return <Table size="small" rowKey="key" pagination={false} scroll={{ x: 'max-content' }} dataSource={[avgRow, ...subRows]}
              onRow={(r: any) => (r._avg ? { style: { background: '#f6f8ff' } } : {})}
              columns={[
                { title: 'Date', dataIndex: 'date', width: 130, fixed: 'left' as const, render: (v: string, r: any) => r._avg ? <b>Average (till date)</b> : dayjs(v).format('DD MMM YYYY') },
                { title: 'Subject', dataIndex: 'subject', width: 120 },
                { title: 'Topic', dataIndex: 'topic', width: 140 },
                ...catCols,
              ] as any} />
          },
        }} />
    </Card>
    <Card styles={{ body: { padding: 16 } }}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>Needs attention<InfoDot text="Mentors whose average rating to date is below 3 / 5." /></div>
      {attention.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No mentors below 3 — everyone on track." /> : attention.map((r: any) => (
        <div key={r.m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ width: 46, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15, color: '#dc2626', background: '#dc262618' }}>{r.overall.toFixed(1)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{r.m.full_name}</div>
            <div style={{ fontSize: 12, color: '#9aa1ad' }}>{mentorSubjectOf(r.m.id) || 'No subject yet'}</div>
          </div>
          <Tag color="red">Avg {r.overall.toFixed(2)} / 5</Tag>
        </div>
      ))}
    </Card>
  </div>
}
// ===================== team performance (Management → Tab 3) =====================
// Trainers + mentors under a leader. Lead → their team only; Program Head → everyone (with the lead shown).
function TeamPerformance() {
  const { person } = useAuth()
  const isAdmin = person?.role === 'admin'
  const [d, setD] = useState<any>(null)
  async function load() {
    const pp = await supabase.from('person').select('id, full_name, role, is_active, lead_id')
    const people = (pp.data || []).filter((x: any) => x.is_active)
    const nameById: any = {}; people.forEach((x: any) => nameById[x.id] = x.full_name)
    const ms = await supabase.from('main_subject').select('id, name, default_trainer_id')
    const progLead: any = {}; (ms.data || []).forEach((m: any) => progLead[m.id] = m.default_trainer_id)
    let leadPrograms: Set<string> | null = null
    if (!isAdmin) {
      const sj = await supabase.from('subject').select('main_subject_id').eq('default_trainer_id', person.id)
      leadPrograms = new Set<string>()
      ;(ms.data || []).forEach((m: any) => { if (m.default_trainer_id === person.id) leadPrograms!.add(m.id) })
      ;(sj.data || []).forEach((s: any) => s.main_subject_id && leadPrograms!.add(s.main_subject_id))
    }
    const ci = await selectAll('content_item', 'id, item_stage(status, stage:stage_id(name, sequence)), subtopic:subtopic_id(name, topic:topic_id(name, chapter:chapter_id(subject:subject_id(name, main_subject:main_subject_id(id, name)))))')
    const ow = await selectAll('v_item_owner', 'content_item_id, trainer_id')
    const ownerByItem: any = {}; ow.forEach((o: any) => ownerByItem[o.content_item_id] = o.trainer_id)
    const mp = await supabase.from('mentor_prep').select('mentor_id, review_status, watched, notes_done, practice_done, presentation_done, state, topic:topic_id(name, chapter:chapter_id(name, subject:subject_id(name, main_subject:main_subject_id(id, name))))')
    const mr = await selectAll('mentor_rating', 'mentor_id, category, score, weight_snapshot, rated_on') // page past the 1000-row cap
    setD({ people, nameById, progLead, leadPrograms, ci: ci || [], ownerByItem, mp: (mp.data || []).filter((x: any) => (x.state || 'active') !== 'withdrawn'), mr })
  }
  useEffect(() => { if (person?.id) load() }, [person?.id])
  if (!d) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  const inScope = (progId: any) => d.leadPrograms ? d.leadPrograms.has(progId) : true
  const STEPS = ['watched', 'notes_done', 'practice_done', 'presentation_done']
  const trainerStat: any = {}, trainerItems: any = {}
  d.ci.forEach((c: any) => {
    const tid = d.ownerByItem[c.id]; if (!tid) return
    const sj = c.subtopic?.topic?.chapter?.subject; const prog = sj?.main_subject?.id; if (!inScope(prog)) return
    const stages = (c.item_stage || []).slice().sort((a: any, b: any) => (a.stage?.sequence || 0) - (b.stage?.sequence || 0))
    const cur = stages.find((s: any) => s.status !== 'Completed'); const done = stages.length > 0 && !cur
    const e = trainerStat[tid] || (trainerStat[tid] = { total: 0, done: 0, prog }); e.total++; if (done) e.done++
    ;(trainerItems[tid] = trainerItems[tid] || []).push({ name: c.subtopic?.name || '—', path: `${sj?.main_subject?.name || ''} › ${sj?.name || ''}`, stage: done ? 'Published' : (cur?.stage?.name || '—') })
  })
  const mentorStat: any = {}, mentorItems: any = {}
  d.mp.forEach((p: any) => {
    const prog = p.topic?.chapter?.subject?.main_subject?.id; if (!inScope(prog)) return
    const e = mentorStat[p.mentor_id] || (mentorStat[p.mentor_id] = { total: 0, ready: 0, steps: 0 })
    const nDone = STEPS.filter(k => p[k]).length
    e.total++; if ((p.review_status || 'open') === 'completed') e.ready++; e.steps += nDone
    const rs = p.review_status || 'open'
    ;(mentorItems[p.mentor_id] = mentorItems[p.mentor_id] || []).push({ name: p.topic?.name || '—', path: `${p.topic?.chapter?.subject?.main_subject?.name || ''} › ${p.topic?.chapter?.subject?.name || ''}`, stage: rs === 'completed' ? 'Completed' : rs === 'ready_for_review' ? 'In review' : `Step ${Math.min(nDone + 1, 4)}/4` })
  })
  // overall rating = mean of per-category averages (each category averaged day one to date)
  const ratingByMentor: any = {}; const byM: any = {}; d.mr.forEach((x: any) => { if (x.score != null) ((byM[x.mentor_id] = byM[x.mentor_id] || {})[x.category] = (byM[x.mentor_id][x.category] || [])).push(Number(x.score)) })
  Object.keys(byM).forEach(mid => { const avgs = Object.keys(byM[mid]).map((c) => byM[mid][c].reduce((a: number, b: number) => a + b, 0) / byM[mid][c].length); ratingByMentor[mid] = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null })
  const rows: any[] = []
  d.people.filter((x: any) => x.role === 'trainer').forEach((t: any) => { const s = trainerStat[t.id]; if (s) rows.push({ id: t.id, name: t.full_name, role: 'Trainer', lead: d.nameById[d.progLead[s.prog]] || '—', a: s.total, b: s.done, pct: s.total ? Math.round(s.done / s.total * 100) : 0, rating: null, items: trainerItems[t.id] || [] }) })
  d.people.filter((x: any) => x.role === 'mentor').forEach((m: any) => { const s = mentorStat[m.id]; if (s) rows.push({ id: m.id, name: m.full_name, role: 'Mentor', lead: d.nameById[m.lead_id] || '—', a: s.total, b: s.ready, pct: s.total ? Math.round(s.steps / (s.total * 4) * 100) : 0, rating: ratingByMentor[m.id], items: mentorItems[m.id] || [] }) })
  const cols: any[] = [
    { title: 'Team member', render: (_: any, r: any) => <span><Avatar size={22} style={{ background: r.role === 'Mentor' ? '#c2410c' : '#a855f7', marginRight: 6, fontSize: 10 }}>{(r.name || '?')[0]}</Avatar>{r.name}</span> },
    { title: 'Role', dataIndex: 'role', width: 90, render: (v: string) => <Tag color={v === 'Mentor' ? 'volcano' : 'purple'}>{v}</Tag> },
    ...(isAdmin ? [{ title: 'Managed by', dataIndex: 'lead', width: 150 }] : []),
    { title: 'Assigned', dataIndex: 'a', width: 90 },
    { title: 'Done / ready', dataIndex: 'b', width: 110 },
    { title: 'Progress', dataIndex: 'pct', width: 160, render: (v: number) => <Progress percent={v} size="small" strokeColor={PRIMARY} /> },
    { title: 'Avg rating', width: 100, render: (_: any, r: any) => r.rating != null ? r.rating.toFixed(1) + ' / 5' : '—' },
  ]
  return <div>
    <div style={{ fontSize: 12, color: '#9aa1ad', marginBottom: 12 }}>{isAdmin ? 'All teams · everyone, grouped by their lead' : 'Your team — trainers and mentors in your programs'}</div>
    <Card styles={{ body: { padding: 16 } }}><Table size="middle" rowKey="id" columns={cols} dataSource={rows} pagination={{ pageSize: 15 }}
      expandable={{ expandedRowRender: (r: any) => (
        <div style={{ padding: '4px 8px' }}>
          <div style={{ fontSize: 12, color: '#69707d', marginBottom: 6 }}>What {r.name} is working on ({r.items.length})</div>
          {r.items.length === 0 ? <span style={{ color: '#9aa1ad', fontSize: 13 }}>Nothing assigned.</span> : r.items.map((it: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderTop: i ? '1px solid #f0f0f0' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}><span style={{ fontWeight: 600, fontSize: 13 }}>{it.name}</span> <span style={{ fontSize: 11, color: '#9aa1ad' }}>· {it.path}</span></div>
              <Tag color={it.stage === 'Published' || it.stage === 'Completed' ? 'green' : it.stage === 'In review' ? 'blue' : 'orange'}>{it.stage}</Tag>
            </div>
          ))}
        </div>
      ) }}
      locale={{ emptyText: <Empty description="No team members in scope yet" /> }} /></Card>
  </div>
}
function Management() {
  const { person } = useAuth()
  // hard gate: Management (incl. Team performance + Mentor analytics) is for Program Head / managers / team leads ONLY
  if (!(person?.role === 'admin' || OWNER_ROLES.includes(person?.role))) {
    return <div><PageHead title="Management" /><Card><Empty description="Management is available to the Program Head, managers and team leads only." /></Card></div>
  }
  return <Tabs defaultActiveKey="dev" items={[
    { key: 'dev', label: 'Training development', children: <ManagementDashboard /> },
    { key: 'team', label: 'Team performance', children: <TeamPerformance /> },
  ]} />
}
function ManagementDashboard() {
  const nav = useNavigate()
  const [d, setD] = useState<any>(null)
  useEffect(() => {
    (async () => {
      const items = await fetchAllItems()
      let q = await supabase.from('video_version').select('quality_rating, feedback')
      if (q.error) q = await supabase.from('video_version').select('quality_rating')
      const ppl = await supabase.from('person').select('role')
      const studiosC = await supabase.from('studio').select('id', { count: 'exact', head: true })
      const sl = await supabase.from('slot').select('studio_id, slot_status, reason_missed, studio:studio_id(name)')
      const et = await supabase.from('editing_task').select('final_output')
      const subj = await supabase.from('v_subject_completion').select('*')
      const breached = await supabase.from('item_stage').select('id', { count: 'exact', head: true }).eq('breached', true)
      const dueRes = await supabase.from('main_subject').select('id, due_date')
      const stagesRes = await supabase.from('stage').select('name, sla_days')
      const dueByProg: Record<string, string | null> = {}; (dueRes.data || []).forEach((r: any) => { dueByProg[r.id] = r.due_date })
      const slaByStage: Record<string, number> = {}; (stagesRes.data || []).forEach((s: any) => { slaByStage[s.name] = s.sla_days || 0 })
      // ----- mentor deployment readiness (the final shipment step) -----
      const mp = await supabase.from('mentor_prep').select('watched, notes_done, practice_done, presentation_done, mentor:mentor_id(full_name)')
      const mpRows: any[] = mp.error ? [] : (mp.data || [])
      const isReady = (r: any) => r.watched && r.notes_done && r.practice_done && r.presentation_done
      const mByMentor: Record<string, any> = {}
      mpRows.forEach((r: any) => { const n = r.mentor?.full_name || '—'; mByMentor[n] = mByMentor[n] || { name: n, topics: 0, ready: 0 }; mByMentor[n].topics++; if (isReady(r)) mByMentor[n].ready++ })
      const mentor = { available: !mp.error, total: mpRows.length, ready: mpRows.filter(isReady).length, byMentor: (Object.values(mByMentor) as any[]).sort((a: any, b: any) => b.ready - a.ready) }
      const today = dayjs()
      let weightedDone = 0, published = 0, inprog = 0
      const dist: any = {}
      items.forEach((it: any) => {
        const stages: any[] = Object.values(it.byCode)
        const done = stages.filter(s => s.status === 'Completed').length
        weightedDone += it.completion / 100
        if (done === stages.length) published++; else if (done > 0) inprog++
        dist[it.stageName] = (dist[it.stageName] || 0) + 1
      })
      const itemCount = items.length
      const overall = itemCount ? Math.round(weightedDone / itemCount * 100) : 0
      const qd: any = { Excellent: 0, Good: 0, Average: 0, Poor: 0 }
      ;(q.data || []).forEach((x: any) => { if (x.quality_rating) qd[x.quality_rating]++ })
      const qTotal = QUALITY_OPTS.reduce((a, k) => a + qd[k], 0)
      const poorShare = qTotal ? Math.round(((qd.Average + qd.Poor) / qTotal) * 100) : 0
      // ----- reviewer sentiment (keyword heuristic over written feedback) -----
      const POS = ['clear', 'great', 'crisp', 'excellent', 'good', 'well', 'sharp', 'smooth', 'engaging', 'clean', 'energy', 'nice', 'ready']
      const NEG = ['muffled', 'rush', 'rushed', 'dark', 'noisy', 'noise', 'retake', 'reshoot', 'poor', 'blurry']
      const sent: any = { Positive: 0, Neutral: 0, Concern: 0 }; const comments: any[] = []
      ;(q.data || []).forEach((x: any) => {
        if (!x.feedback) return
        const t = String(x.feedback).toLowerCase()
        const s = NEG.some(w => t.includes(w)) ? 'Concern' : (POS.some(w => t.includes(w)) ? 'Positive' : 'Neutral')
        sent[s]++; comments.push({ text: x.feedback, s })
      })
      const sentTotal = sent.Positive + sent.Neutral + sent.Concern
      const topComments = [...comments].sort((a, b) => (a.s === 'Concern' ? -1 : 1) - (b.s === 'Concern' ? -1 : 1)).slice(0, 4)
      // ----- capacity vs benchmark (sample: clear the backlog in ~6 weeks) -----
      const roles: any = {}; (ppl.data || []).forEach((p: any) => { roles[p.role] = (roles[p.role] || 0) + 1 })
      const backlog = itemCount - published
      const HORIZON = 30 // working days (~6 weeks)
      const PERDAY: any = { Studios: 2, Trainers: 1, Editors: 2 }
      const actualRes: any = { Studios: studiosC.count || 0, Trainers: roles.trainer || 0, Editors: roles.editor || 0 }
      const benchRows = ['Studios', 'Trainers', 'Editors'].map(k => {
        const Recommended = Math.max(1, Math.ceil(backlog / (PERDAY[k] * HORIZON)))
        return { name: k, Recommended, Actual: actualRes[k], gap: Math.max(0, Recommended - actualRes[k]) }
      })
      const capGap = benchRows.reduce((a, r) => a + r.gap, 0)
      const stMap: any = {}
      ;(sl.data || []).forEach((x: any) => { const n = x.studio?.name || '—'; stMap[n] = (stMap[n] || 0) + 1 })
      const missed = (sl.data || []).filter((x: any) => ['Missed', 'Swapped', 'Rescheduled'].includes(x.slot_status)).length
      const fo: any = { Pending: 0, 'In Progress': 0, Completed: 0 } // 'Final Output completed' stat = Output completed (+ legacy Completed)
      ;(et.data || []).forEach((x: any) => { const s = (x.final_output === 'Output completed' || x.final_output === 'Completed') ? 'Completed' : x.final_output; if (fo[s] !== undefined) fo[s]++ })
      const STAGE_DEFS: [string, number][] = [['PPT', 1], ['Script', 2], ['Presentation', 3], ['Shooting', 4], ['Shooting Review', 5], ['Editing', 6], ['Final Review', 7]]
      const cumByStage: number[] = STAGE_DEFS.map(() => 0); const delayByStage: any = {}
      items.forEach((it: any) => {
        const seqStages = (Object.values(it.byCode) as any[]).sort((a: any, b: any) => a.seq - b.seq)
        let chainOk = true
        STAGE_DEFS.forEach(([, sq], i) => {
          const st = seqStages.find((s: any) => s.seq === sq)
          if (chainOk && st && st.status === 'Completed') cumByStage[i]++; else chainOk = false
        })
        ;(Object.values(it.byCode) as any[]).forEach((s: any) => { if (s.delay > 0) delayByStage[s.name] = (delayByStage[s.name] || 0) + s.delay })
      })
      const funnelData = STAGE_DEFS.map(([nm], i) => ({ name: nm, value: cumByStage[i] }))
      const delayData = STAGE_DEFS.map(([nm]) => ({ name: nm, delay: delayByStage[nm] || 0 }))
      const topDelay = [...delayData].sort((a, b) => b.delay - a.delay)[0]
      const stuck = (Object.entries(dist) as any[]).filter(([k]) => k !== 'Done' && k !== 'Published').sort((a, b) => b[1] - a[1])[0]
      // ----- (1) On-time delivery / schedule health + (3) subject health (both walk items once) -----
      let onTrack = 0, atRisk = 0, overdue = 0, deliveredOnTime = 0, deliveredLate = 0
      const sHealth: Record<string, any> = {}
      items.forEach((it: any) => {
        const stages: any[] = Object.values(it.byCode)
        const isPub = stages.filter(s => s.status === 'Completed').length === stages.length
        const hasDelay = stages.some(s => (s.delay || 0) > 0)
        const due = dueByProg[it.programId]
        const progOverdue = !!due && dayjs(due).isBefore(today, 'day') && !isPub
        if (isPub) { hasDelay ? deliveredLate++ : deliveredOnTime++ }
        else if (progOverdue) overdue++
        else if (hasDelay) atRisk++
        else onTrack++
        const k = it.subject || '—'
        sHealth[k] = sHealth[k] || { name: k, items: 0, sumc: 0, published: 0, overdue: false }
        sHealth[k].items++; sHealth[k].sumc += it.completion; if (isPub) sHealth[k].published++
        if (progOverdue) sHealth[k].overdue = true
      })
      const inFlight = onTrack + atRisk + overdue
      const onTimePct = inFlight ? Math.round((onTrack / inFlight) * 100) : 100
      const onTime = { onTrack, atRisk, overdue, deliveredOnTime, deliveredLate, inFlight, onTimePct }
      const subjectHealth = (Object.values(sHealth) as any[]).map((s: any) => ({ name: s.name, items: s.items, published: s.published, overdue: s.overdue, completion: s.items ? Math.round(s.sumc / s.items) : 0 })).sort((a: any, b: any) => a.completion - b.completion)
      // portfolio status donut (by sub-topic)
      const notStarted = itemCount - published - inprog
      const portfolioStatus = [
        { name: 'Completed', value: published, color: '#16a34a' },
        { name: 'In progress', value: inprog, color: '#2563eb' },
        { name: 'Not started', value: Math.max(0, notStarted), color: '#cbd5e1' },
      ]
      // completion distribution — how many subjects sit in each band
      const bands = [{ name: '0%', min: 0, max: 0 }, { name: '1–25%', min: 1, max: 25 }, { name: '26–50%', min: 26, max: 50 }, { name: '51–75%', min: 51, max: 75 }, { name: '76–99%', min: 76, max: 99 }, { name: '100%', min: 100, max: 100 }]
      const distBuckets = bands.map(b => ({ name: b.name, value: subjectHealth.filter((s: any) => s.completion >= b.min && s.completion <= b.max).length }))
      // program heatmap — tile size by # sub-topics, colour by completion
      const pHealth: Record<string, any> = {}
      items.forEach((it: any) => { const k = it.program || '—'; const isPub = (Object.values(it.byCode) as any[]).filter((s: any) => s.status === 'Completed').length === (Object.values(it.byCode) as any[]).length; pHealth[k] = pHealth[k] || { name: k, items: 0, sumc: 0 }; pHealth[k].items++; pHealth[k].sumc += it.completion })
      const programHealth = (Object.values(pHealth) as any[]).map((p: any) => ({ name: p.name, size: p.items, completion: p.items ? Math.round(p.sumc / p.items) : 0 })).sort((a: any, b: any) => b.size - a.size)
      // ----- (2) Why we're slipping — delay root causes from missed/rescheduled slots -----
      const reasonCount: Record<string, number> = {}
      ;(sl.data || []).forEach((x: any) => { if (['Missed', 'Swapped', 'Rescheduled'].includes(x.slot_status) && x.reason_missed) reasonCount[x.reason_missed] = (reasonCount[x.reason_missed] || 0) + 1 })
      const reasonData = Object.entries(reasonCount).map(([name, value]) => ({ name, value })).sort((a: any, b: any) => b.value - a.value)
      // ----- (4) Pipeline bottleneck — delay-days vs each stage's SLA target -----
      const stageCount: Record<string, number> = {}
      items.forEach((it: any) => (Object.values(it.byCode) as any[]).forEach((s: any) => { stageCount[s.name] = (stageCount[s.name] || 0) + 1 }))
      const bottleneckData = STAGE_DEFS.map(([nm]) => ({ name: nm, delay: delayByStage[nm] || 0, sla: slaByStage[nm] || 0, avgDelay: stageCount[nm] ? +(((delayByStage[nm] || 0) / stageCount[nm]).toFixed(1)) : 0 }))
      const worstStage = [...bottleneckData].sort((a, b) => b.delay - a.delay)[0]
      setD({ itemCount, overall, published, inprog, pending: itemCount - published, dist, qd, qTotal, poorShare, stMap, missed, fo, subjects: subj.data || [], breached: breached.count || 0, funnelData, delayData, topDelay, stuck, sent, sentTotal, topComments, benchRows, capGap, backlog, onTime, reasonData, subjectHealth, bottleneckData, worstStage, portfolioStatus, distBuckets, programHealth, mentor })
    })()
  }, [])
  if (!d) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  const STAGES: [string, number][] = [['PPT', 1], ['Script', 2], ['Presentation', 3], ['Shooting', 4], ['Shooting Review', 5], ['Editing', 6], ['Final Review', 7]]
  const maxStudio = Math.max(1, ...Object.values(d.stMap).map((x: any) => x as number))
  return (
    <div>
      <PageHead title="Management Dashboard" />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card hoverable onClick={() => nav('/content')}><Statistic title="Overall completion" value={d.overall} suffix="%" valueStyle={{ color: PRIMARY, fontWeight: 800 }} /></Card></Col>
        <Col xs={12} md={6}><Card hoverable onClick={() => nav('/content?stage=Published')}><Statistic title="Published to library" value={d.published} valueStyle={{ color: '#16a34a', fontWeight: 800 }} /></Card></Col>
        <Col xs={12} md={6}><Card hoverable onClick={() => nav('/content')}><Statistic title="Pending" value={d.pending} valueStyle={{ color: '#c2790a', fontWeight: 800 }} /></Card></Col>
        <Col xs={12} md={6}><Card hoverable onClick={() => nav('/sla')}><Statistic title="SLA breaches" value={d.breached} valueStyle={{ color: d.breached ? '#dc2626' : '#16a34a', fontWeight: 800 }} /></Card></Col>
      </Row>
      {d.mentor?.available && d.mentor.total > 0 && (
        <Card title="Mentor deployment readiness" extra={<span onClick={() => nav('/mentor')} style={{ fontSize: 11, color: PRIMARY, cursor: 'pointer' }}>open Mentor Management →</span>} style={{ marginBottom: 16 }}>
          <Row align="middle" gutter={16}>
            <Col xs={24} sm={8}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: '#16a34a' }}>{d.mentor.ready}<span style={{ fontSize: 18, color: '#9aa1ad', fontWeight: 600 }}> / {d.mentor.total}</span></div>
                <div style={{ fontSize: 12, color: '#69707d' }}>topics deploy-ready</div>
              </div>
            </Col>
            <Col xs={24} sm={16}>
              <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 6 }}>
                {d.mentor.byMentor.map((m: any) => (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                    <span style={{ width: 130, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{m.name}</span>
                    <Progress percent={m.topics ? Math.round(m.ready / m.topics * 100) : 0} size="small" strokeColor="#16a34a" style={{ flex: 1, margin: 0 }} />
                    <span style={{ width: 78, textAlign: 'right', fontSize: 12, color: '#69707d', flexShrink: 0 }}>{m.ready}/{m.topics} ready</span>
                  </div>
                ))}
              </div>
            </Col>
          </Row>
        </Card>
      )}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={10}>
          <Card title="On-time delivery — are we hitting due dates?" style={{ height: '100%' }}>
            <Row align="middle" gutter={12}>
              <Col xs={24} sm={11} style={{ textAlign: 'center' }}>
                <Progress type="dashboard" percent={d.onTime.onTimePct} strokeColor={d.onTime.onTimePct >= 80 ? '#16a34a' : d.onTime.onTimePct >= 50 ? '#c2790a' : '#dc2626'}
                  format={(p: any) => <span><div style={{ fontSize: 26, fontWeight: 800 }}>{p}%</div><div style={{ fontSize: 11, color: '#69707d' }}>on schedule</div></span>} />
              </Col>
              <Col xs={24} sm={13}>
                {[
                  { label: 'On track', value: d.onTime.onTrack, color: '#16a34a' },
                  { label: 'At risk (slipping)', value: d.onTime.atRisk, color: '#c2790a' },
                  { label: 'Overdue (past program due)', value: d.onTime.overdue, color: '#dc2626' },
                ].map((r: any) => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 8 }}>
                    <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: r.color, marginRight: 7 }} />{r.label}</span>
                    <b style={{ color: r.color }}>{r.value}</b>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #f0f1f4', marginTop: 6, paddingTop: 8, fontSize: 12, color: '#69707d' }}>
                  Delivered: <b style={{ color: '#16a34a' }}>{d.onTime.deliveredOnTime}</b> on time · <b style={{ color: '#dc2626' }}>{d.onTime.deliveredLate}</b> late
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <Card title="Why we're slipping — top delay reasons" extra={<span onClick={() => nav('/sla')} style={{ fontSize: 11, color: PRIMARY, cursor: 'pointer' }}>see missed slots →</span>} style={{ height: '100%' }}>
            {d.reasonData.length === 0 ? <div style={{ color: '#9aa1ad', fontSize: 13, padding: '60px 0', textAlign: 'center' }}>No missed / rescheduled recordings logged — nothing slipping. 🎉</div> : <>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={d.reasonData} layout="vertical" margin={{ left: 30, right: 30 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => [v + ' slots', 'Missed / rescheduled']} />
                  <Bar dataKey="value" fill="#dc2626" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                    <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 700 } as any} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 12, color: '#9aa1ad', marginTop: 6 }}>The top bar is your #1 cause of lost recording slots — fix that to recover the most time.</div>
            </>}
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={14}>
          <Card title="Production funnel — how far sub-topics have progressed" extra={<span style={{ fontSize: 11, color: '#9aa1ad' }}>where it narrows = pile-up</span>} style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height={290}>
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={d.funnelData} isAnimationActive={false}>
                  <LabelList position="right" fill="#161a22" stroke="none" dataKey="name" style={{ fontSize: 12, fontWeight: 600 } as any} />
                  <LabelList position="center" fill="#fff" stroke="none" dataKey="value" style={{ fontSize: 12, fontWeight: 700 } as any} />
                  {d.funnelData.map((_: any, i: number) => <Cell key={i} fill={STAGE_COLORS[i + 1]} />)}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
            <div style={{ color: '#16a34a', fontWeight: 600, fontSize: 12, marginTop: 4, textAlign: 'center' }}>✓ {d.published} published to the library</div>
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card title="Recording quality" extra={<span onClick={() => nav('/reviews')} style={{ fontSize: 11, color: PRIMARY, cursor: 'pointer' }}>rate in Reviews →</span>} style={{ height: '100%' }}>
            {d.qTotal === 0 ? <div style={{ color: '#9aa1ad', fontSize: 13, padding: '60px 0', textAlign: 'center' }}>No quality ratings yet — set them in Reviews.</div> : <>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Tooltip />
                  <Pie data={QUALITY_OPTS.map(k => ({ name: k, value: d.qd[k] }))} dataKey="value" nameKey="name" innerRadius={48} outerRadius={84} paddingAngle={2} isAnimationActive={false}>
                    {QUALITY_OPTS.map((k, i) => <Cell key={i} fill={qualityColor[k]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
                {QUALITY_OPTS.map(k => <span key={k} style={{ fontSize: 12, color: '#69707d' }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: qualityColor[k], marginRight: 5 }} />{k} {d.qd[k]}</span>)}
              </div>
            </>}
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={14}>
          <Card title="Capacity vs benchmark — are we resourced for the backlog?" extra={<span style={{ fontSize: 11, color: '#9aa1ad' }}>sample pace · clear backlog in ~6 weeks</span>} style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={d.benchRows} layout="vertical" margin={{ left: 20, right: 30 }} barGap={2}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12, fontWeight: 600 }} />
                <Tooltip />
                <Bar dataKey="Recommended" fill="#cbd5e1" radius={[0, 5, 5, 0]} isAnimationActive={false}><LabelList dataKey="Recommended" position="right" style={{ fontSize: 11, fill: '#69707d' } as any} /></Bar>
                <Bar dataKey="Actual" fill={PRIMARY} radius={[0, 5, 5, 0]} isAnimationActive={false}><LabelList dataKey="Actual" position="right" style={{ fontSize: 11, fontWeight: 700 } as any} /></Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: 12, color: '#69707d', margin: '2px 0 10px' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#cbd5e1', marginRight: 5 }} />Recommended</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: PRIMARY, marginRight: 5 }} />Actual</span>
            </div>
            {d.capGap > 0
              ? <div style={{ background: '#fdeaea', border: '1px solid #f6d2d2', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
                  ⚠️ <b>Under-capacity.</b> To clear the <b>{d.backlog}</b> pending sub-topics on time you’re short by {d.benchRows.filter((r: any) => r.gap > 0).map((r: any) => `${r.gap} ${r.name.toLowerCase().replace(/s$/, '')}${r.gap > 1 ? 's' : ''}`).join(', ')}.
                  {d.poorShare > 0 && <> Meanwhile <b>{d.poorShare}%</b> of rated recordings are Average/Poor — too few studios &amp; trainers means rushed shoots. <b>Closing the capacity gap is the lever to lift quality.</b></>}
                </div>
              : <div style={{ background: '#eafaf0', border: '1px solid #cdeeda', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>✓ Capacity meets the benchmark for the current backlog.</div>}
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card title="Reviewer sentiment" extra={<span onClick={() => nav('/reviews')} style={{ fontSize: 11, color: PRIMARY, cursor: 'pointer' }}>from feedback →</span>} style={{ height: '100%' }}>
            {d.sentTotal === 0 ? <div style={{ color: '#9aa1ad', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>No reviewer feedback yet — add notes in Reviews.</div> : <>
              <Row align="middle">
                <Col span={11}>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Tooltip />
                      <Pie data={SENTI.map(k => ({ name: k, value: d.sent[k] }))} dataKey="value" nameKey="name" innerRadius={38} outerRadius={64} paddingAngle={2} isAnimationActive={false}>
                        {SENTI.map((k, i) => <Cell key={i} fill={sentiColor[k]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </Col>
                <Col span={13}>
                  {SENTI.map(k => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: sentiColor[k], marginRight: 6 }} />{k}</span><b>{d.sent[k]} · {Math.round(d.sent[k] / d.sentTotal * 100)}%</b></div>)}
                </Col>
              </Row>
              <div style={{ marginTop: 6, borderTop: '1px solid #f0f1f4', paddingTop: 8 }}>
                {d.topComments.map((c: any, i: number) => <div key={i} style={{ fontSize: 12, color: '#69707d', marginBottom: 5, display: 'flex', gap: 6 }}><span style={{ color: sentiColor[c.s] }}>{c.s === 'Concern' ? '▼' : c.s === 'Positive' ? '▲' : '■'}</span><span>“{c.text}”</span></div>)}
              </div>
            </>}
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24}>
          <Card title="⏱ Where time is being lost — bottleneck analysis">
            {(!d.topDelay || d.topDelay.delay === 0) && !d.stuck ? <div style={{ color: '#9aa1ad', fontSize: 13 }}>No delays recorded yet — nothing is overdue. 🎉</div> : <>
              <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
                {d.stuck && <div style={{ background: '#fdf2dc', border: '1px solid #f4e2b8', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>📌 Most sub-topics are waiting at <b>{d.stuck[0]}</b> — <b>{d.stuck[1]}</b> stuck here</div>}
                {d.worstStage && d.worstStage.delay > 0 && <div style={{ background: '#fdeaea', border: '1px solid #f6d2d2', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>⏱ Biggest stall at <b>{d.worstStage.name}</b> — <b>{d.worstStage.delay}</b> delay-days beyond its <b>{d.worstStage.sla}-day</b> target (avg <b>+{d.worstStage.avgDelay}d</b> per sub-topic)</div>}
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={d.delayData} layout="vertical" margin={{ left: 30, right: 24 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => [v + ' delay-days', 'Time lost']} />
                  <Bar dataKey="delay" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                    {d.delayData.map((_: any, i: number) => <Cell key={i} fill={STAGE_COLORS[i + 1]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 12, color: '#9aa1ad', marginTop: 6 }}>The longest bar is the stage eating the most time — that's where to add capacity or chase.</div>
            </>}
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Catalog status — where all sub-topics stand">
            <Row align="middle">
              <Col xs={24} sm={12}>
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Tooltip formatter={(v: any, n: any) => [v + ' sub-topics', n]} />
                    <Pie data={d.portfolioStatus} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2} isAnimationActive={false}>
                      {d.portfolioStatus.map((x: any, i: number) => <Cell key={i} fill={x.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </Col>
              <Col xs={24} sm={12}>
                {d.portfolioStatus.map((x: any) => (
                  <div key={x.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, marginBottom: 12 }}>
                    <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: x.color, marginRight: 8 }} />{x.name}</span>
                    <b>{x.value} · {d.itemCount ? Math.round(x.value / d.itemCount * 100) : 0}%</b>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #f0f1f4', marginTop: 4, paddingTop: 8, fontSize: 12, color: '#69707d' }}>of {d.itemCount} sub-topics across the whole catalog</div>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Studio activity (slots booked)" style={{ marginBottom: 16 }}>
            {Object.keys(d.stMap).length === 0 ? <Empty description="No slots yet" /> : Object.entries(d.stMap).map(([nm, c]: any) => (
              <div key={nm} onClick={() => nav('/studio')} title="Open the Studio Board" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, cursor: 'pointer' }}>
                <span style={{ width: 80, fontWeight: 600, fontSize: 13 }}>{nm}</span>
                <Progress percent={Math.round(c / maxStudio * 100)} showInfo={false} strokeColor="#0d9488" style={{ flex: 1, margin: 0 }} />
                <b style={{ width: 36, textAlign: 'right' }}>{c}</b>
              </div>
            ))}
          </Card>
          <Row gutter={12}>
            <Col span={12}><Card hoverable onClick={() => nav('/editing')}><Statistic title="Final Output completed" value={d.fo.Completed} valueStyle={{ color: '#16a34a', fontWeight: 800 }} /></Card></Col>
            <Col span={12}><Card hoverable onClick={() => nav('/sla')}><Statistic title="Missed / swapped slots" value={d.missed} valueStyle={{ color: d.missed ? '#dc2626' : '#16a34a', fontWeight: 800 }} /></Card></Col>
          </Row>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={10}>
          <Card title="How far along are our subjects?" extra={<span style={{ fontSize: 11, color: '#9aa1ad' }}>shape of progress</span>} style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.distBuckets} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => [v + ' subjects', 'Count']} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  {d.distBuckets.map((_: any, i: number) => <Cell key={i} fill={['#dc2626', '#e8743b', '#c2790a', '#d4b106', '#52a91a', '#16a34a'][i]} />)}
                  <LabelList dataKey="value" position="top" style={{ fontSize: 12, fontWeight: 700 } as any} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 12, color: '#9aa1ad', marginTop: 4 }}>Tall on the left = lots not started; the bars shifting right over time = real progress.</div>
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <Card title="Portfolio heatmap — programs by size & completion" extra={<span style={{ fontSize: 11, color: '#9aa1ad' }}>big tile = more sub-topics · green = ahead, red = behind</span>} style={{ height: '100%' }}>
            {!d.programHealth.length ? <Empty description="No programs yet" /> : <ResponsiveContainer width="100%" height={300}>
              <Treemap data={d.programHealth} dataKey="size" nameKey="name" isAnimationActive={false} content={<HeatTile />} aspectRatio={4 / 3} stroke="#fff">
                <Tooltip formatter={(v: any) => [v + ' sub-topics', 'Size']} />
              </Treemap>
            </ResponsiveContainer>}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

/* ===================== asset management ===================== */
const ASSET_CATS = ['Lighting', 'Audio', 'Camera', 'Set', 'Furniture', 'Computing']
const ASSET_LOCS = ['Studio 1', 'Studio 2', 'Studio 3', 'Studio 4', 'Edit Bay', 'Store']
const ASSET_STATUS = ['Operational', 'Needs Repair', 'Out of Service']
const assetStatusColor: any = { 'Operational': 'green', 'Needs Repair': 'orange', 'Out of Service': 'red' }
const ASSET_CAT_COLOR: Record<string, string> = { Lighting: '#f59e0b', Audio: '#8b5cf6', Camera: '#0ea5e9', Set: '#0d9488', Furniture: '#ec4899', Computing: '#6366f1' }
const ASSET_EVENTS = ['Issued', 'Returned', 'Damaged', 'Repaired', 'Added', 'Adjusted']
const assetEventColor: any = { Issued: 'gold', Returned: 'blue', Damaged: 'red', Repaired: 'green', Added: 'geekblue', Adjusted: 'default' }

function AssetManager() {
  const { can } = useAuth()
  const { message: msg } = AntApp.useApp()
  const isAdmin = can('/assets') // edit rights follow Menu-Access for the Assets screen
  const [rows, setRows] = useState<any>(null)
  const [missing, setMissing] = useState(false)
  const [edit, setEdit] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [logFor, setLogFor] = useState<any>(null)
  const [f] = Form.useForm()
  const [lf] = Form.useForm()
  async function load() {
    const { data, error } = await supabase.from('asset').select('*').order('category').order('name')
    if (error) { setMissing(true); setRows([]); return }
    setMissing(false); setRows(data || [])
    const ev = await supabase.from('asset_event').select('*, asset:asset_id(name, category)').order('event_date', { ascending: false }).order('created_at', { ascending: false })
    setEvents(ev.error ? [] : (ev.data || []))
  }
  useEffect(() => { load() }, [])
  useAutoRefresh(load)
  function openNew() { setEdit({}); f.resetFields(); f.setFieldsValue({ category: 'Lighting', location: 'Store', status: 'Operational', qty_total: 1, qty_in_use: 0, qty_damaged: 0 }) }
  function openEdit(r: any) { setEdit(r); f.resetFields(); f.setFieldsValue(r) }
  async function save() {
    const v = await f.validateFields()
    const payload: any = { name: v.name, category: v.category, location: v.location, status: v.status, notes: v.notes || null, qty_total: Number(v.qty_total) || 0, qty_in_use: Number(v.qty_in_use) || 0, qty_damaged: Number(v.qty_damaged) || 0, updated_at: new Date().toISOString() }
    const res = edit?.id ? await supabase.from('asset').update(payload).eq('id', edit.id) : await supabase.from('asset').insert(payload)
    if (res.error) { msg.error(res.error.message); return }
    msg.success(edit?.id ? 'Asset updated ✓' : 'Asset added ✓'); setEdit(null); load()
  }
  async function remove(r: any) {
    const { error } = await supabase.from('asset').delete().eq('id', r.id)
    if (error) { msg.error(error.message); return }
    msg.success('Removed'); load()
  }
  function openLog(r: any) { setLogFor(r); lf.resetFields(); lf.setFieldsValue({ event_date: dayjs(), event_type: 'Issued', qty: 1, note: '' }) }
  async function saveLog() {
    const v = await lf.validateFields()
    const qty = Number(v.qty) || 0
    const ins = await supabase.from('asset_event').insert({ asset_id: logFor.id, event_date: v.event_date.format('YYYY-MM-DD'), event_type: v.event_type, qty, note: v.note || null })
    if (ins.error) { msg.error(/asset_event/.test(ins.error.message) ? 'Run RecTrack_v5.sql to enable the activity log.' : ins.error.message); return }
    let inUse = logFor.qty_in_use || 0, dmg = logFor.qty_damaged || 0
    if (v.event_type === 'Issued') inUse += qty
    else if (v.event_type === 'Returned') inUse = Math.max(0, inUse - qty)
    else if (v.event_type === 'Damaged') dmg += qty
    else if (v.event_type === 'Repaired') dmg = Math.max(0, dmg - qty)
    if (['Issued', 'Returned', 'Damaged', 'Repaired'].includes(v.event_type)) {
      await supabase.from('asset').update({ qty_in_use: inUse, qty_damaged: dmg, updated_at: new Date().toISOString() }).eq('id', logFor.id)
    }
    msg.success('Activity logged ✓'); setLogFor(null); load()
  }
  if (rows === null) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  if (missing) return <div>
    <PageHead title="Asset Management" sub="Studio & production equipment inventory" />
    <Card><Empty description={<span>The <b>asset</b> table isn’t set up yet.<br />Run <b>RecTrack_v5.sql</b> in Supabase → SQL Editor to enable Asset Management.</span>} /></Card>
  </div>
  const totalUnits = rows.reduce((a: number, r: any) => a + (r.qty_total || 0), 0)
  const damagedUnits = rows.reduce((a: number, r: any) => a + (r.qty_damaged || 0), 0)
  const inUseUnits = rows.reduce((a: number, r: any) => a + (r.qty_in_use || 0), 0)
  const availableUnits = rows.reduce((a: number, r: any) => a + Math.max(0, (r.qty_total || 0) - (r.qty_damaged || 0) - (r.qty_in_use || 0)), 0)
  const damageByCat = ASSET_CATS.map(c => ({ name: c, damaged: rows.filter((r: any) => r.category === c).reduce((a: number, r: any) => a + (r.qty_damaged || 0), 0) })).filter(x => x.damaged > 0)
  const eventsByAsset: any = {}; events.forEach((e: any) => { (eventsByAsset[e.asset_id] = eventsByAsset[e.asset_id] || []).push(e) })
  const cols: any[] = [
    { title: 'Item', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Category', dataIndex: 'category', width: 120, render: (v: string) => <Tag color={ASSET_CAT_COLOR[v]} style={{ borderColor: 'transparent' }}>{v}</Tag> },
    { title: 'Location', dataIndex: 'location', width: 110 },
    { title: 'Total', dataIndex: 'qty_total', width: 70, align: 'right' as const, render: (v: number) => <b>{v}</b> },
    { title: 'In use', dataIndex: 'qty_in_use', width: 80, align: 'right' as const, render: (v: number) => v > 0 ? <span style={{ color: '#c2790a', fontWeight: 700 }}>{v}</span> : <span style={{ color: '#9aa1ad' }}>0</span> },
    { title: 'Damaged', dataIndex: 'qty_damaged', width: 90, align: 'right' as const, render: (v: number) => v > 0 ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{v}</span> : <span style={{ color: '#9aa1ad' }}>0</span> },
    { title: 'Available', width: 85, align: 'right' as const, render: (_: any, r: any) => <span style={{ color: '#16a34a', fontWeight: 700 }}>{Math.max(0, (r.qty_total || 0) - (r.qty_damaged || 0) - (r.qty_in_use || 0))}</span> },
    { title: 'Condition', dataIndex: 'status', width: 130, render: (v: string) => <Tag color={assetStatusColor[v]}>{v}</Tag> },
    { title: 'Notes', dataIndex: 'notes', render: (v: string) => v ? <span style={{ color: '#69707d', fontSize: 12 }}>{v}</span> : <span style={{ color: '#cbd0d8' }}>—</span> },
  ]
  if (isAdmin) cols.push({
    title: '', width: 120, render: (_: any, r: any) => <span style={{ whiteSpace: 'nowrap' }}>
      <Button size="small" type="text" icon={<HistoryOutlined />} title="Log activity (issue / return / damage)" onClick={() => openLog(r)} />
      <Button size="small" type="text" icon={<EditOutlined />} title="Edit" onClick={() => openEdit(r)} />
      <Popconfirm title="Remove this asset?" okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => remove(r)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
    </span>,
  })
  return (
    <div>
      <PageHead title="Asset Management" sub="Studio & production equipment — inventory and damage tracking"
        extra={isAdmin ? <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>Add asset</Button> : <Tag>Read-only · ask the Program Head to edit</Tag>} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><LiveTile color="#0ea5e9" label="Total units" value={totalUnits} /></Col>
        <Col xs={12} md={6}><LiveTile color="#16a34a" label="Available" value={availableUnits} /></Col>
        <Col xs={12} md={6}><LiveTile color="#c2790a" label="In use (taken out)" value={inUseUnits} /></Col>
        <Col xs={12} md={6}><LiveTile color="#dc2626" label="Damaged units" value={damagedUnits} /></Col>
      </Row>
      {damageByCat.length > 0 && <Card title="Damaged units by category" style={{ marginBottom: 16 }} extra={<span style={{ fontSize: 11, color: '#9aa1ad' }}>where to budget repairs / replacements</span>}>
        <ResponsiveContainer width="100%" height={Math.max(120, damageByCat.length * 42)}>
          <BarChart data={damageByCat} layout="vertical" margin={{ left: 20, right: 24 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: any) => [v + ' damaged', 'Units']} />
            <Bar dataKey="damaged" radius={[0, 6, 6, 0]} isAnimationActive={false}>
              <LabelList dataKey="damaged" position="right" style={{ fontSize: 12, fontWeight: 700 } as any} />
              {damageByCat.map((x: any, i: number) => <Cell key={i} fill={ASSET_CAT_COLOR[x.name]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>}
      <Card title="Inventory" extra={<span style={{ fontSize: 11, color: '#9aa1ad' }}>click a row to see its activity history</span>}>
        <Table size="middle" pagination={false} columns={cols} dataSource={rows.map((r: any) => ({ ...r, key: r.id }))} locale={{ emptyText: <Empty description="No assets yet" /> }}
          expandable={{
            rowExpandable: () => true,
            expandedRowRender: (r: any) => {
              const evs = eventsByAsset[r.id] || []
              return evs.length
                ? <Table size="small" pagination={false} dataSource={evs.map((e: any, i: number) => ({ ...e, key: e.id || i }))} columns={[
                    { title: 'Date', dataIndex: 'event_date', width: 130, render: (v: string) => dayjs(v).format('DD MMM YYYY') },
                    { title: 'Activity', dataIndex: 'event_type', width: 120, render: (v: string) => <Tag color={assetEventColor[v]}>{v}</Tag> },
                    { title: 'Qty', dataIndex: 'qty', width: 70, align: 'right' as const },
                    { title: 'Note', dataIndex: 'note', render: (v: string) => v || '—' },
                  ] as any} />
                : <span style={{ color: '#9aa1ad', fontSize: 12 }}>No activity logged yet — use the Log (clock) button on this row.</span>
            },
          }} />
      </Card>
      <Card title="Recent activity" style={{ marginTop: 16 }} extra={<span style={{ fontSize: 11, color: '#9aa1ad' }}>date-wise log across all items</span>}>
        <Table size="small" pagination={{ pageSize: 8 }} dataSource={events.map((e: any, i: number) => ({ ...e, key: e.id || i }))}
          locale={{ emptyText: <Empty description="No activity yet — use the Log button on an item" /> }}
          columns={[
            { title: 'Date', dataIndex: 'event_date', width: 130, render: (v: string) => dayjs(v).format('DD MMM YYYY') },
            { title: 'Item', render: (_: any, e: any) => <b>{e.asset?.name || '—'}</b> },
            { title: 'Activity', dataIndex: 'event_type', width: 120, render: (v: string) => <Tag color={assetEventColor[v]}>{v}</Tag> },
            { title: 'Qty', dataIndex: 'qty', width: 70, align: 'right' as const },
            { title: 'Note', dataIndex: 'note', render: (v: string) => v ? <span style={{ color: '#69707d', fontSize: 12 }}>{v}</span> : '—' },
          ] as any} />
      </Card>
      <Modal open={!!logFor} title={logFor ? `Log activity — ${logFor.name}` : 'Log activity'} onOk={saveLog} onCancel={() => setLogFor(null)} okText="Save activity" forceRender>
        <Form form={lf} layout="vertical" style={{ marginTop: 12 }} preserve={false}>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="event_date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD MMM YYYY" /></Form.Item></Col>
            <Col span={12}><Form.Item name="event_type" label="Activity" rules={[{ required: true }]}><Select options={ASSET_EVENTS.map(o => ({ value: o, label: o }))} /></Form.Item></Col>
          </Row>
          <Form.Item name="qty" label="Quantity" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="note" label="Note"><Input.TextArea rows={2} placeholder="e.g. Issued to Studio 2 for Spring Boot shoot" /></Form.Item>
        </Form>
        <p style={{ fontSize: 12, color: '#9aa1ad', margin: 0 }}>Issued / Returned adjusts “In use”. Damaged / Repaired adjusts “Damaged”. Added / Adjusted are recorded for the log only.</p>
      </Modal>
      <Modal open={!!edit} title={edit?.id ? 'Edit asset' : 'Add asset'} onOk={save} onCancel={() => setEdit(null)} okText={edit?.id ? 'Save' : 'Add asset'} forceRender>
        <Form form={f} layout="vertical" style={{ marginTop: 12 }} preserve={false}>
          <Form.Item name="name" label="Item" rules={[{ required: true }]}><Input placeholder="e.g. LED Light Panel" /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="category" label="Category" rules={[{ required: true }]}><Select options={ASSET_CATS.map(o => ({ value: o, label: o }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="location" label="Location"><Select options={ASSET_LOCS.map(o => ({ value: o, label: o }))} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="qty_total" label="Total qty" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="qty_in_use" label="In use (taken)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="qty_damaged" label="Damaged"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="status" label="Condition" rules={[{ required: true }]}><Select options={ASSET_STATUS.map(o => ({ value: o, label: o }))} /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} placeholder="e.g. 3 panels flickering — sent to vendor" /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

/* ===================== assignments (drill-down tree) ===================== */
function Assignments() {
  const { canAssign, person, seesAll } = useAuth()
  const { message: msg } = AntApp.useApp()
  const [trainers, setTrainers] = useState<any[]>([])
  const [path, setPath] = useState<any[]>([]) // [{scope,id,name,ownId}]
  const [rows, setRows] = useState<any>(null)
  const tname = (tid: any) => trainers.find((t: any) => t.id === tid)?.full_name || '—'
  async function loadTrainers() {
    const tr = await supabase.from('person').select('id,full_name,role,is_active')
    // owners can be trainers, managers OR team leads (a lead/manager assigned to a level oversees everything under it)
    setTrainers((tr.data || []).filter((p: any) => (p.role === 'trainer' || OWNER_ROLES.includes(p.role)) && p.is_active)
      .map((p: any) => ({ ...p, full_name: ownerOptLabel(p) })))
  }
  async function loadLevel(p: any[], silent = false) {
    if (!silent) setRows(null)
    const parent = p[p.length - 1]
    const conf: any = !parent ? { table: 'main_subject', fk: null, scope: 'program' }
      : parent.scope === 'program' ? { table: 'subject', fk: 'main_subject_id', scope: 'subject' }
      : parent.scope === 'subject' ? { table: 'chapter', fk: 'subject_id', scope: 'chapter' }
      : parent.scope === 'chapter' ? { table: 'topic', fk: 'chapter_id', scope: 'topic' }
      : { table: 'subtopic', fk: 'topic_id', scope: 'subtopic' }
    let data: any[] = []
    if (conf.scope === 'subtopic') {
      const r = await supabase.from('subtopic').select('name, content_item(id, planned_trainer_id)').eq('topic_id', parent.id).order('name')
      data = (r.data || []).map((d: any) => { const ci = (d.content_item || [])[0]; return ci ? { id: ci.id, name: d.name, ownId: ci.planned_trainer_id || null } : null }).filter(Boolean)
    } else {
      const sel = async (cols: string) => { let qb: any = supabase.from(conf.table).select(cols); if (conf.fk) qb = qb.eq(conf.fk, parent.id); return qb.order('name') }
      let r: any = await sel('id,name,default_trainer_id')
      if (r.error) r = await sel('id,name') // before v7 the column doesn't exist yet
      data = (r.data || []).map((d: any) => ({ id: d.id, name: d.name, ownId: d.default_trainer_id || null }))
    }
    // PROGRAM level can have MULTIPLE trainers (v29) — attach the full set (falls back to the single primary)
    if (conf.scope === 'program') {
      let ptMap: Record<string, string[]> = {}
      if (MOCK_MENTOR_SUBTOPIC) ptMap = mockAllProgramTrainers()
      else { const pt = await supabase.from('program_trainer').select('main_subject_id, trainer_id'); if (!pt.error) (pt.data || []).forEach((x: any) => { (ptMap[x.main_subject_id] = ptMap[x.main_subject_id] || []).push(x.trainer_id) }) }
      data = data.map((d: any) => ({ ...d, trainerIds: ptMap[d.id]?.length ? ptMap[d.id] : (d.ownId ? [d.ownId] : []) }))
    }
    // a scoped owner (team lead / manager with "Sees all content" off) only sees the PROGRAMS assigned to them (primary OR co-assigned)
    if (!seesAll && conf.scope === 'program' && person?.id) data = data.filter((d: any) => d.ownId === person.id || (d.trainerIds || []).includes(person.id))
    setRows(data.map((d: any) => ({ ...d, scope: conf.scope })))
  }
  useEffect(() => { loadTrainers() }, [])
  useEffect(() => { loadLevel(path) }, [path])
  useAutoRefresh(() => loadLevel(path, true))
  const inherited = path.reduce((eff: any, n: any) => n.ownId || eff, null)
  async function assign(row: any, trainerId: any) {
    const { error } = await supabase.rpc('rt_set_owner', { scope: row.scope, ref_id: row.id, trainer: trainerId || null })
    if (error) { msg.error(/rt_set_owner|function|does not exist/.test(error.message) ? 'Run RecTrack_v7.sql to enable assignment.' : error.message); return }
    // Re-read what actually persisted so the row shows DB truth (not an optimistic guess) and surfaces silent write failures.
    const col = row.scope === 'subtopic' ? 'planned_trainer_id' : 'default_trainer_id'
    const tbl = row.scope === 'program' ? 'main_subject' : row.scope === 'subtopic' ? 'content_item' : row.scope
    const chk = await supabase.from(tbl).select(col).eq('id', row.id).maybeSingle()
    const saved = chk.data ? (chk.data as any)[col] || null : (trainerId || null)
    setRows((rs: any) => rs.map((r: any) => r.id === row.id ? { ...r, ownId: saved } : r))
    if (!trainerId) msg.success('Cleared')
    else if (saved) msg.success(`Assigned to ${tname(saved)} ✓`)
    else msg.warning("Saved request sent, but it came back unassigned — your role may lack assign permission (run RecTrack_v7+).")
  }
  // PROGRAM level: assign one or more trainers. The first is kept as the primary owner (drives v_item_owner
  // inheritance, unchanged); the full set goes to program_trainer to widen who can see/work the program.
  async function assignProgram(row: any, trainerIds: string[]) {
    const primary = trainerIds[0] || null
    if (MOCK_MENTOR_SUBTOPIC) { mockSaveProgramTrainers(row.id, trainerIds) }
    else {
      const { error } = await supabase.rpc('rt_set_owner', { scope: 'program', ref_id: row.id, trainer: primary })
      if (error) { msg.error(/rt_set_owner|function|does not exist/.test(error.message) ? 'Run RecTrack_v7.sql to enable assignment.' : error.message); return }
      await supabase.from('program_trainer').delete().eq('main_subject_id', row.id)
      if (trainerIds.length) { const ins = await supabase.from('program_trainer').insert(trainerIds.map((t: string) => ({ main_subject_id: row.id, trainer_id: t }))); if (ins.error) { msg.error(/program_trainer|relation|does not exist/.test(ins.error.message) ? 'Run RecTrack_v29.sql to enable multiple trainers.' : ins.error.message); return } }
    }
    setRows((rs: any) => rs.map((r: any) => r.id === row.id ? { ...r, ownId: primary, trainerIds } : r))
    msg.success(trainerIds.length ? `${trainerIds.length} trainer(s) assigned ✓` : 'Cleared')
  }
  function open(row: any) { if (row.scope !== 'subtopic') setPath(p => [...p, { scope: row.scope, id: row.id, name: row.name, ownId: row.ownId }]) }
  const levelLabel: any = { program: 'Program', subject: 'Subject', chapter: 'Chapter', topic: 'Topic', subtopic: 'Sub-topic' }
  const curLabel = rows && rows[0] ? levelLabel[rows[0].scope] : (!path.length ? 'Program' : 'Item')
  const cols = [
    { title: curLabel, dataIndex: 'name', render: (v: string, r: any) => r.scope === 'subtopic' ? <span>{v}</span> : <a onClick={() => open(r)} style={{ fontWeight: 600 }}>{v} <span style={{ color: '#9aa1ad' }}>›</span></a> },
    {
      title: 'Assigned trainer', width: 320, render: (_: any, r: any) => {
        if (!canAssign) {
          if (r.scope === 'program' && (r.trainerIds || []).length) return <span>{r.trainerIds.map((t: string) => <Tag key={t} color="purple" style={{ marginBottom: 2 }}>{tname(t)}</Tag>)}</span>
          return r.ownId ? <Tag color="purple">{tname(r.ownId)}</Tag> : inherited ? <Tag>↳ {tname(inherited)}</Tag> : <Tag>Unassigned</Tag>
        }
        if (r.scope === 'program') return <Select mode="multiple" size="small" style={{ width: 290 }} value={r.trainerIds || []} allowClear showSearch optionFilterProp="label" placeholder="Pick one or more trainers" onChange={(v) => assignProgram(r, v)} options={trainers.map((t: any) => ({ value: t.id, label: t.full_name }))} />
        return <Select size="small" style={{ width: 260 }} value={r.ownId || undefined} allowClear showSearch optionFilterProp="label" placeholder={inherited ? `↳ inherits ${tname(inherited)}` : 'Unassigned — pick a trainer'} onChange={(v) => assign(r, v)} options={trainers.map((t: any) => ({ value: t.id, label: t.full_name }))} />
      },
    },
  ]
  return <div>
    <PageHead title="Assignments" sub="Pick a Program → Subject → Chapter → Topic → Sub-topic. Assigning a level covers everything under it; a more specific level overrides it." />
    <Card>
      <Breadcrumb style={{ marginBottom: 14 }} items={[{ title: <a onClick={() => setPath([])}>Programs</a> }, ...path.map((n: any, i: number) => ({ title: i === path.length - 1 ? <b>{n.name}</b> : <a onClick={() => setPath(path.slice(0, i + 1))}>{n.name}</a> }))]} />
      {inherited && <div style={{ marginBottom: 12, fontSize: 13, color: '#69707d', background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 8, padding: '8px 12px' }}>Items here inherit <b>{tname(inherited)}</b> unless you give them their own.</div>}
      {!rows ? <div style={{ display: 'grid', placeItems: 'center', height: 200 }}><Spin /></div>
        : <Table size="middle" rowKey="id" columns={cols as any} dataSource={rows} pagination={{ pageSize: 15 }} locale={{ emptyText: <Empty description="Nothing here yet" /> }} />}
    </Card>
  </div>
}

/* ===================== my work (assigned items) ===================== */
// an editor's My Work is their scoped editing queue (same filterable table as the Editing tab)
function EditorMyWork() {
  const q = useEditingQueue()
  if (!q.items) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  return <div>
    <PageHead title="My Work" sub={`${q.scoped.length} video(s) assigned to you to edit`} />
    <EditingTable q={q} />
  </div>
}
function MyWork() {
  const { person } = useAuth()
  // leads / managers / mentors → My Work IS the consolidated workspace (training content + mentor management)
  if (OWNER_ROLES.includes(person?.role) || person?.role === 'mentor') return <MentorGeneration />
  return <MyWorkTrainer />
}
function MyWorkTrainer() {
  const { person, canAssign } = useAuth()
  const isMentor = person?.role === 'mentor'
  const isEditor = person?.role === 'editor'
  const [items, setItems] = useState<any>(null)
  const [prep, setPrep] = useState<any>(null)
  const [subProg, setSubProg] = useState<any>({}) // `${mentor_id}:${subtopic_id}` -> 4-step progress row
  const [trainers, setTrainers] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null)
  const [openPrep, setOpenPrep] = useState<any>(null)
  const [histTopic, setHistTopic] = useState<any>(null)
  const [mapped, setMapped] = useState<{ programs: string[]; subjects: string[] } | null>(null) // subjects/programs a trainer is mapped to
  async function load() {
    if (isMentor) {
      // mentors work their assigned prep topics (from Mentor Management), not content ownership
      let r = await supabase.from('mentor_prep').select('*, topic:topic_id(name, chapter:chapter_id(name, subject:subject_id(name, main_subject:main_subject_id(name))), subtopic(id, name, sequence))').eq('mentor_id', person.id).order('created_at', { ascending: false })
      // fallback: if embedding sub-topics isn't available, fetch without it so My Work still renders
      if (r.error && /subtopic/.test(r.error.message || '')) r = await supabase.from('mentor_prep').select('*, topic:topic_id(name, chapter:chapter_id(name, subject:subject_id(name, main_subject:main_subject_id(name))))').eq('mentor_id', person.id).order('created_at', { ascending: false })
      setPrep(r.error ? [] : (r.data || []))
      if (MOCK_MENTOR_SUBTOPIC) { const map: any = {}; mockListSubProg([person.id]).forEach((x: any) => { map[person.id + ':' + x.subtopic_id] = x }); setSubProg(map) }
      else { const sp = await supabase.from('mentor_subtopic_prep').select('subtopic_id, watched, notes_done, practice_done, presentation_done').eq('mentor_id', person.id); const map: any = {}; if (!sp.error) (sp.data || []).forEach((x: any) => { map[person.id + ':' + x.subtopic_id] = x }); setSubProg(map) }
      return
    }
    const all = await fetchAllItems()
    const ow = await selectAll('v_item_owner', 'content_item_id, level')
    const omap: any = {}; ow.forEach((o: any) => omap[o.content_item_id] = { level: o.level })
    const tr = await supabase.from('person').select('id, full_name, role, is_active')
    setTrainers((tr.data || []).filter((p: any) => p.role === 'trainer' && p.is_active))
    const inScope = await buildScope(person)
    setItems(all.filter(inScope).map((it: any) => ({ ...it, ownerLevel: omap[it.id]?.level })))
    // trainer profile: the programs / subjects this trainer is mapped to (owned via default_trainer_id + co-assigned v29)
    if (person?.role === 'trainer') {
      const [msAll, sjMine, co] = await Promise.all([
        supabase.from('main_subject').select('id, name, default_trainer_id'),
        supabase.from('subject').select('name, main_subject:main_subject_id(name)').eq('default_trainer_id', person.id),
        coAssignedPrograms(person.id),
      ])
      const progNames = new Set<string>()
      ;(msAll.data || []).forEach((m: any) => { if (m.default_trainer_id === person.id || co.has(m.id)) progNames.add(m.name) })
      const subjNames = (sjMine.data || []).map((s: any) => `${s.main_subject?.name ? s.main_subject.name + ' › ' : ''}${s.name}`)
      setMapped({ programs: [...progNames].sort(), subjects: [...new Set(subjNames)].sort() as string[] })
    } else setMapped(null)
  }
  useEffect(() => { if (person?.id && !isEditor) load() }, [person?.id])
  useAutoRefresh(() => { if (person?.id && !isEditor) load() })
  if (isEditor) return <EditorMyWork />
  if (isMentor) {
    if (!prep) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
    // one row per sub-topic of each assigned topic
    const prepRows = prep.filter((p: any) => p.topic).flatMap((p: any) => {
      const subs = [...(p.topic?.subtopic || [])].sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0))
      if (subs.length === 0) return [{ key: p.id, prep: p, subtopic: null, firstOfTopic: true, groupSize: 1 }]
      return subs.map((st: any, i: number) => ({ key: p.id + ':' + st.id, prep: p, subtopic: st, firstOfTopic: i === 0, groupSize: subs.length }))
    })
    const pcols = [
      { title: 'Sub-topic', render: (_: any, r: any) => <div>
        <div style={{ fontSize: 11, color: '#9aa1ad' }}>{[r.prep.topic?.chapter?.subject?.main_subject?.name, r.prep.topic?.chapter?.subject?.name, r.prep.topic?.chapter?.name, r.prep.topic?.name].filter(Boolean).join(' › ')}<ATooltip title="View full history / audit trail"><InfoCircleOutlined onClick={(e: any) => { e.stopPropagation(); setHistTopic({ id: r.prep.topic_id, name: r.prep.topic?.name }) }} style={{ marginLeft: 6, color: '#9aa1ad', cursor: 'pointer' }} /></ATooltip></div>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#161a22', marginTop: 2 }}>{r.subtopic?.name || <span style={{ color: '#9aa1ad', fontWeight: 400 }}>No sub-topics under this topic</span>}</div>
      </div> },
      { title: '4-step progress', width: 150, render: (_: any, r: any) => r.subtopic ? <SubtopicSteps mentorId={person.id} subtopicId={r.subtopic.id} prog={subProg[person.id + ':' + r.subtopic.id]} canEdit onSaved={(stid: string, next: any) => setSubProg((m: any) => ({ ...m, [person.id + ':' + stid]: { ...next } }))} /> : <span style={{ color: '#9aa1ad', fontSize: 12 }}>—</span> },
      { title: 'Status', width: 130, render: (_: any, r: any) => { if (!r.subtopic) return <span style={{ color: '#9aa1ad' }}>—</span>; const p = subProg[person.id + ':' + r.subtopic.id] || {}; const n = MENTOR_STEPS.filter(s => p[s.key]).length; return n === 4 ? <Tag color="green">Done</Tag> : n === 0 ? <Tag>Not started</Tag> : <Tag color="orange">In progress ({n}/4)</Tag> } },
      { title: '', width: 110, render: (_: any, r: any) => <Button size="small" onClick={() => setOpenPrep(r.prep)}>Open</Button> },
    ]
    return <div>
      <PageHead title="My Work" sub={`${prep.length} topic${prep.length === 1 ? '' : 's'} assigned for prep · tick the 4 steps per sub-topic`} />
      <Card><Table size="middle" rowKey="key" columns={pcols as any} dataSource={prepRows} pagination={{ pageSize: 20 }} locale={{ emptyText: <Empty description="Nothing assigned to you yet" /> }} /></Card>
      {openPrep && <MentorPrepDrawer row={openPrep} canEdit onClose={() => setOpenPrep(null)} onSaved={load} />}
      {histTopic && <TopicHistory topicId={histTopic.id} topicName={histTopic.name} onClose={() => setHistTopic(null)} />}
    </div>
  }
  if (!items) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  const byStage: any = {}; items.forEach((it: any) => { const s = it.stageName === 'Done' ? 'Published' : it.stageName; byStage[s] = (byStage[s] || 0) + 1 })
  const cols = [
    { title: 'Sub-topic', render: (_: any, r: any) => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 11, color: '#9aa1ad' }}>{r.subject} › {r.chapter} › {r.topic}</div></div> },
    { title: 'Via', width: 90, dataIndex: 'ownerLevel', render: (v: string) => v ? <Tag>{v}</Tag> : '—' },
    { title: 'Current stage', width: 200, render: (_: any, r: any) => <StageBadge name={r.stageName === 'Done' ? 'Published' : r.stageName} seq={r.stageSeq} /> },
    { title: 'Completion', width: 180, render: (_: any, r: any) => <Progress percent={r.completion} size="small" strokeColor={PRIMARY} /> },
  ]
  return <div>
    <PageHead title="My Work" sub={`${items.length} sub-topic${items.length === 1 ? '' : 's'} assigned to you · click one to update its stage`} />
    {mapped && (mapped.programs.length > 0 || mapped.subjects.length > 0) && <Card size="small" title="You are mapped to" style={{ marginBottom: 14 }}>
      {mapped.programs.length > 0 && <div style={{ marginBottom: mapped.subjects.length ? 8 : 0 }}><span style={{ fontSize: 12, color: '#69707d', marginRight: 8 }}>Programs</span>{mapped.programs.map((p) => <Tag key={p} color="blue" style={{ marginBottom: 4 }}>{p}</Tag>)}</div>}
      {mapped.subjects.length > 0 && <div><span style={{ fontSize: 12, color: '#69707d', marginRight: 8 }}>Subjects</span>{mapped.subjects.map((s) => <Tag key={s} color="geekblue" style={{ marginBottom: 4 }}>{s}</Tag>)}</div>}
    </Card>}
    {items.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>{Object.entries(byStage).map(([s, n]: any) => <Tag key={s} color="blue" style={{ padding: '2px 10px' }}>{s}: {n}</Tag>)}</div>}
    <Card><Table size="middle" columns={cols as any} dataSource={items.map((r: any) => ({ ...r, key: r.id }))} pagination={{ pageSize: 15 }}
      onRow={(r: any) => ({ onClick: () => setEditing(r), style: { cursor: 'pointer' } })}
      locale={{ emptyText: <Empty description="Nothing assigned to you yet" /> }} /></Card>
    {editing && <StageEditor item={editing} canAssign={canAssign} trainers={trainers} onClose={() => setEditing(null)} onSaved={load} />}
  </div>
}

/* ===================== app ===================== */
function Protected({ children }: { children: any }) {
  const { session, loading } = useAuth()
  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>
  if (!session) return <Navigate to="/login" replace />
  return children
}
export default function App() {
  return (
    <ConfigProvider theme={{
      token: {
        colorPrimary: PRIMARY,
        colorBgLayout: '#f5f6f8',
        colorBgContainer: '#ffffff',
        colorBorder: '#e8eaee',
        colorBorderSecondary: '#eef0f3',
        colorText: '#161a22',
        colorTextSecondary: '#69707d',
        colorTextTertiary: '#9aa1ad',
        borderRadius: 10,
        borderRadiusLG: 16,
        fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize: 14,
        controlHeight: 36,
      },
      components: {
        Layout: { siderBg: '#12141d', headerBg: '#ffffff', bodyBg: '#f5f6f8', headerHeight: 60, headerPadding: '0 20px' },
        Menu: { darkItemBg: 'transparent', darkSubMenuItemBg: 'transparent', darkItemColor: '#c9ccd6', darkItemHoverBg: 'rgba(255,255,255,.06)', darkItemSelectedBg: hexA(PRIMARY, 0.18), darkItemSelectedColor: '#ffffff', itemBorderRadius: 9, itemMarginInline: 8 },
        Card: { borderRadiusLG: 16, headerFontSize: 14, paddingLG: 18 },
        Table: { headerBg: '#ffffff', headerColor: '#9aa1ad', headerSplitColor: 'transparent', borderColor: '#eef0f3', rowHoverBg: '#f7f8fa', cellPaddingBlock: 12, cellPaddingInline: 14, fontSize: 13 },
        Segmented: { itemSelectedBg: PRIMARY, itemSelectedColor: '#ffffff', trackBg: '#f5f6f8' },
      },
    }}>
      <AntApp>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<Protected><Shell><WorkDashboard /></Shell></Protected>} />
              <Route path="/" element={<Protected><Shell><CommandCenter /></Shell></Protected>} />
              <Route path="/studio" element={<Protected><Shell><StudioBoard /></Shell></Protected>} />
              <Route path="/myday" element={<Protected><Shell><MyDay /></Shell></Protected>} />
              <Route path="/mywork" element={<Protected><Shell><MyWork /></Shell></Protected>} />
              <Route path="/content" element={<Protected><Shell><ContentExplorer /></Shell></Protected>} />
              <Route path="/assignments" element={<Protected><Shell><Assignments /></Shell></Protected>} />
              <Route path="/editing" element={<Protected><Shell><EditingQueue /></Shell></Protected>} />
              <Route path="/goals" element={<Protected><Shell><WeeklyGoals /></Shell></Protected>} />
              <Route path="/mentor" element={<Protected><Shell><MentorGeneration /></Shell></Protected>} />
              <Route path="/reviews" element={<Protected><Shell><Reviews /></Shell></Protected>} />
              <Route path="/sla" element={<Protected><Shell><SLADelays /></Shell></Protected>} />
              <Route path="/people" element={<Protected><Shell><People /></Shell></Protected>} />
              <Route path="/assets" element={<Protected><Shell><AssetManager /></Shell></Protected>} />
              <Route path="/manage" element={<Protected><Shell><Manage /></Shell></Protected>} />
              <Route path="/management" element={<Protected><Shell><Management /></Shell></Protected>} />
              <Route path="/teams" element={<Protected><Shell><TeamsPerformance /></Shell></Protected>} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  )
}
