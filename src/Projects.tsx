// ============================================================================
// Projects — a SELF-CONTAINED feature (does not touch any existing code/data).
// Organisations → Projects, each with: Candidates, Attendance, Syllabus,
// Topic-wise Ratings, Deployment pipeline, and a Dashboard.
// Persistence is browser-local (localStorage) so nothing here depends on, or
// affects, the live Supabase data. Can be moved to Supabase later if shared
// multi-user data is needed.
// ============================================================================
import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Card, Tabs, Table, Tag, Button, Input, Modal, Form, Select, DatePicker, Empty,
  Segmented, Popconfirm, Statistic, Row, Col, Progress, Upload, App as AntApp, Tooltip, Switch,
} from 'antd'
import {
  AppstoreOutlined, PlusOutlined, TeamOutlined, CalendarOutlined, ReadOutlined, StarOutlined,
  RocketOutlined, DashboardOutlined, DeleteOutlined, EditOutlined, UploadOutlined, BankOutlined, ArrowLeftOutlined, DownloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

// ---------- store (localStorage) ----------
const LS_KEY = 'trackademy_projects_v1'
type DB = { orgs: any[]; projects: any[]; candidates: any[]; attendance: any[]; syllabus: any[]; ratings: any[]; deployments: any[]; progress: any[]; etiquette: any[] }
const emptyDB: DB = { orgs: [], projects: [], candidates: [], attendance: [], syllabus: [], ratings: [], deployments: [], progress: [], etiquette: [] }
// candidate-updatable activities (per syllabus topic) + daily etiquette self-checks
const ACTIVITIES = ['Videos', 'Presentation', 'Assignment', 'Assessment', 'Mock Test']
const ACT_STATUS = ['Not started', 'In progress', 'Completed']
const ACT_COLOR: Record<string, string> = { 'Not started': 'default', 'In progress': 'gold', 'Completed': 'green' }
const ETIQUETTE = ['Punctuality', 'Discipline', 'Dedication', 'Executive attire']
function loadDB(): DB { try { const r = localStorage.getItem(LS_KEY); return r ? { ...emptyDB, ...JSON.parse(r) } : emptyDB } catch { return emptyDB } }
function saveDB(db: DB) { try { localStorage.setItem(LS_KEY, JSON.stringify(db)) } catch { /* ignore */ } }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

// ---------- deployment statuses ----------
const DEP_STATUSES = ['Profiles shared', 'Interview in Progress', 'Waiting for results', 'Shortlisted', 'Not Shortlisted', 'Rejected', 'Deployed']
const DEP_COLOR: Record<string, string> = {
  'Profiles shared': 'blue', 'Interview in Progress': 'gold', 'Waiting for results': 'orange',
  'Shortlisted': 'green', 'Not Shortlisted': 'volcano', 'Rejected': 'red', 'Deployed': 'purple',
}
const ATT_OPTS = ['Present', 'Absent', 'Late', 'Leave']
const ATT_COLOR: Record<string, string> = { Present: 'green', Absent: 'red', Late: 'gold', Leave: 'default' }
const PRIMARY = '#ff6a00'

const slCol = { title: 'Sl No', width: 64, render: (_: any, __: any, i: number) => <span style={{ color: '#9aa1ad' }}>{i + 1}</span> }

// a candidate who has been Deployed loses their self-service access
const isDeployed = (db: DB, candidateId: string) => db.deployments.some((d) => d.candidateId === candidateId && d.status === 'Deployed')

export default function Projects() {
  const [db, setDb] = useState<DB>(loadDB)
  const mutate = (producer: (d: DB) => void) => setDb((prev) => { const next: DB = JSON.parse(JSON.stringify(prev)); producer(next); saveDB(next); return next })
  const [sel, setSel] = useState<string | null>(null)
  const project = db.projects.find((p) => p.id === sel)
  if (project) return <ProjectWorkspace db={db} mutate={mutate} project={project} onBack={() => setSel(null)} org={db.orgs.find((o) => o.id === project.orgId)} />
  return <OrgHome db={db} mutate={mutate} onOpen={setSel} />
}

// Standalone candidate portal — its OWN login, rendered on a separate public route (/student),
// outside the staff-authenticated app. (Browser-local for now; becomes cross-device with Supabase.)
export function CandidateApp() {
  const [db, setDb] = useState<DB>(loadDB)
  const mutate = (producer: (d: DB) => void) => setDb((prev) => { const next: DB = JSON.parse(JSON.stringify(prev)); producer(next); saveDB(next); return next })
  const [candId, setCandId] = useState<string | null>(null)
  const candidate = db.candidates.find((c) => c.id === candId)
  const inner = (!candidate || isDeployed(db, candidate.id))
    ? <CandidateLogin db={db} onLogin={setCandId} onBack={null} />
    : <CandidatePortal db={db} mutate={mutate} candidate={candidate} onLogout={() => setCandId(null)} />
  return <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#eef2fb 0%, #f6f8fc 260px, #f6f8fc 100%)' }}>
    <div style={{ background: '#12141d', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: PRIMARY, display: 'grid', placeItems: 'center', fontWeight: 800 }}>Q</div>
      <div style={{ fontWeight: 700 }}>Trackademy — Candidate</div>
    </div>
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>{inner}</div>
  </div>
}

// ============================================================================
// Organisations + Projects landing
// ============================================================================
function OrgHome({ db, mutate, onOpen }: any) {
  const { message: msg } = AntApp.useApp()
  const [orgModal, setOrgModal] = useState(false)
  const [projModal, setProjModal] = useState<any>(null) // { orgId }
  const [of] = Form.useForm(); const [pf] = Form.useForm()
  const addOrg = (v: any) => { mutate((d: DB) => { d.orgs.push({ id: uid(), name: v.name.trim(), createdAt: dayjs().toISOString() }) }); setOrgModal(false); of.resetFields(); msg.success('Organisation added') }
  const addProject = (v: any) => { mutate((d: DB) => { d.projects.push({ id: uid(), orgId: projModal.orgId, name: v.name.trim(), desc: v.desc || '', createdAt: dayjs().toISOString() }) }); setProjModal(null); pf.resetFields(); msg.success('Project created') }
  const delOrg = (id: string) => mutate((d: DB) => { d.orgs = d.orgs.filter((o) => o.id !== id); d.projects = d.projects.filter((p) => p.orgId !== id) })
  const delProj = (id: string) => mutate((d: DB) => { d.projects = d.projects.filter((p) => p.id !== id) })
  const projCount = (orgId: string) => db.projects.filter((p: any) => p.orgId === orgId).length
  const candCount = (projId: string) => db.candidates.filter((c: any) => c.projectId === projId).length
  return <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}><AppstoreOutlined style={{ color: PRIMARY, marginRight: 8 }} />Projects</div>
        <div style={{ fontSize: 13, color: '#9aa1ad' }}>Organisations and their projects — candidates, attendance, ratings & deployment.</div>
      </div>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setOrgModal(true)}>Add organisation</Button>
    </div>

    {db.orgs.length === 0 ? <Card><Empty description="No organisations yet — add one to get started." /></Card>
      : db.orgs.map((o: any) => (
        <Card key={o.id} style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}
          title={<span><BankOutlined style={{ color: PRIMARY, marginRight: 8 }} /><b>{o.name}</b> <Tag style={{ marginLeft: 8 }}>{projCount(o.id)} project{projCount(o.id) === 1 ? '' : 's'}</Tag></span>}
          extra={<span style={{ display: 'inline-flex', gap: 8 }}>
            <Button size="small" icon={<PlusOutlined />} onClick={() => setProjModal({ orgId: o.id })}>Add project</Button>
            <Popconfirm title="Delete this organisation and its projects?" okButtonProps={{ danger: true }} onConfirm={() => delOrg(o.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
          </span>}>
          {projCount(o.id) === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No projects yet" />
            : <Row gutter={[12, 12]}>
              {db.projects.filter((p: any) => p.orgId === o.id).map((p: any) => (
                <Col xs={24} sm={12} lg={8} key={p.id}>
                  <Card hoverable size="small" styles={{ body: { padding: 14 } }} onClick={() => onOpen(p.id)}
                    style={{ border: '1px solid #eef0f3', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                        {p.desc && <div style={{ fontSize: 12, color: '#9aa1ad', marginTop: 2 }}>{p.desc}</div>}
                        <div style={{ fontSize: 12, color: '#69707d', marginTop: 8 }}><TeamOutlined /> {candCount(p.id)} candidate{candCount(p.id) === 1 ? '' : 's'}</div>
                      </div>
                      <Popconfirm title="Delete project?" okButtonProps={{ danger: true }} onConfirm={() => delProj(p.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} /></Popconfirm>
                    </div>
                    <Button type="link" size="small" style={{ paddingLeft: 0, marginTop: 6 }}>Open workspace →</Button>
                  </Card>
                </Col>
              ))}
            </Row>}
        </Card>
      ))}

    <Modal open={orgModal} title="Add organisation" onCancel={() => setOrgModal(false)} onOk={() => of.submit()} okText="Add">
      <Form form={of} layout="vertical" onFinish={addOrg} style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Organisation name" rules={[{ required: true, message: 'Enter a name' }]}><Input placeholder="e.g. QSpiders Hyderabad" /></Form.Item>
      </Form>
    </Modal>
    <Modal open={!!projModal} title="Create project" onCancel={() => setProjModal(null)} onOk={() => pf.submit()} okText="Create">
      <Form form={pf} layout="vertical" onFinish={addProject} style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Project name" rules={[{ required: true, message: 'Enter a name' }]}><Input placeholder="e.g. Java Full Stack — Batch Oct '26" /></Form.Item>
        <Form.Item name="desc" label="Description (optional)"><Input.TextArea rows={2} placeholder="Short description" /></Form.Item>
      </Form>
    </Modal>
  </div>
}

// ============================================================================
// Project workspace — tabs
// ============================================================================
function ProjectWorkspace({ db, mutate, project, org, onBack }: any) {
  const pid = project.id
  const candidates = db.candidates.filter((c: any) => c.projectId === pid)
  const syllabus = db.syllabus.filter((s: any) => s.projectId === pid)
  const ratings = db.ratings.filter((r: any) => r.projectId === pid)
  const attendance = db.attendance.filter((a: any) => a.projectId === pid)
  const deployments = db.deployments.filter((d: any) => d.projectId === pid)
  const progress = db.progress.filter((p: any) => p.projectId === pid)
  const etiquette = db.etiquette.filter((e: any) => e.projectId === pid)
  const ctx = { db, mutate, pid, candidates, syllabus, ratings, attendance, deployments, progress, etiquette }
  return <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      <Button icon={<ArrowLeftOutlined />} onClick={onBack}>All projects</Button>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{project.name}</div>
        <div style={{ fontSize: 12, color: '#9aa1ad' }}>{org?.name || 'Organisation'}{project.desc ? ` · ${project.desc}` : ''}</div>
      </div>
    </div>
    <Tabs defaultActiveKey="dash" items={[
      { key: 'dash', label: <span><DashboardOutlined /> Dashboard</span>, children: <ProjectDashboard {...ctx} /> },
      { key: 'cand', label: <span><TeamOutlined /> Candidates</span>, children: <CandidatesTab {...ctx} /> },
      { key: 'att', label: <span><CalendarOutlined /> Attendance</span>, children: <AttendanceTab {...ctx} /> },
      { key: 'syl', label: <span><ReadOutlined /> Syllabus</span>, children: <SyllabusTab {...ctx} /> },
      { key: 'rate', label: <span><StarOutlined /> Ratings</span>, children: <RatingsTab {...ctx} /> },
      { key: 'prog', label: <span><ReadOutlined /> Candidate progress</span>, children: <ProgressTab {...ctx} /> },
      { key: 'dep', label: <span><RocketOutlined /> Deployment</span>, children: <DeploymentTab {...ctx} /> },
    ]} />
  </div>
}

// ---------- shared helpers ----------
const batchesOf = (candidates: any[]) => [...new Set(candidates.map((c) => c.batch).filter(Boolean))].sort()
const candName = (candidates: any[], id: string) => candidates.find((c) => c.id === id)?.name || '—'
function Stat({ label, value, color, suffix }: any) {
  return <Card size="small" styles={{ body: { padding: '12px 16px' } }}><Statistic title={<span style={{ fontSize: 12 }}>{label}</span>} value={value} suffix={suffix} valueStyle={{ color: color || '#161a22', fontWeight: 800, fontSize: 22 }} /></Card>
}

// ============================================================================
// Candidates
// ============================================================================
function CandidatesTab({ mutate, pid, candidates }: any) {
  const { message: msg } = AntApp.useApp()
  const [modal, setModal] = useState<any>(null) // null | {} (new) | candidate (edit)
  const [f] = Form.useForm()
  const [q, setQ] = useState(''); const [bf, setBf] = useState<string | null>(null)
  const open = (c?: any) => { setModal(c || {}); setTimeout(() => f.setFieldsValue(c || { batch: '' }), 0) }
  const submit = (v: any) => {
    if (modal?.id) mutate((d: DB) => { const c = d.candidates.find((x) => x.id === modal.id); if (c) Object.assign(c, v) })
    else mutate((d: DB) => { d.candidates.push({ id: uid(), projectId: pid, ...v }) })
    setModal(null); f.resetFields(); msg.success('Saved')
  }
  const del = (id: string) => mutate((d: DB) => { d.candidates = d.candidates.filter((c) => c.id !== id); d.attendance = d.attendance.filter((a) => a.candidateId !== id); d.ratings = d.ratings.filter((r) => r.candidateId !== id); d.deployments = d.deployments.filter((x) => x.candidateId !== id) })
  const ql = q.trim().toLowerCase()
  const shown = candidates.filter((c: any) => (!ql || [c.name, c.email, c.contact].some((x: any) => String(x || '').toLowerCase().includes(ql))) && (!bf || c.batch === bf))
  const cols = [
    slCol,
    { title: 'Name', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Email', dataIndex: 'email', render: (v: string) => v || <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Contact', dataIndex: 'contact', width: 150, render: (v: string) => v || <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Batch', dataIndex: 'batch', width: 140, render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: '', width: 90, render: (_: any, c: any) => <span style={{ display: 'inline-flex', gap: 4 }}><Button size="small" type="text" icon={<EditOutlined />} onClick={() => open(c)} /><Popconfirm title="Delete candidate?" okButtonProps={{ danger: true }} onConfirm={() => del(c.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm></span> },
  ]
  return <Card styles={{ body: { padding: 16 } }}>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
      <Input allowClear placeholder="Search name / email / contact…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
      <Select allowClear placeholder="Batch" value={bf} onChange={(v) => setBf(v ?? null)} style={{ minWidth: 160 }} options={batchesOf(candidates).map((b: string) => ({ value: b, label: b }))} />
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <BulkCandidateUpload mutate={mutate} pid={pid} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>Add candidate</Button>
      </div>
    </div>
    <Table size="small" rowKey="id" columns={cols as any} dataSource={shown} pagination={{ pageSize: 15 }} locale={{ emptyText: <Empty description="No candidates yet" /> }} />
    <Modal open={!!modal} title={modal?.id ? 'Edit candidate' : 'Add candidate'} onCancel={() => setModal(null)} onOk={() => f.submit()} okText="Save">
      <Form form={f} layout="vertical" onFinish={submit} style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Enter a name' }]}><Input placeholder="Candidate name" /></Form.Item>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="email" label="Email ID" rules={[{ type: 'email', message: 'Invalid email' }]}><Input placeholder="name@example.com" /></Form.Item></Col>
          <Col span={12}><Form.Item name="contact" label="Contact number"><Input placeholder="Phone" /></Form.Item></Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="batch" label="Batch"><Input placeholder="e.g. Oct-26 A" /></Form.Item></Col>
          <Col span={12}><Form.Item name="pin" label="Login PIN (optional)" tooltip="Candidate enters email + this PIN to log in. Leave blank for email-only."><Input placeholder="e.g. 1234" /></Form.Item></Col>
        </Row>
      </Form>
    </Modal>
  </Card>
}

function BulkCandidateUpload({ mutate, pid }: any) {
  const { message: msg } = AntApp.useApp()
  const onFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' })
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        const add = rows.map((r) => ({ id: uid(), projectId: pid, name: String(r.Name || r.name || '').trim(), email: String(r.Email || r.email || r['Email ID'] || '').trim(), contact: String(r.Contact || r.contact || r['Contact number'] || r.Phone || '').trim(), batch: String(r.Batch || r.batch || '').trim() })).filter((r) => r.name)
        if (!add.length) { msg.warning('No rows with a Name column found.'); return }
        mutate((d: DB) => { d.candidates.push(...add) }); msg.success(`${add.length} candidate(s) imported`)
      } catch { msg.error('Could not read the file. Use columns: Name, Email, Contact, Batch.') }
    }
    reader.readAsBinaryString(file)
    return false
  }
  return <Upload accept=".xlsx,.xls,.csv" showUploadList={false} beforeUpload={onFile as any}><Button icon={<UploadOutlined />}>Import Excel</Button></Upload>
}

// ============================================================================
// Attendance
// ============================================================================
function AttendanceTab({ mutate, pid, candidates, attendance }: any) {
  const { message: msg } = AntApp.useApp()
  const [date, setDate] = useState<any>(dayjs())
  const [bf, setBf] = useState<string | null>(null)
  const dstr = date.format('YYYY-MM-DD')
  const statusOf = (cid: string) => attendance.find((a: any) => a.candidateId === cid && a.date === dstr)?.status
  const setStatus = (cid: string, status: string) => mutate((d: DB) => {
    const rec = d.attendance.find((a) => a.projectId === pid && a.candidateId === cid && a.date === dstr)
    if (rec) rec.status = status; else d.attendance.push({ id: uid(), projectId: pid, candidateId: cid, date: dstr, status })
  })
  const markAll = (status: string) => { mutate((d: DB) => { shown.forEach((c: any) => { const rec = d.attendance.find((a) => a.projectId === pid && a.candidateId === c.id && a.date === dstr); if (rec) rec.status = status; else d.attendance.push({ id: uid(), projectId: pid, candidateId: c.id, date: dstr, status }) }) }); msg.success(`All marked ${status}`) }
  const pct = (cid: string) => { const recs = attendance.filter((a: any) => a.candidateId === cid); if (!recs.length) return null; return Math.round(100 * recs.filter((r: any) => r.status === 'Present' || r.status === 'Late').length / recs.length) }
  const shown = candidates.filter((c: any) => !bf || c.batch === bf)
  const cols = [
    slCol,
    { title: 'Candidate', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Batch', dataIndex: 'batch', width: 130, render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: `Status · ${date.format('DD MMM YYYY')}`, width: 320, render: (_: any, c: any) => <Segmented size="small" value={statusOf(c.id) || ''} onChange={(v) => setStatus(c.id, v as string)} options={ATT_OPTS.map((o) => ({ value: o, label: o }))} /> },
    { title: 'Overall %', width: 130, render: (_: any, c: any) => { const p = pct(c.id); return p == null ? <span style={{ color: '#9aa1ad' }}>—</span> : <Progress percent={p} size="small" strokeColor={p >= 75 ? '#16a34a' : p >= 50 ? '#d97706' : '#dc2626'} /> } },
  ]
  return <Card styles={{ body: { padding: 16 } }}>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
      <DatePicker value={date} onChange={(v) => setDate(v || dayjs())} allowClear={false} disabledDate={(d) => d && d.isAfter(dayjs(), 'day')} />
      <Select allowClear placeholder="Batch" value={bf} onChange={(v) => setBf(v ?? null)} style={{ minWidth: 150 }} options={batchesOf(candidates).map((b: string) => ({ value: b, label: b }))} />
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <Button size="small" onClick={() => markAll('Present')}>Mark all Present</Button>
        <Button size="small" onClick={() => markAll('Absent')}>Mark all Absent</Button>
      </div>
    </div>
    <Table size="small" rowKey="id" columns={cols as any} dataSource={shown} pagination={{ pageSize: 20 }} locale={{ emptyText: <Empty description="Add candidates first" /> }} />
  </Card>
}

// ============================================================================
// Syllabus (topics per subject) — manual add + Excel upload
// ============================================================================
function SyllabusTab({ mutate, pid, syllabus }: any) {
  const { message: msg } = AntApp.useApp()
  const [f] = Form.useForm()
  const add = (v: any) => { mutate((d: DB) => { d.syllabus.push({ id: uid(), projectId: pid, subject: (v.subject || '').trim() || 'General', chapter: (v.chapter || '').trim() || '—', topic: v.topic.trim() }) }); f.resetFields(); msg.success('Topic added') }
  const del = (id: string) => mutate((d: DB) => { d.syllabus = d.syllabus.filter((s) => s.id !== id); d.ratings = d.ratings.filter((r) => r.topicId !== id); d.progress = d.progress.filter((p) => p.topicId !== id) })
  const onFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' })
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        const add = rows.map((r) => ({ id: uid(), projectId: pid, subject: String(r.Subject || r.subject || 'General').trim(), chapter: String(r.Chapter || r.chapter || '—').trim() || '—', topic: String(r.Topic || r.topic || '').trim() })).filter((r) => r.topic)
        if (!add.length) { msg.warning('No Topic column found. Use columns: Subject, Chapter, Topic.'); return }
        mutate((d: DB) => { d.syllabus.push(...add) }); msg.success(`${add.length} topic(s) uploaded`)
      } catch { msg.error('Could not read the file. Use columns: Subject, Chapter, Topic.') }
    }
    reader.readAsBinaryString(file); return false
  }
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { Subject: 'Core Java', Chapter: 'Collections Framework', Topic: 'List & Set' },
      { Subject: 'Core Java', Chapter: 'Collections Framework', Topic: 'Map' },
      { Subject: 'Core Java', Chapter: 'Exception Handling', Topic: 'Try / Catch' },
      { Subject: 'Advance Java', Chapter: 'Spring Boot', Topic: 'REST Controllers' },
    ])
    ws['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 30 }]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Syllabus')
    XLSX.writeFile(wb, 'syllabus-template.xlsx')
  }
  // one entry per uploaded SUBJECT (topics are hidden) with an option to download that subject's Excel
  const subjects = [...new Set(syllabus.map((s: any) => s.subject))].sort() as string[]
  const rowsOfSubject = (subj: string) => syllabus.filter((s: any) => s.subject === subj)
  const downloadSubject = (subj: string) => {
    const ws = XLSX.utils.json_to_sheet(rowsOfSubject(subj).map((s: any) => ({ Subject: s.subject, Chapter: s.chapter === '—' ? '' : s.chapter, Topic: s.topic })))
    ws['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 30 }]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Syllabus')
    XLSX.writeFile(wb, `syllabus-${subj.replace(/[^a-z0-9]+/gi, '-')}.xlsx`)
  }
  const delSubject = (subj: string) => mutate((d: DB) => { const ids = new Set(d.syllabus.filter((s) => s.projectId === pid && s.subject === subj).map((s) => s.id)); d.syllabus = d.syllabus.filter((s) => !ids.has(s.id)); d.ratings = d.ratings.filter((r) => !ids.has(r.topicId)); d.progress = d.progress.filter((p) => !ids.has(p.topicId)) })
  return <Card styles={{ body: { padding: 16 } }}>
    <div style={{ background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 10, padding: 12, marginBottom: 16 }}>
      <Form form={f} layout="inline" onFinish={add} style={{ rowGap: 8 }}>
        <Form.Item name="subject"><Input placeholder="Subject (e.g. Core Java)" style={{ width: 180 }} /></Form.Item>
        <Form.Item name="chapter"><Input placeholder="Chapter (e.g. Collections)" style={{ width: 180 }} /></Form.Item>
        <Form.Item name="topic" rules={[{ required: true, message: 'Enter a topic' }]}><Input placeholder="Topic (e.g. List & Set)" style={{ width: 200 }} /></Form.Item>
        <Form.Item><Button type="primary" icon={<PlusOutlined />} htmlType="submit">Add topic</Button></Form.Item>
        <Form.Item><Upload accept=".xlsx,.xls,.csv" showUploadList={false} beforeUpload={onFile as any}><Button icon={<UploadOutlined />}>Upload syllabus (Excel)</Button></Upload></Form.Item>
        <Form.Item><Button icon={<DownloadOutlined />} onClick={downloadTemplate}>Download template</Button></Form.Item>
      </Form>
      <div style={{ fontSize: 11, color: '#9aa1ad', marginTop: 8 }}>Template has three columns — <b>Subject</b>, <b>Chapter</b>, <b>Topic</b>. Fill it, then upload it back in the same format.</div>
    </div>
    {subjects.length === 0 ? <Empty description="No syllabus yet — upload an Excel with Subject, Chapter, Topic columns." />
      : <Row gutter={[12, 12]}>
        {subjects.map((subj) => (
          <Col xs={24} sm={12} lg={8} key={subj}>
            <Card size="small" styles={{ body: { padding: 14 } }} style={{ border: '1px solid #eef0f3', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}><ReadOutlined style={{ color: PRIMARY, marginRight: 6 }} />{subj}</div>
                  <div style={{ fontSize: 12, color: '#9aa1ad', marginTop: 2 }}>{rowsOfSubject(subj).length} topic{rowsOfSubject(subj).length === 1 ? '' : 's'}</div>
                </div>
                <Popconfirm title={`Remove “${subj}” syllabus?`} okButtonProps={{ danger: true }} onConfirm={() => delSubject(subj)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
              </div>
              <Button size="small" icon={<DownloadOutlined />} style={{ marginTop: 10 }} onClick={() => downloadSubject(subj)}>Download Excel</Button>
            </Card>
          </Col>
        ))}
      </Row>}
  </Card>
}

// ============================================================================
// Ratings — trainer rates each candidate topic-wise
// ============================================================================
function RatingsTab({ mutate, pid, candidates, syllabus, ratings }: any) {
  const { message: msg } = AntApp.useApp()
  const [cid, setCid] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, { score?: number; remark?: string }>>({})
  const candRatings = (candidateId: string) => ratings.filter((r: any) => r.candidateId === candidateId)
  const existing = (candidateId: string, topicId: string) => candRatings(candidateId).find((r: any) => r.topicId === topicId)
  const setScore = (topicId: string, score: number) => setDraft((d) => ({ ...d, [topicId]: { ...d[topicId], score } }))
  const setRemark = (topicId: string, remark: string) => setDraft((d) => ({ ...d, [topicId]: { ...d[topicId], remark } }))
  const save = () => {
    if (!cid) return
    const entries = Object.entries(draft).filter(([, v]) => v.score != null)
    if (!entries.length) { msg.warning('Set at least one score.'); return }
    mutate((d: DB) => {
      entries.forEach(([topicId, v]) => {
        const rec = d.ratings.find((r) => r.projectId === pid && r.candidateId === cid && r.topicId === topicId)
        if (rec) { rec.score = v.score; rec.remark = v.remark ?? rec.remark; rec.date = dayjs().format('YYYY-MM-DD') }
        else d.ratings.push({ id: uid(), projectId: pid, candidateId: cid, topicId, score: v.score, remark: v.remark || '', date: dayjs().format('YYYY-MM-DD') })
      })
    })
    setDraft({}); msg.success('Ratings saved')
  }
  const avgOf = (candidateId: string) => { const rs = candRatings(candidateId).filter((r: any) => r.score != null); return rs.length ? rs.reduce((a: number, b: any) => a + Number(b.score), 0) / rs.length : null }
  const summaryCols = [
    slCol,
    { title: 'Candidate', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Batch', dataIndex: 'batch', width: 120, render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Topics rated', width: 120, render: (_: any, c: any) => <span>{candRatings(c.id).length} / {syllabus.length}</span> },
    { title: 'Average', width: 120, render: (_: any, c: any) => { const a = avgOf(c.id); return a == null ? <span style={{ color: '#9aa1ad' }}>—</span> : <Tag color={a >= 4 ? 'green' : a >= 3 ? 'orange' : 'red'}>{a.toFixed(2)} / 5</Tag> } },
    { title: '', width: 90, render: (_: any, c: any) => <Button size="small" onClick={() => { setCid(c.id); setDraft({}) }}>Rate</Button> },
  ]
  return <Row gutter={16}>
    <Col xs={24} lg={13}>
      <Card size="small" title="Candidates — ratings summary" styles={{ body: { padding: 12 } }}>
        <Table size="small" rowKey="id" columns={summaryCols as any} dataSource={candidates} pagination={{ pageSize: 12 }} locale={{ emptyText: <Empty description="Add candidates first" /> }} />
      </Card>
    </Col>
    <Col xs={24} lg={11}>
      <Card size="small" styles={{ body: { padding: 12 } }}
        title={<span>Rate topic-wise{cid ? <> — <b>{candName(candidates, cid)}</b></> : ''}</span>}
        extra={<Select placeholder="Pick candidate" value={cid} onChange={(v) => { setCid(v); setDraft({}) }} style={{ minWidth: 180 }} options={candidates.map((c: any) => ({ value: c.id, label: c.name }))} />}>
        {!cid ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pick a candidate to rate" />
          : syllabus.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Add syllabus topics first" />
            : <div style={{ maxHeight: 460, overflowY: 'auto' }}>
              {syllabus.map((s: any) => {
                const ex = existing(cid, s.id); const cur = draft[s.id]?.score ?? ex?.score ?? 0
                return <div key={s.id} style={{ borderBottom: '1px solid #f0f0f0', padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13 }}><span style={{ color: '#9aa1ad', fontSize: 11 }}>{s.subject}{s.chapter && s.chapter !== '—' ? ` › ${s.chapter}` : ''} · </span>{s.topic}</span>
                    <Select size="small" value={cur} onChange={(v) => setScore(s.id, v)} style={{ width: 90 }}
                      options={[0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => ({ value: n, label: n === 0 ? '—' : `${n}` }))} />
                  </div>
                  <Input size="small" placeholder="Remark (optional)" defaultValue={ex?.remark} onChange={(e) => setRemark(s.id, e.target.value)} style={{ marginTop: 6 }} />
                </div>
              })}
              <Button type="primary" block style={{ marginTop: 12 }} onClick={save}>Save ratings</Button>
            </div>}
      </Card>
    </Col>
  </Row>
}

// ============================================================================
// Deployment — pipeline + dashboard
// ============================================================================
function DeploymentTab({ mutate, pid, candidates, deployments }: any) {
  const { message: msg } = AntApp.useApp()
  const [modal, setModal] = useState<any>(null)
  const [f] = Form.useForm()
  const [sf, setSf] = useState<string | null>(null)
  const open = (rec?: any) => { setModal(rec || {}); setTimeout(() => f.setFieldsValue(rec ? { ...rec, date: rec.date ? dayjs(rec.date) : dayjs() } : { status: 'Profiles shared', date: dayjs() }), 0) }
  const submit = (v: any) => {
    const payload = { candidateId: v.candidateId, company: v.company || '', status: v.status, remark: v.remark || '', date: (v.date || dayjs()).format('YYYY-MM-DD') }
    if (modal?.id) mutate((d: DB) => { const r = d.deployments.find((x) => x.id === modal.id); if (r) Object.assign(r, payload) })
    else mutate((d: DB) => { d.deployments.push({ id: uid(), projectId: pid, ...payload }) })
    setModal(null); f.resetFields(); msg.success('Saved')
  }
  const del = (id: string) => mutate((d: DB) => { d.deployments = d.deployments.filter((x) => x.id !== id) })
  const shown = deployments.filter((d: any) => !sf || d.status === sf)
  const byStatus = (s: string) => deployments.filter((d: any) => d.status === s).length
  const cols = [
    slCol,
    { title: 'Date', dataIndex: 'date', width: 120, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Candidate', dataIndex: 'candidateId', render: (v: string) => <b>{candName(candidates, v)}</b> },
    { title: 'Batch', width: 120, render: (_: any, r: any) => { const b = candidates.find((c: any) => c.id === r.candidateId)?.batch; return b ? <Tag color="geekblue">{b}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> } },
    { title: 'Company / Client', dataIndex: 'company', render: (v: string) => v || <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Status', dataIndex: 'status', width: 170, render: (v: string) => <Tag color={DEP_COLOR[v]}>{v}</Tag> },
    { title: 'Remarks', dataIndex: 'remark', render: (v: string) => v || <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: '', width: 90, render: (_: any, r: any) => <span style={{ display: 'inline-flex', gap: 4 }}><Button size="small" type="text" icon={<EditOutlined />} onClick={() => open(r)} /><Popconfirm title="Delete record?" okButtonProps={{ danger: true }} onConfirm={() => del(r.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm></span> },
  ]
  return <div>
    <DeploymentDashboard candidates={candidates} deployments={deployments} />
    <Card styles={{ body: { padding: 16 } }} style={{ marginTop: 16 }}
      title="Deployment records" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>Add record</Button>}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Tag.CheckableTag checked={!sf} onChange={() => setSf(null)}>All ({deployments.length})</Tag.CheckableTag>
        {DEP_STATUSES.map((s) => <Tag.CheckableTag key={s} checked={sf === s} onChange={() => setSf(sf === s ? null : s)}>{s} ({byStatus(s)})</Tag.CheckableTag>)}
      </div>
      <Table size="small" rowKey="id" columns={cols as any} dataSource={shown} pagination={{ pageSize: 15 }} locale={{ emptyText: <Empty description="No deployment records yet" /> }} />
    </Card>
    <Modal open={!!modal} title={modal?.id ? 'Edit record' : 'Add deployment record'} onCancel={() => setModal(null)} onOk={() => f.submit()} okText="Save">
      <Form form={f} layout="vertical" onFinish={submit} style={{ marginTop: 12 }}>
        <Form.Item name="candidateId" label="Candidate" rules={[{ required: true, message: 'Pick a candidate' }]}><Select showSearch optionFilterProp="label" placeholder="Candidate" options={candidates.map((c: any) => ({ value: c.id, label: c.name }))} /></Form.Item>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="company" label="Company / Client"><Input placeholder="e.g. Acme Corp" /></Form.Item></Col>
          <Col span={12}><Form.Item name="date" label="Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Form.Item name="status" label="Status" rules={[{ required: true }]}><Select options={DEP_STATUSES.map((s) => ({ value: s, label: s }))} /></Form.Item>
        <Form.Item name="remark" label="Remarks"><Input.TextArea rows={2} placeholder="Notes / feedback" /></Form.Item>
      </Form>
    </Modal>
  </div>
}

function DeploymentDashboard({ candidates, deployments }: any) {
  // interviews per student (each record = one interview / profile-share event), batch-wise
  const batches = batchesOf(candidates)
  const perCand = (cid: string) => deployments.filter((d: any) => d.candidateId === cid).length
  const deployedSet = new Set(deployments.filter((d: any) => d.status === 'Deployed').map((d: any) => d.candidateId))
  const rows = candidates.map((c: any) => ({ id: c.id, name: c.name, batch: c.batch || '—', interviews: perCand(c.id), deployed: deployedSet.has(c.id), latest: deployments.filter((d: any) => d.candidateId === c.id).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))[0]?.status || '—' }))
  const byBatch: Record<string, any[]> = {}; rows.forEach((r: any) => { (byBatch[r.batch] = byBatch[r.batch] || []).push(r) })
  const cols = [
    slCol,
    { title: 'Candidate', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Interviews given', dataIndex: 'interviews', width: 150, align: 'center' as const, render: (v: number) => <Tag color={v ? 'blue' : 'default'} style={{ fontWeight: 700 }}>{v}</Tag> },
    { title: 'Latest status', dataIndex: 'latest', width: 170, render: (v: string) => v === '—' ? <span style={{ color: '#9aa1ad' }}>—</span> : <Tag color={DEP_COLOR[v]}>{v}</Tag> },
  ]
  return <div>
    <div style={{ fontWeight: 700, marginBottom: 10 }}>Deployment pipeline</div>
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      {DEP_STATUSES.map((s) => (
        <Col xs={12} md={6} lg={3} key={s} style={{ flex: '1 1 130px' }}>
          <Card size="small" styles={{ body: { padding: '10px 12px' } }} style={{ borderTop: `3px solid var(--x)`, ['--x' as any]: ({ blue: '#2563eb', gold: '#d4a017', orange: '#ea580c', green: '#16a34a', volcano: '#e8743b', red: '#dc2626', purple: '#7c3aed' } as any)[DEP_COLOR[s]] }}>
            <div style={{ fontSize: 11, color: '#69707d', minHeight: 28 }}>{s}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{deployments.filter((d: any) => d.status === s).length}</div>
          </Card>
        </Col>
      ))}
    </Row>
    <div style={{ fontWeight: 700, marginBottom: 10 }}>Interviews given per student — batch-wise</div>
    {candidates.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Add candidates first" />
      : batches.length === 0
        ? <Card size="small" styles={{ body: { padding: 12 } }}><Table size="small" rowKey="id" columns={cols as any} dataSource={rows} pagination={false} /></Card>
        : batches.map((b: string) => (
          <Card key={b} size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: 12 } }}
            title={<span><Tag color="geekblue">{b}</Tag> <span style={{ color: '#9aa1ad', fontWeight: 400, fontSize: 12 }}>{byBatch[b].length} candidate{byBatch[b].length === 1 ? '' : 's'} · {byBatch[b].reduce((a: number, r: any) => a + r.interviews, 0)} interviews</span></span>}>
            <Table size="small" rowKey="id" columns={cols as any} dataSource={byBatch[b]} pagination={false} />
          </Card>
        ))}
  </div>
}

