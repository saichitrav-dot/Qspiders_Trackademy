// ============================================================================
// Projects — SELF-CONTAINED feature (localStorage; does not touch existing code/data).
//   Organisation → Subject → Batch → Students
//   Each Subject has: Batches & Students, Attendance, Syllabus (Subject/Chapter/
//   Topic/Sub-topic), topic-wise Ratings, Candidate progress, Deployment pipeline.
//   Candidate self-service portal (/student): update completion on a syllabus TREE
//   and see the ratings their trainer gave (read-only).
// ============================================================================
import { useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Card, Tabs, Table, Tag, Button, Input, Modal, Form, Select, DatePicker, Empty,
  Segmented, Popconfirm, Statistic, Row, Col, Progress, Upload, App as AntApp, Tooltip, Collapse,
} from 'antd'
import {
  AppstoreOutlined, PlusOutlined, TeamOutlined, CalendarOutlined, ReadOutlined, StarOutlined,
  RocketOutlined, DashboardOutlined, DeleteOutlined, EditOutlined, UploadOutlined, BankOutlined,
  ArrowLeftOutlined, DownloadOutlined, PartitionOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

// ---------- store (localStorage) ----------
const LS_KEY = 'trackademy_projects_v1'
type DB = { orgs: any[]; projects: any[]; batches: any[]; candidates: any[]; attendance: any[]; syllabus: any[]; ratings: any[]; deployments: any[]; progress: any[] }
const emptyDB: DB = { orgs: [], projects: [], batches: [], candidates: [], attendance: [], syllabus: [], ratings: [], deployments: [], progress: [] }
function loadDB(): DB { try { const r = localStorage.getItem(LS_KEY); return r ? { ...emptyDB, ...JSON.parse(r) } : emptyDB } catch { return emptyDB } }
function saveDB(db: DB) { try { localStorage.setItem(LS_KEY, JSON.stringify(db)) } catch { /* ignore */ } }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

const ACTIVITIES = ['Videos', 'Presentation', 'Assignment', 'Assessment', 'Mock Test']
const ACT_STATUS = ['Not started', 'In progress', 'Completed']
const DEP_STATUSES = ['Profiles shared', 'Interview in Progress', 'Waiting for results', 'Shortlisted', 'Not Shortlisted', 'Rejected', 'Deployed']
const DEP_COLOR: Record<string, string> = { 'Profiles shared': 'blue', 'Interview in Progress': 'gold', 'Waiting for results': 'orange', 'Shortlisted': 'green', 'Not Shortlisted': 'volcano', 'Rejected': 'red', 'Deployed': 'purple' }
const ATT_OPTS = ['Present', 'Absent', 'Late', 'Leave']
const PRIMARY = '#ff6a00'
const slCol = { title: 'Sl No', width: 64, render: (_: any, r: any, i: number) => <span style={{ color: '#9aa1ad' }}>{r._sl ?? i + 1}</span> }
const withSl = (arr: any[]) => (arr || []).map((r, i) => ({ ...r, _sl: i + 1 }))
const isDeployed = (db: DB, candidateId: string) => db.deployments.some((d) => d.candidateId === candidateId && d.status === 'Deployed')
// a syllabus row's leaf label + full path
const leafLabel = (s: any) => (s.subtopic && s.subtopic !== '—') ? s.subtopic : s.topic
const nodePath = (s: any) => [s.subject, s.chapter, s.topic, s.subtopic].filter((x: string) => x && x !== '—').join(' › ')

export default function Projects() {
  const [db, setDb] = useState<DB>(loadDB)
  const mutate = (producer: (d: DB) => void) => setDb((prev) => { const next: DB = JSON.parse(JSON.stringify(prev)); producer(next); saveDB(next); return next })
  const [sel, setSel] = useState<string | null>(null)
  const project = db.projects.find((p) => p.id === sel)
  if (project) return <SubjectWorkspace db={db} mutate={mutate} project={project} org={db.orgs.find((o) => o.id === project.orgId)} onBack={() => setSel(null)} />
  return <OrgHome db={db} mutate={mutate} onOpen={setSel} />
}

// Standalone candidate portal — its own public route (/student), outside staff auth.
export function CandidateApp() {
  const [db, setDb] = useState<DB>(loadDB)
  const mutate = (producer: (d: DB) => void) => setDb((prev) => { const next: DB = JSON.parse(JSON.stringify(prev)); producer(next); saveDB(next); return next })
  const [candId, setCandId] = useState<string | null>(null)
  const candidate = db.candidates.find((c) => c.id === candId)
  const inner = (!candidate || isDeployed(db, candidate.id))
    ? <CandidateLogin db={db} onLogin={setCandId} />
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
// Organisations + Subjects landing
// ============================================================================
function OrgHome({ db, mutate, onOpen }: any) {
  const { message: msg } = AntApp.useApp()
  const [orgModal, setOrgModal] = useState(false)
  const [projModal, setProjModal] = useState<any>(null)
  const [of] = Form.useForm(); const [pf] = Form.useForm()
  const addOrg = (v: any) => { mutate((d: DB) => { d.orgs.push({ id: uid(), name: v.name.trim() }) }); setOrgModal(false); of.resetFields(); msg.success('Organisation added') }
  const addProject = (v: any) => { mutate((d: DB) => { d.projects.push({ id: uid(), orgId: projModal.orgId, name: v.name.trim(), desc: v.desc || '' }) }); setProjModal(null); pf.resetFields(); msg.success('Subject created') }
  const delOrg = (id: string) => mutate((d: DB) => { d.orgs = d.orgs.filter((o) => o.id !== id); d.projects = d.projects.filter((p) => p.orgId !== id) })
  const delProj = (id: string) => mutate((d: DB) => { d.projects = d.projects.filter((p) => p.id !== id) })
  const projCount = (orgId: string) => db.projects.filter((p: any) => p.orgId === orgId).length
  const candCount = (projId: string) => db.candidates.filter((c: any) => c.projectId === projId).length
  const batchCount = (projId: string) => db.batches.filter((b: any) => b.projectId === projId).length
  return <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}><AppstoreOutlined style={{ color: PRIMARY, marginRight: 8 }} />Projects</div>
        <div style={{ fontSize: 13, color: '#9aa1ad' }}>Organisations → Subjects → Batches → Students.</div>
      </div>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setOrgModal(true)}>Add organisation</Button>
    </div>
    {db.orgs.length === 0 ? <Card><Empty description="No organisations yet — add one to get started." /></Card>
      : db.orgs.map((o: any) => (
        <Card key={o.id} style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}
          title={<span><BankOutlined style={{ color: PRIMARY, marginRight: 8 }} /><b>{o.name}</b> <Tag style={{ marginLeft: 8 }}>{projCount(o.id)} subject{projCount(o.id) === 1 ? '' : 's'}</Tag></span>}
          extra={<span style={{ display: 'inline-flex', gap: 8 }}>
            <Button size="small" icon={<PlusOutlined />} onClick={() => setProjModal({ orgId: o.id })}>Add subject</Button>
            <Popconfirm title="Delete this organisation and its subjects?" okButtonProps={{ danger: true }} onConfirm={() => delOrg(o.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
          </span>}>
          {projCount(o.id) === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No subjects yet" />
            : <Row gutter={[12, 12]}>
              {db.projects.filter((p: any) => p.orgId === o.id).map((p: any) => (
                <Col xs={24} sm={12} lg={8} key={p.id}>
                  <Card hoverable size="small" styles={{ body: { padding: 14 } }} onClick={() => onOpen(p.id)} style={{ border: '1px solid #eef0f3', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}><ReadOutlined style={{ color: PRIMARY, marginRight: 6 }} />{p.name}</div>
                        {p.desc && <div style={{ fontSize: 12, color: '#9aa1ad', marginTop: 2 }}>{p.desc}</div>}
                        <div style={{ fontSize: 12, color: '#69707d', marginTop: 8 }}>{batchCount(p.id)} batch{batchCount(p.id) === 1 ? '' : 'es'} · {candCount(p.id)} student{candCount(p.id) === 1 ? '' : 's'}</div>
                      </div>
                      <Popconfirm title="Delete subject?" okButtonProps={{ danger: true }} onConfirm={() => delProj(p.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} /></Popconfirm>
                    </div>
                    <Button type="link" size="small" style={{ paddingLeft: 0, marginTop: 6 }}>Open →</Button>
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
    <Modal open={!!projModal} title="Create subject" onCancel={() => setProjModal(null)} onOk={() => pf.submit()} okText="Create">
      <Form form={pf} layout="vertical" onFinish={addProject} style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Subject name" rules={[{ required: true, message: 'Enter a name' }]}><Input placeholder="e.g. Java Full Stack" /></Form.Item>
        <Form.Item name="desc" label="Description (optional)"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  </div>
}

// ============================================================================
// Subject workspace — tabs
// ============================================================================
function SubjectWorkspace({ db, mutate, project, org, onBack }: any) {
  const pid = project.id
  const batches = db.batches.filter((b: any) => b.projectId === pid)
  const candidates = db.candidates.filter((c: any) => c.projectId === pid)
  const syllabus = db.syllabus.filter((s: any) => s.projectId === pid)
  const ratings = db.ratings.filter((r: any) => r.projectId === pid)
  const attendance = db.attendance.filter((a: any) => a.projectId === pid)
  const deployments = db.deployments.filter((d: any) => d.projectId === pid)
  const progress = db.progress.filter((p: any) => p.projectId === pid)
  const ctx = { db, mutate, pid, batches, candidates, syllabus, ratings, attendance, deployments, progress }
  return <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      <Button icon={<ArrowLeftOutlined />} onClick={onBack}>All subjects</Button>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{project.name}</div>
        <div style={{ fontSize: 12, color: '#9aa1ad' }}>{org?.name || 'Organisation'}{project.desc ? ` · ${project.desc}` : ''}</div>
      </div>
    </div>
    <Tabs defaultActiveKey="dash" items={[
      { key: 'dash', label: <span><DashboardOutlined /> Dashboard</span>, children: <SubjectDashboard {...ctx} /> },
      { key: 'batch', label: <span><TeamOutlined /> Batches & Students</span>, children: <BatchesTab {...ctx} /> },
      { key: 'att', label: <span><CalendarOutlined /> Attendance</span>, children: <AttendanceTab {...ctx} /> },
      { key: 'syl', label: <span><ReadOutlined /> Syllabus</span>, children: <SyllabusTab {...ctx} /> },
      { key: 'rate', label: <span><StarOutlined /> Ratings</span>, children: <RatingsTab {...ctx} /> },
      { key: 'prog', label: <span><PartitionOutlined /> Candidate progress</span>, children: <ProgressTab {...ctx} /> },
      { key: 'dep', label: <span><RocketOutlined /> Deployment</span>, children: <DeploymentTab {...ctx} /> },
    ]} />
  </div>
}

// ---------- shared ----------
const candName = (candidates: any[], id: string) => candidates.find((c) => c.id === id)?.name || '—'
function Stat({ label, value, color, suffix }: any) {
  return <Card size="small" styles={{ body: { padding: '12px 16px' } }}><Statistic title={<span style={{ fontSize: 12 }}>{label}</span>} value={value} suffix={suffix} valueStyle={{ color: color || '#161a22', fontWeight: 800, fontSize: 22 }} /></Card>
}
const avgRatingOf = (ratings: any[], candidateId: string) => { const rs = ratings.filter((r) => r.candidateId === candidateId && r.score != null); return rs.length ? rs.reduce((a: number, b: any) => a + Number(b.score), 0) / rs.length : null }

// ============================================================================
// Batches & Students  (Subject → Batch → Students)
// ============================================================================
function BatchesTab({ mutate, pid, batches, candidates, syllabus }: any) {
  const { message: msg } = AntApp.useApp()
  const [batchModal, setBatchModal] = useState<any>(null) // true (add) or batch (edit)
  const [stuModal, setStuModal] = useState<any>(null) // { batchId, batchName } (add) or candidate (edit)
  const [bf] = Form.useForm(); const [sf] = Form.useForm()
  const sylSubjects = [...new Set(syllabus.map((s: any) => s.subject))].sort() as string[]
  const addBatch = (v: any) => {
    if (batchModal?.id) mutate((d: DB) => { const b = d.batches.find((x) => x.id === batchModal.id); if (b) { b.name = v.name.trim(); b.subject = v.subject || '' } })
    else mutate((d: DB) => { d.batches.push({ id: uid(), projectId: pid, name: v.name.trim(), subject: v.subject || '' }) })
    setBatchModal(null); bf.resetFields(); msg.success('Saved')
  }
  const openBatch = (b?: any) => { setBatchModal(b || true); setTimeout(() => bf.setFieldsValue(b ? { name: b.name, subject: b.subject || undefined } : {}), 0) }
  const delBatch = (id: string) => mutate((d: DB) => { const cids = new Set(d.candidates.filter((c) => c.batchId === id).map((c) => c.id)); d.batches = d.batches.filter((b) => b.id !== id); d.candidates = d.candidates.filter((c) => c.batchId !== id); d.attendance = d.attendance.filter((a) => !cids.has(a.candidateId)); d.ratings = d.ratings.filter((r) => !cids.has(r.candidateId)); d.progress = d.progress.filter((p) => !cids.has(p.candidateId)); d.deployments = d.deployments.filter((x) => !cids.has(x.candidateId)) })
  const openStudent = (batch: any, c?: any) => { setStuModal(c || { batchId: batch.id, batchName: batch.name }); setTimeout(() => sf.setFieldsValue(c || {}), 0) }
  const submitStudent = (v: any) => {
    if (stuModal?.id) mutate((d: DB) => { const c = d.candidates.find((x) => x.id === stuModal.id); if (c) Object.assign(c, v) })
    else mutate((d: DB) => { d.candidates.push({ id: uid(), projectId: pid, batchId: stuModal.batchId, batch: stuModal.batchName, ...v }) })
    setStuModal(null); sf.resetFields(); msg.success('Saved')
  }
  const delStudent = (id: string) => mutate((d: DB) => { d.candidates = d.candidates.filter((c) => c.id !== id); d.attendance = d.attendance.filter((a) => a.candidateId !== id); d.ratings = d.ratings.filter((r) => r.candidateId !== id); d.progress = d.progress.filter((p) => p.candidateId !== id); d.deployments = d.deployments.filter((x) => x.candidateId !== id) })
  const bulkAdd = (batch: any, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' })
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        const add = rows.map((r) => ({ id: uid(), projectId: pid, batchId: batch.id, batch: batch.name, name: String(r.Name || r.name || '').trim(), email: String(r.Email || r.email || r['Email ID'] || '').trim(), contact: String(r.Contact || r.contact || r['Contact number'] || r.Phone || '').trim(), pin: String(r.PIN || r.pin || '').trim() })).filter((r) => r.name)
        if (!add.length) { msg.warning('No rows with a Name column found.'); return }
        mutate((d: DB) => { d.candidates.push(...add) }); msg.success(`${add.length} student(s) added to ${batch.name}`)
      } catch { msg.error('Could not read the file. Columns: Name, Email, Contact, PIN.') }
    }
    reader.readAsBinaryString(file); return false
  }
  const stuCols = (batch: any) => [
    slCol,
    { title: 'Name', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Email', dataIndex: 'email', render: (v: string) => v || <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Contact', dataIndex: 'contact', width: 140, render: (v: string) => v || <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Login PIN', dataIndex: 'pin', width: 90, render: (v: string) => v || <span style={{ color: '#c8ccd4' }}>—</span> },
    { title: '', width: 80, render: (_: any, c: any) => <span style={{ display: 'inline-flex', gap: 2 }}><Button size="small" type="text" icon={<EditOutlined />} onClick={() => openStudent(batch, c)} /><Popconfirm title="Delete student?" okButtonProps={{ danger: true }} onConfirm={() => delStudent(c.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm></span> },
  ]
  return <Card styles={{ body: { padding: 16 } }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
      <span style={{ fontSize: 13, color: '#69707d' }}>Create a batch (pick the subject it covers), then add students. Students see only their batch's subject at login.</span>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => openBatch()}>Add batch</Button>
    </div>
    {batches.length === 0 ? <Empty description="No batches yet — add one." />
      : <Collapse defaultActiveKey={batches.map((b: any) => b.id)} items={batches.map((batch: any) => {
        const students = candidates.filter((c: any) => c.batchId === batch.id)
        return {
          key: batch.id,
          label: <span><Tag color="geekblue">{batch.name}</Tag>{batch.subject ? <Tag color="purple">{batch.subject}</Tag> : <Tag color="warning" style={{ fontSize: 10 }}>no subject set</Tag>} <span style={{ color: '#9aa1ad', fontSize: 12 }}>{students.length} student{students.length === 1 ? '' : 's'}</span></span>,
          extra: <span style={{ display: 'inline-flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <Button size="small" icon={<EditOutlined />} onClick={() => openBatch(batch)}>Edit</Button>
            <Upload accept=".xlsx,.xls,.csv" showUploadList={false} beforeUpload={(f: any) => bulkAdd(batch, f)}><Button size="small" icon={<UploadOutlined />}>Import</Button></Upload>
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openStudent(batch)}>Add student</Button>
            <Popconfirm title={`Delete batch “${batch.name}” and its students?`} okButtonProps={{ danger: true }} onConfirm={() => delBatch(batch.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
          </span>,
          children: students.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No students yet — add manually or import Excel (Name, Email, Contact, PIN)." />
            : <Table size="small" rowKey="id" columns={stuCols(batch) as any} dataSource={students} pagination={{ pageSize: 15 }} />,
        }
      })} />}
    <Modal open={!!batchModal} title={batchModal?.id ? 'Edit batch' : 'Add batch'} onCancel={() => setBatchModal(null)} onOk={() => bf.submit()} okText="Save">
      <Form form={bf} layout="vertical" onFinish={addBatch} style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Batch name" rules={[{ required: true, message: 'Enter a batch name' }]}><Input placeholder="e.g. Oct-26 Batch A" /></Form.Item>
        <Form.Item name="subject" label="Subject this batch covers" tooltip="Students in this batch see only this subject's syllabus at login. Leave blank to show all subjects.">
          {sylSubjects.length ? <Select allowClear showSearch placeholder="Pick a subject from the syllabus" options={sylSubjects.map((s) => ({ value: s, label: s }))} />
            : <Input placeholder="Type the subject name (upload syllabus first to pick)" />}
        </Form.Item>
      </Form>
    </Modal>
    <Modal open={!!stuModal} title={stuModal?.id ? 'Edit student' : `Add student${stuModal?.batchName ? ` · ${stuModal.batchName}` : ''}`} onCancel={() => setStuModal(null)} onOk={() => sf.submit()} okText="Save">
      <Form form={sf} layout="vertical" onFinish={submitStudent} style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Enter a name' }]}><Input placeholder="Student name" /></Form.Item>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="email" label="Email ID" rules={[{ type: 'email', message: 'Invalid email' }]}><Input placeholder="name@example.com" /></Form.Item></Col>
          <Col span={12}><Form.Item name="contact" label="Contact number"><Input placeholder="Phone" /></Form.Item></Col>
        </Row>
        <Form.Item name="pin" label="Login PIN (optional)" tooltip="Student signs in at /student with email + this PIN"><Input placeholder="e.g. 1234" /></Form.Item>
      </Form>
    </Modal>
  </Card>
}

// ============================================================================
// Attendance
// ============================================================================
function AttendanceTab({ mutate, pid, batches, candidates, attendance }: any) {
  const { message: msg } = AntApp.useApp()
  const [date, setDate] = useState<any>(dayjs())
  const [bf, setBf] = useState<string | null>(null)
  const dstr = date.format('YYYY-MM-DD')
  const statusOf = (cid: string) => attendance.find((a: any) => a.candidateId === cid && a.date === dstr)?.status
  const setStatus = (cid: string, status: string) => mutate((d: DB) => { const rec = d.attendance.find((a) => a.projectId === pid && a.candidateId === cid && a.date === dstr); if (rec) rec.status = status; else d.attendance.push({ id: uid(), projectId: pid, candidateId: cid, date: dstr, status }) })
  const markAll = (status: string) => { mutate((d: DB) => { shown.forEach((c: any) => { const rec = d.attendance.find((a) => a.projectId === pid && a.candidateId === c.id && a.date === dstr); if (rec) rec.status = status; else d.attendance.push({ id: uid(), projectId: pid, candidateId: c.id, date: dstr, status }) }) }); msg.success(`All marked ${status}`) }
  const pct = (cid: string) => { const recs = attendance.filter((a: any) => a.candidateId === cid); if (!recs.length) return null; return Math.round(100 * recs.filter((r: any) => r.status === 'Present' || r.status === 'Late').length / recs.length) }
  const shown = candidates.filter((c: any) => !bf || c.batchId === bf)
  const cols = [
    slCol,
    { title: 'Student', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Batch', dataIndex: 'batch', width: 130, render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: `Status · ${date.format('DD MMM YYYY')}`, width: 320, render: (_: any, c: any) => <Segmented size="small" value={statusOf(c.id) || ''} onChange={(v) => setStatus(c.id, v as string)} options={ATT_OPTS.map((o) => ({ value: o, label: o }))} /> },
    { title: 'Overall %', width: 130, render: (_: any, c: any) => { const p = pct(c.id); return p == null ? <span style={{ color: '#9aa1ad' }}>—</span> : <Progress percent={p} size="small" strokeColor={p >= 75 ? '#16a34a' : p >= 50 ? '#d97706' : '#dc2626'} /> } },
  ]
  return <Card styles={{ body: { padding: 16 } }}>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
      <DatePicker value={date} onChange={(v) => setDate(v || dayjs())} allowClear={false} disabledDate={(d) => d && d.isAfter(dayjs(), 'day')} />
      <Select allowClear placeholder="Batch" value={bf} onChange={(v) => setBf(v ?? null)} style={{ minWidth: 170 }} options={batches.map((b: any) => ({ value: b.id, label: b.name }))} />
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <Button size="small" onClick={() => markAll('Present')}>Mark all Present</Button>
        <Button size="small" onClick={() => markAll('Absent')}>Mark all Absent</Button>
      </div>
    </div>
    <Table size="small" rowKey="id" columns={cols as any} dataSource={shown} pagination={{ pageSize: 20 }} locale={{ emptyText: <Empty description="Add students first" /> }} />
  </Card>
}

// ============================================================================
// Syllabus — Subject / Chapter / Topic / Sub-topic (template + Excel), shown as subject cards
// ============================================================================
function SyllabusTab({ mutate, pid, syllabus }: any) {
  const { message: msg } = AntApp.useApp()
  const [f] = Form.useForm()
  const add = (v: any) => { mutate((d: DB) => { d.syllabus.push({ id: uid(), projectId: pid, subject: (v.subject || '').trim() || 'General', chapter: (v.chapter || '').trim() || '—', topic: (v.topic || '').trim(), subtopic: (v.subtopic || '').trim() || '—' }) }); f.resetFields(); msg.success('Row added') }
  const onFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' })
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        const add = rows.map((r) => ({ id: uid(), projectId: pid, subject: String(r.Subject || r.subject || 'General').trim(), chapter: String(r.Chapter || r.chapter || '—').trim() || '—', topic: String(r.Topic || r.topic || '').trim(), subtopic: String(r['Sub topic'] || r['Sub-topic'] || r.Subtopic || r.subtopic || '—').trim() || '—' })).filter((r) => r.topic || (r.subtopic && r.subtopic !== '—'))
        if (!add.length) { msg.warning('Nothing to import. Columns: Subject, Chapter, Topic, Sub topic.'); return }
        mutate((d: DB) => { d.syllabus.push(...add) }); msg.success(`${add.length} row(s) uploaded`)
      } catch { msg.error('Could not read the file. Columns: Subject, Chapter, Topic, Sub topic.') }
    }
    reader.readAsBinaryString(file); return false
  }
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { Subject: 'Core Java', Chapter: 'Collections', Topic: 'List', 'Sub topic': 'ArrayList' },
      { Subject: 'Core Java', Chapter: 'Collections', Topic: 'List', 'Sub topic': 'LinkedList' },
      { Subject: 'Core Java', Chapter: 'Collections', Topic: 'Map', 'Sub topic': 'HashMap' },
      { Subject: 'Advance Java', Chapter: 'Spring Boot', Topic: 'REST', 'Sub topic': 'Controllers' },
    ])
    ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 22 }]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Syllabus'); XLSX.writeFile(wb, 'syllabus-template.xlsx')
  }
  const subjects = [...new Set(syllabus.map((s: any) => s.subject))].sort() as string[]
  const rowsOfSubject = (subj: string) => syllabus.filter((s: any) => s.subject === subj)
  const downloadSubject = (subj: string) => {
    const ws = XLSX.utils.json_to_sheet(rowsOfSubject(subj).map((s: any) => ({ Subject: s.subject, Chapter: s.chapter === '—' ? '' : s.chapter, Topic: s.topic, 'Sub topic': s.subtopic === '—' ? '' : s.subtopic })))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Syllabus'); XLSX.writeFile(wb, `syllabus-${subj.replace(/[^a-z0-9]+/gi, '-')}.xlsx`)
  }
  const delSubject = (subj: string) => mutate((d: DB) => { const ids = new Set(d.syllabus.filter((s) => s.projectId === pid && s.subject === subj).map((s) => s.id)); d.syllabus = d.syllabus.filter((s) => !ids.has(s.id)); d.ratings = d.ratings.filter((r) => !ids.has(r.topicId)); d.progress = d.progress.filter((p) => !ids.has(p.topicId)) })
  return <Card styles={{ body: { padding: 16 } }}>
    <div style={{ background: '#f7f8fb', border: '1px solid #eef0f3', borderRadius: 10, padding: 12, marginBottom: 16 }}>
      <Form form={f} layout="inline" onFinish={add} style={{ rowGap: 8 }}>
        <Form.Item name="subject"><Input placeholder="Subject" style={{ width: 150 }} /></Form.Item>
        <Form.Item name="chapter"><Input placeholder="Chapter" style={{ width: 150 }} /></Form.Item>
        <Form.Item name="topic"><Input placeholder="Topic" style={{ width: 150 }} /></Form.Item>
        <Form.Item name="subtopic"><Input placeholder="Sub topic" style={{ width: 150 }} /></Form.Item>
        <Form.Item><Button type="primary" icon={<PlusOutlined />} htmlType="submit">Add</Button></Form.Item>
        <Form.Item><Upload accept=".xlsx,.xls,.csv" showUploadList={false} beforeUpload={onFile as any}><Button icon={<UploadOutlined />}>Upload syllabus (Excel)</Button></Upload></Form.Item>
        <Form.Item><Button icon={<DownloadOutlined />} onClick={downloadTemplate}>Download template</Button></Form.Item>
      </Form>
      <div style={{ fontSize: 11, color: '#9aa1ad', marginTop: 8 }}>Template columns — <b>Subject</b>, <b>Chapter</b>, <b>Topic</b>, <b>Sub topic</b>. Fill it, then upload it back.</div>
    </div>
    {subjects.length === 0 ? <Empty description="No syllabus yet — upload an Excel with Subject, Chapter, Topic, Sub topic columns." />
      : <Row gutter={[12, 12]}>
        {subjects.map((subj) => (
          <Col xs={24} sm={12} lg={8} key={subj}>
            <Card size="small" styles={{ body: { padding: 14 } }} style={{ border: '1px solid #eef0f3', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                <div><div style={{ fontWeight: 700, fontSize: 15 }}><ReadOutlined style={{ color: PRIMARY, marginRight: 6 }} />{subj}</div>
                  <div style={{ fontSize: 12, color: '#9aa1ad', marginTop: 2 }}>{rowsOfSubject(subj).length} row{rowsOfSubject(subj).length === 1 ? '' : 's'}</div></div>
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
// Ratings — trainer rates each student per syllabus node (topic / sub-topic)
// ============================================================================
function RatingsTab({ mutate, pid, candidates, syllabus, ratings }: any) {
  const { message: msg } = AntApp.useApp()
  const [cid, setCid] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, { score?: number; remark?: string }>>({})
  const existing = (candidateId: string, nodeId: string) => ratings.find((r: any) => r.candidateId === candidateId && r.topicId === nodeId)
  const save = () => {
    if (!cid) return
    const entries = Object.entries(draft).filter(([, v]) => v.score != null)
    if (!entries.length) { msg.warning('Set at least one score.'); return }
    mutate((d: DB) => {
      entries.forEach(([nodeId, v]) => {
        const rec = d.ratings.find((r) => r.projectId === pid && r.candidateId === cid && r.topicId === nodeId)
        if (rec) { rec.score = v.score; rec.remark = v.remark ?? rec.remark; rec.date = dayjs().format('YYYY-MM-DD') }
        else d.ratings.push({ id: uid(), projectId: pid, candidateId: cid, topicId: nodeId, score: v.score, remark: v.remark || '', date: dayjs().format('YYYY-MM-DD') })
      })
    })
    setDraft({}); msg.success('Ratings saved')
  }
  const summaryCols = [
    slCol,
    { title: 'Student', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Batch', dataIndex: 'batch', width: 120, render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Rated', width: 110, render: (_: any, c: any) => <span>{ratings.filter((r: any) => r.candidateId === c.id).length} / {syllabus.length}</span> },
    { title: 'Average', width: 120, render: (_: any, c: any) => { const a = avgRatingOf(ratings, c.id); return a == null ? <span style={{ color: '#9aa1ad' }}>—</span> : <Tag color={a >= 4 ? 'green' : a >= 3 ? 'orange' : 'red'}>{a.toFixed(2)} / 5</Tag> } },
    { title: '', width: 90, render: (_: any, c: any) => <Button size="small" onClick={() => { setCid(c.id); setDraft({}) }}>Rate</Button> },
  ]
  return <Row gutter={16}>
    <Col xs={24} lg={13}>
      <Card size="small" title="Students — ratings summary" styles={{ body: { padding: 12 } }}>
        <Table size="small" rowKey="id" columns={summaryCols as any} dataSource={candidates} pagination={{ pageSize: 12 }} locale={{ emptyText: <Empty description="Add students first" /> }} />
      </Card>
    </Col>
    <Col xs={24} lg={11}>
      <Card size="small" styles={{ body: { padding: 12 } }}
        title={<span>Rate node-wise{cid ? <> — <b>{candName(candidates, cid)}</b></> : ''}</span>}
        extra={<Select placeholder="Pick student" value={cid} onChange={(v) => { setCid(v); setDraft({}) }} style={{ minWidth: 180 }} options={candidates.map((c: any) => ({ value: c.id, label: c.name }))} />}>
        {!cid ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pick a student to rate" />
          : syllabus.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Add syllabus first" />
            : <div style={{ maxHeight: 460, overflowY: 'auto' }}>
              {syllabus.map((s: any) => {
                const ex = existing(cid, s.id); const cur = draft[s.id]?.score ?? ex?.score ?? 0
                return <div key={s.id} style={{ borderBottom: '1px solid #f0f0f0', padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12 }}>{nodePath(s)}</span>
                    <Select size="small" value={cur} onChange={(v) => setDraft((d) => ({ ...d, [s.id]: { ...d[s.id], score: v } }))} style={{ width: 90 }} options={[0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => ({ value: n, label: n === 0 ? '—' : `${n}` }))} />
                  </div>
                  <Input size="small" placeholder="Remark (optional)" defaultValue={ex?.remark} onChange={(e) => setDraft((d) => ({ ...d, [s.id]: { ...d[s.id], remark: e.target.value } }))} style={{ marginTop: 6 }} />
                </div>
              })}
              <Button type="primary" block style={{ marginTop: 12 }} onClick={save}>Save ratings</Button>
            </div>}
      </Card>
    </Col>
  </Row>
}

// ============================================================================
// Candidate progress (trainer view) — activity completion + RATINGS per student
// ============================================================================
function ProgressTab({ candidates, syllabus, progress, ratings }: any) {
  const [open, setOpen] = useState<string | null>(null)
  const total = syllabus.length * ACTIVITIES.length
  const doneOf = (cid: string) => progress.filter((p: any) => p.candidateId === cid && p.status === 'Completed').length
  const cols = [
    slCol,
    { title: 'Student', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Batch', dataIndex: 'batch', width: 120, render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Completion', width: 170, render: (_: any, c: any) => { const pct = total ? Math.round(100 * doneOf(c.id) / total) : 0; return <Progress percent={pct} size="small" strokeColor={pct >= 75 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'} /> } },
    { title: 'Avg rating', width: 120, align: 'center' as const, render: (_: any, c: any) => { const a = avgRatingOf(ratings, c.id); return a == null ? <span style={{ color: '#9aa1ad' }}>—</span> : <Tag color={a >= 4 ? 'green' : a >= 3 ? 'orange' : 'red'}>{a.toFixed(2)} / 5</Tag> } },
    { title: '', width: 120, render: (_: any, c: any) => <Button size="small" onClick={() => setOpen(c.id)}>View ratings</Button> },
  ]
  const ratingList = open ? ratings.filter((r: any) => r.candidateId === open).map((r: any) => { const s = syllabus.find((x: any) => x.id === r.topicId); return { ...r, path: s ? nodePath(s) : '—' } }) : []
  return <Card styles={{ body: { padding: 16 } }}>
    <div style={{ fontSize: 12, color: '#9aa1ad', marginBottom: 10 }}>Completion = activities students update themselves. Avg rating = what the trainer gave (also visible to the student).</div>
    <Table size="small" rowKey="id" columns={cols as any} dataSource={candidates} pagination={{ pageSize: 15 }} locale={{ emptyText: <Empty description="Add students & syllabus first" /> }} />
    <Modal open={!!open} title={<span>Ratings · {candName(candidates, open || '')}</span>} footer={null} width={640} onCancel={() => setOpen(null)}>
      {ratingList.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No ratings given yet" />
        : <Table size="small" rowKey="id" pagination={false} dataSource={ratingList} columns={[
          { title: 'Topic', dataIndex: 'path' },
          { title: 'Score', dataIndex: 'score', width: 100, render: (v: number) => <Tag color={v >= 4 ? 'green' : v >= 3 ? 'orange' : 'red'}>{v} / 5</Tag> },
          { title: 'Remark', dataIndex: 'remark', render: (v: string) => v || <span style={{ color: '#9aa1ad' }}>—</span> },
        ] as any} />}
    </Modal>
  </Card>
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
  const cols = [
    slCol,
    { title: 'Date', dataIndex: 'date', width: 120, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Student', dataIndex: 'candidateId', render: (v: string) => <b>{candName(candidates, v)}</b> },
    { title: 'Batch', width: 120, render: (_: any, r: any) => { const b = candidates.find((c: any) => c.id === r.candidateId)?.batch; return b ? <Tag color="geekblue">{b}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> } },
    { title: 'Company / Client', dataIndex: 'company', render: (v: string) => v || <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Status', dataIndex: 'status', width: 170, render: (v: string) => <Tag color={DEP_COLOR[v]}>{v}</Tag> },
    { title: 'Remarks', dataIndex: 'remark', render: (v: string) => v || <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: '', width: 90, render: (_: any, r: any) => <span style={{ display: 'inline-flex', gap: 4 }}><Button size="small" type="text" icon={<EditOutlined />} onClick={() => open(r)} /><Popconfirm title="Delete record?" okButtonProps={{ danger: true }} onConfirm={() => del(r.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm></span> },
  ]
  return <div>
    <DeploymentDashboard candidates={candidates} deployments={deployments} />
    <Card styles={{ body: { padding: 16 } }} style={{ marginTop: 16 }} title="Deployment records" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>Add record</Button>}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Tag.CheckableTag checked={!sf} onChange={() => setSf(null)}>All ({deployments.length})</Tag.CheckableTag>
        {DEP_STATUSES.map((s) => <Tag.CheckableTag key={s} checked={sf === s} onChange={() => setSf(sf === s ? null : s)}>{s} ({deployments.filter((d: any) => d.status === s).length})</Tag.CheckableTag>)}
      </div>
      <Table size="small" rowKey="id" columns={cols as any} dataSource={shown} pagination={{ pageSize: 15 }} locale={{ emptyText: <Empty description="No deployment records yet" /> }} />
    </Card>
    <Modal open={!!modal} title={modal?.id ? 'Edit record' : 'Add deployment record'} onCancel={() => setModal(null)} onOk={() => f.submit()} okText="Save">
      <Form form={f} layout="vertical" onFinish={submit} style={{ marginTop: 12 }}>
        <Form.Item name="candidateId" label="Student" rules={[{ required: true, message: 'Pick a student' }]}><Select showSearch optionFilterProp="label" placeholder="Student" options={candidates.map((c: any) => ({ value: c.id, label: c.name }))} /></Form.Item>
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
  const batches = [...new Set(candidates.map((c: any) => c.batch).filter(Boolean))].sort() as string[]
  const perCand = (cid: string) => deployments.filter((d: any) => d.candidateId === cid).length
  const rows = candidates.map((c: any) => ({ id: c.id, name: c.name, batch: c.batch || '—', interviews: perCand(c.id), latest: deployments.filter((d: any) => d.candidateId === c.id).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))[0]?.status || '—' }))
  const byBatch: Record<string, any[]> = {}; rows.forEach((r: any) => { (byBatch[r.batch] = byBatch[r.batch] || []).push(r) })
  const cols = [
    slCol,
    { title: 'Student', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Interviews given', dataIndex: 'interviews', width: 150, align: 'center' as const, render: (v: number) => <Tag color={v ? 'blue' : 'default'} style={{ fontWeight: 700 }}>{v}</Tag> },
    { title: 'Latest status', dataIndex: 'latest', width: 170, render: (v: string) => v === '—' ? <span style={{ color: '#9aa1ad' }}>—</span> : <Tag color={DEP_COLOR[v]}>{v}</Tag> },
  ]
  return <div>
    <div style={{ fontWeight: 700, marginBottom: 10 }}>Deployment pipeline</div>
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      {DEP_STATUSES.map((s) => (
        <Col xs={12} md={6} lg={3} key={s} style={{ flex: '1 1 130px' }}>
          <Card size="small" styles={{ body: { padding: '10px 12px' } }}>
            <div style={{ fontSize: 11, color: '#69707d', minHeight: 28 }}>{s}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: ({ blue: '#2563eb', gold: '#d4a017', orange: '#ea580c', green: '#16a34a', volcano: '#e8743b', red: '#dc2626', purple: '#7c3aed' } as any)[DEP_COLOR[s]] }}>{deployments.filter((d: any) => d.status === s).length}</div>
          </Card>
        </Col>
      ))}
    </Row>
    <div style={{ fontWeight: 700, marginBottom: 10 }}>Interviews given per student — batch-wise</div>
    {candidates.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Add students first" />
      : (batches.length === 0 ? <Card size="small" styles={{ body: { padding: 12 } }}><Table size="small" rowKey="id" columns={cols as any} dataSource={rows} pagination={false} /></Card>
        : batches.map((b: string) => (
          <Card key={b} size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: 12 } }}
            title={<span><Tag color="geekblue">{b}</Tag> <span style={{ color: '#9aa1ad', fontWeight: 400, fontSize: 12 }}>{byBatch[b].length} student{byBatch[b].length === 1 ? '' : 's'} · {byBatch[b].reduce((a: number, r: any) => a + r.interviews, 0)} interviews</span></span>}>
            <Table size="small" rowKey="id" columns={cols as any} dataSource={byBatch[b]} pagination={false} />
          </Card>
        )))}
  </div>
}

// ============================================================================
// Subject dashboard (overview)
// ============================================================================
function SubjectDashboard({ batches, candidates, attendance, ratings, deployments, syllabus }: any) {
  const attPct = (() => { if (!attendance.length) return null; return Math.round(100 * attendance.filter((a: any) => a.status === 'Present' || a.status === 'Late').length / attendance.length) })()
  const avgRating = (() => { const rs = ratings.filter((r: any) => r.score != null); return rs.length ? rs.reduce((a: number, b: any) => a + Number(b.score), 0) / rs.length : null })()
  const deployed = new Set(deployments.filter((d: any) => d.status === 'Deployed').map((d: any) => d.candidateId)).size
  return <div>
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      <Col xs={12} md={6}><Stat label="Students" value={candidates.length} color={PRIMARY} /></Col>
      <Col xs={12} md={6}><Stat label="Batches" value={batches.length} color="#2563eb" /></Col>
      <Col xs={12} md={6}><Stat label="Avg attendance" value={attPct == null ? '—' : attPct} suffix={attPct == null ? '' : '%'} color="#16a34a" /></Col>
      <Col xs={12} md={6}><Stat label="Avg rating" value={avgRating == null ? '—' : avgRating.toFixed(2)} suffix={avgRating == null ? '' : '/ 5'} color="#d97706" /></Col>
      <Col xs={12} md={6}><Stat label="Syllabus rows" value={syllabus.length} color="#0ea5e9" /></Col>
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
// Candidate login + self-service portal (TREE to update completion + trainer ratings)
// ============================================================================
function CandidateLogin({ db, onLogin }: any) {
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
        <div style={{ fontSize: 13, color: '#9aa1ad' }}>Update your syllabus progress and see your ratings.</div>
      </div>
      <div style={{ fontSize: 12, color: '#69707d', marginBottom: 4 }}>Email</div>
      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" onPressEnter={submit} style={{ marginBottom: 10 }} />
      <div style={{ fontSize: 12, color: '#69707d', marginBottom: 4 }}>PIN <span style={{ color: '#9aa1ad' }}>(only if your trainer set one)</span></div>
      <Input.Password value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" onPressEnter={submit} style={{ marginBottom: 14 }} />
      <Button type="primary" block onClick={submit}>Sign in</Button>
    </Card>
  </div>
}

function CandidatePortal({ db, mutate, candidate, onLogout }: any) {
  const project = db.projects.find((p: any) => p.id === candidate.projectId)
  const allSyl = db.syllabus.filter((s: any) => s.projectId === candidate.projectId)
  // a student sees ONLY their batch's subject. Use the batch's chosen subject; else infer from the batch
  // name (works for data where the student's batch is stored as plain text, e.g. "Typescript Batch 1").
  const batch = db.batches.find((b: any) => b.id === candidate.batchId)
  const batchName = batch?.name || candidate.batch || ''
  const allSubjects = [...new Set(allSyl.map((s: any) => s.subject))] as string[]
  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  let mySubject: string = batch?.subject || candidate.subject || ''
  if (!mySubject && batchName) { const bn = norm(batchName); mySubject = allSubjects.find((s) => bn.includes(norm(s))) || '' }
  // match on a normalised subject name (case/spacing tolerant). If nothing matches (mis-set subject),
  // fall back to the whole subject's syllabus so the student is never stuck with an empty tree.
  const myNorm = norm(mySubject)
  const filtered = mySubject ? allSyl.filter((s: any) => norm(s.subject) === myNorm) : allSyl
  const syllabus = filtered.length ? filtered : allSyl
  const visIds = new Set(syllabus.map((s: any) => s.id))
  const myRatings = db.ratings.filter((r: any) => r.candidateId === candidate.id && visIds.has(r.topicId))
  const statusOf = (nodeId: string, activity: string) => db.progress.find((p: any) => p.candidateId === candidate.id && p.topicId === nodeId && p.activity === activity)?.status || 'Not started'
  const setStatus = (nodeId: string, activity: string, status: string) => mutate((d: DB) => { const r: any = d.progress.find((p: any) => p.projectId === candidate.projectId && p.candidateId === candidate.id && p.topicId === nodeId && p.activity === activity); if (r) r.status = status; else d.progress.push({ id: uid(), projectId: candidate.projectId, candidateId: candidate.id, topicId: nodeId, activity, status }) })
  const ratingOf = (nodeId: string) => myRatings.find((r: any) => r.topicId === nodeId)
  const total = syllabus.length * ACTIVITIES.length
  const done = db.progress.filter((p: any) => p.candidateId === candidate.id && p.status === 'Completed' && visIds.has(p.topicId)).length
  const pct = total ? Math.round(100 * done / total) : 0
  const avg = avgRatingOf(myRatings, candidate.id)
  // build tree: subject → chapter → topic → [rows(sub-topic leaves)]
  const tree: any = {}
  syllabus.forEach((s: any) => { const subj = tree[s.subject] || (tree[s.subject] = {}); const ch = subj[s.chapter] || (subj[s.chapter] = {}); (ch[s.topic] = ch[s.topic] || []).push(s) })
  return <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Hi, {candidate.name} 👋</div>
        <div style={{ fontSize: 13, color: '#9aa1ad' }}>{mySubject || project?.name || 'Subject'}{candidate.batch ? ` · Batch ${candidate.batch}` : ''}</div>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        <Tooltip title={`${done}/${total || 0} activities completed`}><span style={{ width: 150 }}><Progress percent={pct} size="small" /></span></Tooltip>
        {avg != null && <Tag color={avg >= 4 ? 'green' : avg >= 3 ? 'orange' : 'red'}>Avg rating {avg.toFixed(2)} / 5</Tag>}
        <Button onClick={onLogout}>Sign out</Button>
      </span>
    </div>
    <Card size="small" title="My syllabus — update your progress" styles={{ body: { padding: 14 } }}>
      {syllabus.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No syllabus yet — your trainer will add it." />
        : <Collapse defaultActiveKey={Object.keys(tree)} items={Object.keys(tree).sort().map((subj) => ({
          key: subj,
          label: <b>{subj}</b>,
          children: Object.keys(tree[subj]).sort().map((ch) => (
            <div key={ch} style={{ marginBottom: 10 }}>
              {ch !== '—' && <div style={{ fontSize: 12, color: '#69707d', fontWeight: 700, marginBottom: 6 }}>{ch}</div>}
              {Object.keys(tree[subj][ch]).sort().map((topic) => (
                <div key={topic} style={{ marginLeft: ch !== '—' ? 12 : 0, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{topic}</div>
                  {tree[subj][ch][topic].map((s: any) => { const r = ratingOf(s.id); return (
                    <div key={s.id} style={{ border: '1px solid #eef0f3', borderRadius: 8, padding: '8px 10px', marginBottom: 6, marginLeft: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{leafLabel(s)}</span>
                        {r ? <Tag color={r.score >= 4 ? 'green' : r.score >= 3 ? 'orange' : 'red'}>Trainer: {r.score}/5</Tag> : <span style={{ fontSize: 11, color: '#c8ccd4' }}>Not rated</span>}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {ACTIVITIES.map((a) => <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11, color: '#69707d' }}>{a}</span>
                          <Select size="small" value={statusOf(s.id, a)} onChange={(v) => setStatus(s.id, a, v)} style={{ width: 120 }} options={ACT_STATUS.map((x) => ({ value: x, label: x }))} />
                        </span>)}
                      </div>
                      {r?.remark && <div style={{ fontSize: 11, color: '#69707d', marginTop: 6 }}>Trainer remark: {r.remark}</div>}
                    </div>
                  ) })}
                </div>
              ))}
            </div>
          )),
        }))} />}
    </Card>
  </div>
}