// ============================================================================
// Project dashboard (overview)
// ============================================================================
function ProjectDashboard({ candidates, attendance, ratings, deployments, syllabus }: any) {
  const batches = batchesOf(candidates)
  const attPct = (() => { if (!attendance.length) return null; return Math.round(100 * attendance.filter((a: any) => a.status === 'Present' || a.status === 'Late').length / attendance.length) })()
  const avgRating = (() => { const rs = ratings.filter((r: any) => r.score != null); return rs.length ? (rs.reduce((a: number, b: any) => a + Number(b.score), 0) / rs.length) : null })()
  const deployed = new Set(deployments.filter((d: any) => d.status === 'Deployed').map((d: any) => d.candidateId)).size
  return <div>
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      <Col xs={12} md={6}><Stat label="Candidates" value={candidates.length} color={PRIMARY} /></Col>
      <Col xs={12} md={6}><Stat label="Batches" value={batches.length || 0} color="#2563eb" /></Col>
      <Col xs={12} md={6}><Stat label="Avg attendance" value={attPct == null ? '—' : attPct} suffix={attPct == null ? '' : '%'} color="#16a34a" /></Col>
      <Col xs={12} md={6}><Stat label="Avg rating" value={avgRating == null ? '—' : avgRating.toFixed(2)} suffix={avgRating == null ? '' : '/ 5'} color="#d97706" /></Col>
      <Col xs={12} md={6}><Stat label="Syllabus topics" value={syllabus.length} color="#0ea5e9" /></Col>
      <Col xs={12} md={6}><Stat label="Interviews given" value={deployments.length} color="#7c3aed" /></Col>
      <Col xs={12} md={6}><Stat label="Deployed" value={deployed} color="#16a34a" /></Col>
      <Col xs={12} md={6}><Stat label="In pipeline" value={deployments.filter((d: any) => d.status !== 'Deployed' && d.status !== 'Rejected').length} color="#ea580c" /></Col>
    </Row>
    <Card size="small" title="Deployment snapshot" styles={{ body: { padding: 16 } }} style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {DEP_STATUSES.map((s) => <Tooltip key={s} title={s}><Tag color={DEP_COLOR[s]} style={{ padding: '4px 10px', fontSize: 13 }}>{s}: <b>{deployments.filter((d: any) => d.status === s).length}</b></Tag></Tooltip>)}
      </div>
    </Card>
    <DeploymentDashboard candidates={candidates} deployments={deployments} />
  </div>
}

// ============================================================================
// Candidate-progress tab (trainer view of what candidates self-updated)
// ============================================================================
function ProgressTab({ candidates, syllabus, progress, etiquette }: any) {
  const total = syllabus.length * ACTIVITIES.length
  const doneOf = (cid: string) => progress.filter((p: any) => p.candidateId === cid && p.status === 'Completed').length
  const actDone = (cid: string, a: string) => progress.filter((p: any) => p.candidateId === cid && p.activity === a && p.status === 'Completed').length
  const etDays = (cid: string) => etiquette.filter((e: any) => e.candidateId === cid).length
  const cols = [
    slCol,
    { title: 'Candidate', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Batch', dataIndex: 'batch', width: 110, render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
    ...ACTIVITIES.map((a) => ({ title: a, width: 100, align: 'center' as const, render: (_: any, c: any) => <Tag color={syllabus.length && actDone(c.id, a) === syllabus.length ? 'green' : actDone(c.id, a) ? 'orange' : 'default'}>{actDone(c.id, a)}/{syllabus.length}</Tag> })),
    { title: 'Overall', width: 150, render: (_: any, c: any) => { const pct = total ? Math.round(100 * doneOf(c.id) / total) : 0; return <Progress percent={pct} size="small" strokeColor={pct >= 75 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'} /> } },
    { title: 'Etiquette days', width: 120, align: 'center' as const, render: (_: any, c: any) => <span>{etDays(c.id)}</span> },
  ]
  return <Card styles={{ body: { padding: 16 } }}>
    <div style={{ fontSize: 12, color: '#9aa1ad', marginBottom: 10 }}>Candidates self-update these from their login: Videos · Presentation · Assignment · Assessment · Mock Test, plus daily etiquette check-ins (Punctuality, Discipline, Dedication, Executive attire).</div>
    <Table size="small" rowKey="id" columns={cols as any} dataSource={candidates} pagination={{ pageSize: 15 }} scroll={{ x: 'max-content' }} locale={{ emptyText: <Empty description="Add candidates & syllabus first" /> }} />
  </Card>
}

// ============================================================================
// Candidate login + self-service portal
// ============================================================================
function CandidateLogin({ db, onLogin, onBack }: any) {
  const { message: msg } = AntApp.useApp()
  const [email, setEmail] = useState(''); const [pin, setPin] = useState('')
  const submit = () => {
    const e = email.trim().toLowerCase()
    if (!e) { msg.warning('Enter your email'); return }
    const matches = db.candidates.filter((c: any) => String(c.email || '').trim().toLowerCase() === e)
    if (!matches.length) { msg.error('No candidate found with that email — ask your trainer to add you.'); return }
    const cand = matches.find((c: any) => !c.pin || String(c.pin) === pin.trim())
    if (!cand) { msg.error('Incorrect PIN.'); return }
    if (isDeployed(db, cand.id)) { msg.success('🎉 You have been deployed — your training is complete, so this access is now closed. All the best!'); return }
    onLogin(cand.id)
  }
  return <div style={{ maxWidth: 420, margin: '48px auto' }}>
    <Card>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}><TeamOutlined style={{ color: PRIMARY, marginRight: 6 }} />Candidate sign in</div>
        <div style={{ fontSize: 13, color: '#9aa1ad' }}>Update your activity progress and daily etiquette.</div>
      </div>
      <div style={{ fontSize: 12, color: '#69707d', marginBottom: 4 }}>Email</div>
      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" onPressEnter={submit} style={{ marginBottom: 10 }} />
      <div style={{ fontSize: 12, color: '#69707d', marginBottom: 4 }}>PIN <span style={{ color: '#9aa1ad' }}>(only if your trainer set one)</span></div>
      <Input.Password value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" onPressEnter={submit} style={{ marginBottom: 14 }} />
      <Button type="primary" block onClick={submit}>Sign in</Button>
      {onBack && <Button type="link" block onClick={onBack} style={{ marginTop: 6 }}>← Back to staff view</Button>}
    </Card>
  </div>
}

function CandidatePortal({ db, mutate, candidate, onLogout }: any) {
  const project = db.projects.find((p: any) => p.id === candidate.projectId)
  const syllabus = db.syllabus.filter((s: any) => s.projectId === candidate.projectId)
  const [etDate, setEtDate] = useState<any>(dayjs())
  const dstr = etDate.format('YYYY-MM-DD')
  const et = db.etiquette.find((e: any) => e.candidateId === candidate.id && e.date === dstr)
  const setEt = (item: string, val: boolean) => mutate((d: DB) => { let r: any = d.etiquette.find((e: any) => e.projectId === candidate.projectId && e.candidateId === candidate.id && e.date === dstr); if (!r) { r = { id: uid(), projectId: candidate.projectId, candidateId: candidate.id, date: dstr, vals: {} }; d.etiquette.push(r) } r.vals = { ...(r.vals || {}), [item]: val } })
  const setStatus = (topicId: string, activity: string, status: string) => mutate((d: DB) => { const r: any = d.progress.find((p: any) => p.projectId === candidate.projectId && p.candidateId === candidate.id && p.topicId === topicId && p.activity === activity); if (r) r.status = status; else d.progress.push({ id: uid(), projectId: candidate.projectId, candidateId: candidate.id, topicId, activity, status }) })
  const statusOf = (topicId: string, activity: string) => db.progress.find((p: any) => p.candidateId === candidate.id && p.topicId === topicId && p.activity === activity)?.status || 'Not started'
  const total = syllabus.length * ACTIVITIES.length
  const done = db.progress.filter((p: any) => p.candidateId === candidate.id && p.status === 'Completed').length
  const pct = total ? Math.round(100 * done / total) : 0
  const cols = [
    slCol,
    { title: 'Subject', dataIndex: 'subject', width: 120, render: (v: string) => <span style={{ color: '#69707d', fontSize: 12 }}>{v}</span> },
    { title: 'Chapter', dataIndex: 'chapter', width: 130, render: (v: string) => v && v !== '—' ? <span style={{ color: '#69707d', fontSize: 12 }}>{v}</span> : <span style={{ color: '#c8ccd4' }}>—</span> },
    { title: 'Topic', dataIndex: 'topic', render: (v: string) => <b>{v}</b> },
    ...ACTIVITIES.map((a) => ({ title: a, width: 150, render: (_: any, s: any) => { const st = statusOf(s.id, a); return <Select size="small" value={st} onChange={(v) => setStatus(s.id, a, v)} style={{ width: 138 }} options={ACT_STATUS.map((x) => ({ value: x, label: x }))} /> } })),
  ]
  return <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Hi, {candidate.name} 👋</div>
        <div style={{ fontSize: 13, color: '#9aa1ad' }}>{project?.name || 'Project'}{candidate.batch ? ` · Batch ${candidate.batch}` : ''}</div>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        <Tooltip title={`${done}/${total || 0} activities completed`}><span style={{ width: 150 }}><Progress percent={pct} size="small" /></span></Tooltip>
        <Button onClick={onLogout}>Sign out</Button>
      </span>
    </div>
    <Card size="small" title="Daily etiquette — today's check-in" style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}
      extra={<DatePicker size="small" value={etDate} onChange={(v) => setEtDate(v || dayjs())} allowClear={false} disabledDate={(d) => d && d.isAfter(dayjs(), 'day')} />}>
      <Row gutter={[16, 12]}>
        {ETIQUETTE.map((item) => (
          <Col xs={12} md={6} key={item}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #eef0f3', borderRadius: 10, padding: '10px 12px' }}>
              <span style={{ fontSize: 13 }}>{item}</span>
              <Switch checked={!!et?.vals?.[item]} onChange={(v) => setEt(item, v)} />
            </div>
          </Col>
        ))}
      </Row>
    </Card>
    <Card size="small" title="My learning activities" styles={{ body: { padding: 16 } }}>
      {syllabus.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No syllabus topics yet — your trainer will add them." />
        : <Table size="small" rowKey="id" columns={cols as any} dataSource={syllabus} pagination={{ pageSize: 20 }} scroll={{ x: 'max-content' }} />}
    </Card>
  </div>
}
