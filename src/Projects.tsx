// ============================================================================
// Projects — SUPABASE-backed (shared across users & devices). Needs RecTrack_v41.
//   Organisation → Subject → Batch → Students.
//   Staff manage via pj_* tables (signed-in). Students sign in at /student with
//   email + optional PIN through SECURITY DEFINER functions and update their own
//   progress; they see only their batch's subject as a Subject→Chapter→Topic→
//   Sub-topic tree, plus the ratings their trainer gave (read-only).
// ============================================================================
import { useEffect, useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
  Card, Tabs, Table, Tag, Button, Input, Modal, Form, Select, DatePicker, Empty,
  Segmented, Popconfirm, Statistic, Row, Col, Progress, Upload, App as AntApp, Tooltip, Collapse, Spin,
} from 'antd'
import {
  AppstoreOutlined, PlusOutlined, TeamOutlined, CalendarOutlined, ReadOutlined, StarOutlined,
  RocketOutlined, DashboardOutlined, DeleteOutlined, EditOutlined, UploadOutlined, BankOutlined,
  ArrowLeftOutlined, DownloadOutlined, PartitionOutlined, ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { supabase } from './supabase'

const ACTIVITIES = ['Videos', 'Presentation', 'Assignment', 'Assessment', 'Mock Test']
const ACT_STATUS = ['Not started', 'In progress', 'Completed']
const DEP_STATUSES = ['Profiles shared', 'Interview in Progress', 'Waiting for results', 'Shortlisted', 'Not Shortlisted', 'Rejected', 'Deployed']
const DEP_COLOR: Record<string, string> = { 'Profiles shared': 'blue', 'Interview in Progress': 'gold', 'Waiting for results': 'orange', 'Shortlisted': 'green', 'Not Shortlisted': 'volcano', 'Rejected': 'red', 'Deployed': 'purple' }
const ATT_OPTS = ['Present', 'Absent', 'Late', 'Leave']
const PRIMARY = '#ff6a00'
const slCol = { title: 'Sl No', width: 64, render: (_: any, r: any, i: number) => <span style={{ color: '#9aa1ad' }}>{r._sl ?? i + 1}</span> }
const leafLabel = (s: any) => (s.subtopic && s.subtopic !== '—') ? s.subtopic : s.topic
const nodePath = (s: any) => [s.subject, s.chapter, s.topic, s.subtopic].filter((x: string) => x && x !== '—').join(' › ')
const candName = (candidates: any[], id: string) => candidates.find((c) => c.id === id)?.name || '—'
const avgRatingOf = (ratings: any[], candidateId: string) => { const rs = ratings.filter((r) => r.candidateId === candidateId && r.score != null); return rs.length ? rs.reduce((a: number, b: any) => a + Number(b.score), 0) / rs.length : null }
const MISSING = /relation .*pj_|does not exist|schema cache|function pj_/i
const needV41 = (e: any) => e && MISSING.test(e.message || '')

// ---------- data access (Supabase) ----------
type DB = { orgs: any[]; projects: any[]; batches: any[]; candidates: any[]; syllabus: any[]; ratings: any[]; attendance: any[]; deployments: any[]; progress: any[] }
async function loadAll(): Promise<{ db: DB; err: any }> {
  const q = (t: string) => supabase.from(t).select('*')
  const qSyl = () => supabase.from('pj_syllabus').select('*').order('ord', { ascending: true, nullsFirst: false }).order('id', { ascending: true })
  const [o, s, b, c, sy, r, a, d, p] = await Promise.all([q('pj_org'), q('pj_subject'), q('pj_batch'), q('pj_candidate'), qSyl(), q('pj_rating'), q('pj_attendance'), q('pj_deployment'), q('pj_progress')])
  const err = [o, s, b, c, sy, r, a, d, p].find((x) => x.error)?.error
  const batches = (b.data || []).map((x: any) => ({ id: x.id, projectId: x.subject_id, name: x.name, subject: x.covers || '' }))
  const bn = (id: string) => batches.find((x: any) => x.id === id)?.name || ''
  return {
    err,
    db: {
      orgs: o.data || [],
      projects: (s.data || []).map((x: any) => ({ id: x.id, orgId: x.org_id, name: x.name, desc: x.descr || '' })),
      batches,
      candidates: (c.data || []).map((x: any) => ({ id: x.id, projectId: x.subject_id, batchId: x.batch_id, name: x.name, email: x.email, contact: x.contact, pin: x.pin, batch: bn(x.batch_id) })),
      syllabus: (sy.data || []).map((x: any) => ({ id: x.id, projectId: x.subject_id, subject: x.subject, chapter: x.chapter, topic: x.topic, subtopic: x.subtopic })),
      ratings: (r.data || []).map((x: any) => ({ id: x.id, projectId: x.subject_id, candidateId: x.candidate_id, topicId: x.node_id, score: x.score, remark: x.remark, date: x.rated_on })),
      attendance: (a.data || []).map((x: any) => ({ id: x.id, projectId: x.subject_id, candidateId: x.candidate_id, date: x.att_date, status: x.status })),
      deployments: (d.data || []).map((x: any) => ({ id: x.id, projectId: x.subject_id, candidateId: x.candidate_id, company: x.company, status: x.status, remark: x.remark, date: x.dep_date })),
      progress: (p.data || []).map((x: any) => ({ id: x.id, projectId: x.subject_id, candidateId: x.candidate_id, topicId: x.node_id, activity: x.activity, status: x.status })),
    },
  }
}
// write helpers — each returns the supabase error (or null)
const ins = async (t: string, row: any) => (await supabase.from(t).insert(row)).error
const insMany = async (t: string, rows: any[]) => (await supabase.from(t).insert(rows)).error
const upd = async (t: string, id: string, patch: any) => (await supabase.from(t).update(patch).eq('id', id)).error
const del = async (t: string, id: string) => (await supabase.from(t).delete().eq('id', id)).error

export default function Projects() {
  const { message: msg } = AntApp.useApp()
  const [db, setDb] = useState<DB | null>(null)
  const [missing, setMissing] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const reload = useCallback(async () => { const { db, err } = await loadAll(); if (err && needV41(err)) { setMissing(true); setDb({ orgs: [], projects: [], batches: [], candidates: [], syllabus: [], ratings: [], attendance: [], deployments: [], progress: [] }); return } setMissing(false); setDb(db) }, [])
  useEffect(() => { reload() }, [reload])
  const run = useCallback(async (fn: () => Promise<any>, okMsg?: string) => { const e = await fn(); if (e) { msg.error(needV41(e) ? 'Run RecTrack_v41_projects.sql in Supabase first.' : e.message); return false } await reload(); if (okMsg) msg.success(okMsg); return true }, [reload, msg])
  if (!db) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  if (missing) return <Card><Empty description={<span>Run <b>RecTrack_v41_projects.sql</b> in Supabase to enable the shared Projects feature (tables + student login).</span>} /></Card>
  const project = db.projects.find((p) => p.id === sel)
  if (project) return <SubjectWorkspace db={db} run={run} reload={reload} project={project} org={db.orgs.find((o) => o.id === project.orgId)} onBack={() => setSel(null)} />
  return <OrgHome db={db} run={run} onOpen={setSel} />
}

// ============================================================================
// Organisations + Subjects landing
// ============================================================================
function OrgHome({ db, run, onOpen }: any) {
  const [orgModal, setOrgModal] = useState(false)
  const [projModal, setProjModal] = useState<any>(null)
  const [of] = Form.useForm(); const [pf] = Form.useForm()
  const addOrg = async (v: any) => { if (await run(() => ins('pj_org', { name: v.name.trim() }), 'Organisation added')) { setOrgModal(false); of.resetFields() } }
  const addProject = async (v: any) => { if (await run(() => ins('pj_subject', { org_id: projModal.orgId, name: v.name.trim(), descr: v.desc || null }), 'Subject created')) { setProjModal(null); pf.resetFields() } }
  const projCount = (orgId: string) => db.projects.filter((p: any) => p.orgId === orgId).length
  const candCount = (projId: string) => db.candidates.filter((c: any) => c.projectId === projId).length
  const batchCount = (projId: string) => db.batches.filter((b: any) => b.projectId === projId).length
  return <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}><AppstoreOutlined style={{ color: PRIMARY, marginRight: 8 }} />Projects</div>
        <div style={{ fontSize: 13, color: '#9aa1ad' }}>Organisations → Subjects → Batches → Students. Shared across users; students sign in at <b>/student</b>.</div>
      </div>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setOrgModal(true)}>Add organisation</Button>
    </div>
    {db.orgs.length === 0 ? <Card><Empty description="No organisations yet — add one to get started." /></Card>
      : db.orgs.map((o: any) => (
        <Card key={o.id} style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}
          title={<span><BankOutlined style={{ color: PRIMARY, marginRight: 8 }} /><b>{o.name}</b> <Tag style={{ marginLeft: 8 }}>{projCount(o.id)} subject{projCount(o.id) === 1 ? '' : 's'}</Tag></span>}
          extra={<span style={{ display: 'inline-flex', gap: 8 }}>
            <Button size="small" icon={<PlusOutlined />} onClick={() => setProjModal({ orgId: o.id })}>Add subject</Button>
            <Popconfirm title="Delete this organisation and its subjects?" okButtonProps={{ danger: true }} onConfirm={() => run(() => del('pj_org', o.id))}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
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
                      <Popconfirm title="Delete subject?" okButtonProps={{ danger: true }} onConfirm={() => run(() => del('pj_subject', p.id))}><Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} /></Popconfirm>
                    </div>
                    <Button type="link" size="small" style={{ paddingLeft: 0, marginTop: 6 }}>Open →</Button>
                  </Card>
                </Col>
              ))}
            </Row>}
        </Card>
      ))}
    <Modal open={orgModal} title="Add organisation" onCancel={() => setOrgModal(false)} onOk={() => of.submit()} okText="Add">
      <Form form={of} layout="vertical" onFinish={addOrg} style={{ marginTop: 12 }}><Form.Item name="name" label="Organisation name" rules={[{ required: true, message: 'Enter a name' }]}><Input placeholder="e.g. QSpiders Hyderabad" /></Form.Item></Form>
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
// Subject workspace
// ============================================================================
function SubjectWorkspace({ db, run, reload, project, org, onBack }: any) {
  const pid = project.id
  const ctx = {
    db, run, pid,
    batches: db.batches.filter((b: any) => b.projectId === pid),
    candidates: db.candidates.filter((c: any) => c.projectId === pid),
    syllabus: db.syllabus.filter((s: any) => s.projectId === pid),
    ratings: db.ratings.filter((r: any) => r.projectId === pid),
    attendance: db.attendance.filter((a: any) => a.projectId === pid),
    deployments: db.deployments.filter((d: any) => d.projectId === pid),
    progress: db.progress.filter((p: any) => p.projectId === pid),
  }
  return <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      <Button icon={<ArrowLeftOutlined />} onClick={onBack}>All subjects</Button>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{project.name}</div>
        <div style={{ fontSize: 12, color: '#9aa1ad' }}>{org?.name || 'Organisation'}{project.desc ? ` · ${project.desc}` : ''}</div>
      </div>
      <Button icon={<ReloadOutlined />} onClick={reload}>Refresh</Button>
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

function Stat({ label, value, color, suffix }: any) {
  return <Card size="small" styles={{ body: { padding: '12px 16px' } }}><Statistic title={<span style={{ fontSize: 12 }}>{label}</span>} value={value} suffix={suffix} valueStyle={{ color: color || '#161a22', fontWeight: 800, fontSize: 22 }} /></Card>
}

// ============================================================================
// Batches & Students
// ============================================================================
function BatchesTab({ run, pid, batches, candidates, syllabus }: any) {
  const { message: msg } = AntApp.useApp()
  const [batchModal, setBatchModal] = useState<any>(null)
  const [stuModal, setStuModal] = useState<any>(null)
  const [bf] = Form.useForm(); const [sf] = Form.useForm()
  const sylSubjects = [...new Set(syllabus.map((s: any) => s.subject))].sort() as string[]
  const openBatch = (b?: any) => { setBatchModal(b || true); setTimeout(() => bf.setFieldsValue(b ? { name: b.name, subject: b.subject || undefined } : {}), 0) }
  const saveBatch = async (v: any) => {
    const row = { name: v.name.trim(), covers: v.subject || null }
    const ok = batchModal?.id ? await run(() => upd('pj_batch', batchModal.id, row), 'Saved') : await run(() => ins('pj_batch', { subject_id: pid, ...row }), 'Batch added')
    if (ok) { setBatchModal(null); bf.resetFields() }
  }
  const openStudent = (batch: any, c?: any) => { setStuModal(c ? { ...c } : { batchId: batch.id, batchName: batch.name }); setTimeout(() => sf.setFieldsValue(c || {}), 0) }
  const saveStudent = async (v: any) => {
    const row = { name: v.name.trim(), email: v.email || null, contact: v.contact || null, pin: v.pin || null }
    const ok = stuModal?.id ? await run(() => upd('pj_candidate', stuModal.id, row), 'Saved') : await run(() => ins('pj_candidate', { subject_id: pid, batch_id: stuModal.batchId, ...row }), 'Student added')
    if (ok) { setStuModal(null); sf.resetFields() }
  }
  const bulkAdd = (batch: any, file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' })
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        const add = rows.map((r) => ({ subject_id: pid, batch_id: batch.id, name: String(r.Name || r.name || '').trim(), email: String(r.Email || r.email || r['Email ID'] || '').trim() || null, contact: String(r.Contact || r.contact || r['Contact number'] || r.Phone || '').trim() || null, pin: String(r.PIN || r.pin || '').trim() || null })).filter((r) => r.name)
        if (!add.length) { msg.warning('No rows with a Name column found.'); return }
        await run(() => insMany('pj_candidate', add), `${add.length} student(s) added to ${batch.name}`)
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
    { title: '', width: 80, render: (_: any, c: any) => <span style={{ display: 'inline-flex', gap: 2 }}><Button size="small" type="text" icon={<EditOutlined />} onClick={() => openStudent(batch, c)} /><Popconfirm title="Delete student?" okButtonProps={{ danger: true }} onConfirm={() => run(() => del('pj_candidate', c.id))}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm></span> },
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
            <Popconfirm title={`Delete batch “${batch.name}” and its students?`} okButtonProps={{ danger: true }} onConfirm={() => run(() => del('pj_batch', batch.id))}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
          </span>,
          children: students.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No students yet — add manually or import Excel (Name, Email, Contact, PIN)." />
            : <Table size="small" rowKey="id" columns={stuCols(batch) as any} dataSource={students} pagination={{ pageSize: 15 }} />,
        }
      })} />}
    <Modal open={!!batchModal} title={batchModal?.id ? 'Edit batch' : 'Add batch'} onCancel={() => setBatchModal(null)} onOk={() => bf.submit()} okText="Save">
      <Form form={bf} layout="vertical" onFinish={saveBatch} style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Batch name" rules={[{ required: true, message: 'Enter a batch name' }]}><Input placeholder="e.g. Oct-26 Batch A" /></Form.Item>
        <Form.Item name="subject" label="Subject this batch covers" tooltip="Students see only this subject's syllabus at login.">
          {sylSubjects.length ? <Select allowClear showSearch placeholder="Pick a subject from the syllabus" options={sylSubjects.map((s) => ({ value: s, label: s }))} /> : <Input placeholder="Type the subject name (upload syllabus first to pick)" />}
        </Form.Item>
      </Form>
    </Modal>
    <Modal open={!!stuModal} title={stuModal?.id ? 'Edit student' : `Add student${stuModal?.batchName ? ` · ${stuModal.batchName}` : ''}`} onCancel={() => setStuModal(null)} onOk={() => sf.submit()} okText="Save">
      <Form form={sf} layout="vertical" onFinish={saveStudent} style={{ marginTop: 12 }}>
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
function AttendanceTab({ run, pid, batches, candidates, attendance }: any) {
  const { message: msg } = AntApp.useApp()
  const [date, setDate] = useState<any>(dayjs())
  const [bf, setBf] = useState<string | null>(null)
  const dstr = date.format('YYYY-MM-DD')
  const recOf = (cid: string) => attendance.find((a: any) => a.candidateId === cid && a.date === dstr)
  const setStatus = async (cid: string, status: string) => { const rec = recOf(cid); await run(() => rec ? upd('pj_attendance', rec.id, { status }) : ins('pj_attendance', { subject_id: pid, candidate_id: cid, att_date: dstr, status })) }
  const markAll = async (status: string) => { for (const c of shown) { const rec = recOf(c.id); await (rec ? upd('pj_attendance', rec.id, { status }) : ins('pj_attendance', { subject_id: pid, candidate_id: c.id, att_date: dstr, status })) } await run(async () => null, `All marked ${status}`); msg.destroy() }
  const pct = (cid: string) => { const recs = attendance.filter((a: any) => a.candidateId === cid); if (!recs.length) return null; return Math.round(100 * recs.filter((r: any) => r.status === 'Present' || r.status === 'Late').length / recs.length) }
  const shown = candidates.filter((c: any) => !bf || c.batchId === bf)
  const cols = [
    slCol,
    { title: 'Student', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'Batch', dataIndex: 'batch', width: 130, render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: `Status · ${date.format('DD MMM YYYY')}`, width: 320, render: (_: any, c: any) => <Segmented size="small" value={recOf(c.id)?.status || ''} onChange={(v) => setStatus(c.id, v as string)} options={ATT_OPTS.map((o) => ({ value: o, label: o }))} /> },
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
// Syllabus
// ============================================================================
function SyllabusTab({ run, pid, syllabus }: any) {
  const { message: msg } = AntApp.useApp()
  const [f] = Form.useForm()
  const add = async (v: any) => { if (await run(() => ins('pj_syllabus', { subject_id: pid, subject: (v.subject || '').trim() || 'General', chapter: (v.chapter || '').trim() || '—', topic: (v.topic || '').trim(), subtopic: (v.subtopic || '').trim() || '—' }), 'Row added')) f.resetFields() }
  const onFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' })
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        const add = rows.map((r) => ({ subject_id: pid, subject: String(r.Subject || r.subject || 'General').trim(), chapter: String(r.Chapter || r.chapter || '—').trim() || '—', topic: String(r.Topic || r.topic || '').trim(), subtopic: String(r['Sub topic'] || r['Sub-topic'] || r.Subtopic || r.subtopic || '—').trim() || '—' })).filter((r) => r.topic || (r.subtopic && r.subtopic !== '—'))
        if (!add.length) { msg.warning('Nothing to import. Columns: Subject, Chapter, Topic, Sub topic.'); return }
        await run(() => insMany('pj_syllabus', add), `${add.length} row(s) uploaded`)
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
  const delSubject = async (subj: string) => { for (const s of rowsOfSubject(subj)) await del('pj_syllabus', s.id); await run(async () => null, `Removed ${subj}`) }
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
      <div style={{ fontSize: 11, color: '#9aa1ad', marginTop: 8 }}>Template columns — <b>Subject</b>, <b>Chapter</b>, <b>Topic</b>, <b>Sub topic</b>.</div>
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
// Ratings
// ============================================================================
function RatingsTab({ run, pid, candidates, syllabus, ratings }: any) {
  const { message: msg } = AntApp.useApp()
  const [cid, setCid] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, { score?: number; remark?: string }>>({})
  const existing = (candidateId: string, nodeId: string) => ratings.find((r: any) => r.candidateId === candidateId && r.topicId === nodeId)
  const save = async () => {
    if (!cid) return
    const entries = Object.entries(draft).filter(([, v]) => v.score != null)
    if (!entries.length) { msg.warning('Set at least one score.'); return }
    for (const [nodeId, v] of entries) {
      const ex = existing(cid, nodeId)
      if (ex) await upd('pj_rating', ex.id, { score: v.score, remark: v.remark ?? ex.remark, rated_on: dayjs().format('YYYY-MM-DD') })
      else await ins('pj_rating', { subject_id: pid, candidate_id: cid, node_id: nodeId, score: v.score, remark: v.remark || null, rated_on: dayjs().format('YYYY-MM-DD') })
    }
    setDraft({}); await run(async () => null, 'Ratings saved')
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
// Candidate progress (trainer view)
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
    <div style={{ fontSize: 12, color: '#9aa1ad', marginBottom: 10 }}>Completion = activities students update. Avg rating = what the trainer gave (also shown to the student).</div>
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
// Deployment
// ============================================================================
function DeploymentTab({ run, pid, candidates, deployments }: any) {
  const [modal, setModal] = useState<any>(null)
  const [f] = Form.useForm()
  const [sf, setSf] = useState<string | null>(null)
  const open = (rec?: any) => { setModal(rec || {}); setTimeout(() => f.setFieldsValue(rec ? { ...rec, date: rec.date ? dayjs(rec.date) : dayjs() } : { status: 'Profiles shared', date: dayjs() }), 0) }
  const submit = async (v: any) => {
    const row = { candidate_id: v.candidateId, company: v.company || null, status: v.status, remark: v.remark || null, dep_date: (v.date || dayjs()).format('YYYY-MM-DD') }
    const ok = modal?.id ? await run(() => upd('pj_deployment', modal.id, row), 'Saved') : await run(() => ins('pj_deployment', { subject_id: pid, ...row }), 'Saved')
    if (ok) { setModal(null); f.resetFields() }
  }
  const shown = deployments.filter((d: any) => !sf || d.status === sf)
  const cols = [
    slCol,
    { title: 'Date', dataIndex: 'date', width: 120, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Student', dataIndex: 'candidateId', render: (v: string) => <b>{candName(candidates, v)}</b> },
    { title: 'Batch', width: 120, render: (_: any, r: any) => { const b = candidates.find((c: any) => c.id === r.candidateId)?.batch; return b ? <Tag color="geekblue">{b}</Tag> : <span style={{ color: '#9aa1ad' }}>—</span> } },
    { title: 'Company / Client', dataIndex: 'company', render: (v: string) => v || <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: 'Status', dataIndex: 'status', width: 170, render: (v: string) => <Tag color={DEP_COLOR[v]}>{v}</Tag> },
    { title: 'Remarks', dataIndex: 'remark', render: (v: string) => v || <span style={{ color: '#9aa1ad' }}>—</span> },
    { title: '', width: 90, render: (_: any, r: any) => <span style={{ display: 'inline-flex', gap: 4 }}><Button size="small" type="text" icon={<EditOutlined />} onClick={() => open(r)} /><Popconfirm title="Delete record?" okButtonProps={{ danger: true }} onConfirm={() => run(() => del('pj_deployment', r.id))}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm></span> },
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
// Candidate portal (SUPABASE RPCs) — /student
// ============================================================================
export function CandidateApp() {
  const [sess, setSess] = useState<any>(null) // { id, email, pin }
  const inner = sess ? <CandidatePortal sess={sess} onLogout={() => setSess(null)} /> : <CandidateLogin onLogin={setSess} />
  return <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#eef2fb 0%, #f6f8fc 260px, #f6f8fc 100%)' }}>
    <div style={{ background: '#12141d', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: PRIMARY, display: 'grid', placeItems: 'center', fontWeight: 800 }}>Q</div>
      <div style={{ fontWeight: 700 }}>Trackademy — Candidate</div>
    </div>
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>{inner}</div>
  </div>
}

function CandidateLogin({ onLogin }: any) {
  const { message: msg } = AntApp.useApp()
  const [email, setEmail] = useState(''); const [pin, setPin] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async () => {
    const e = email.trim().toLowerCase()
    if (!e) { msg.warning('Enter your email'); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('pj_candidate_login', { p_email: e, p_pin: pin.trim() })
    setBusy(false)
    if (error) { msg.error(needV41(error) ? 'Not set up yet — ask your trainer to run RecTrack_v41.' : error.message); return }
    if (!data?.ok) { msg.error(data?.error === 'deployed' ? '🎉 You have been deployed — this access is now closed. All the best!' : 'No account found with that email / PIN. Ask your trainer.'); return }
    onLogin({ id: data.id, email: e, pin: pin.trim() })
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
      <Button type="primary" block loading={busy} onClick={submit}>Sign in</Button>
    </Card>
  </div>
}

function CandidatePortal({ sess, onLogout }: any) {
  const { message: msg } = AntApp.useApp()
  const [boot, setBoot] = useState<any>(null)
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('pj_candidate_bootstrap', { p_cid: sess.id, p_email: sess.email, p_pin: sess.pin })
    if (error) { msg.error(error.message); return }
    if (!data?.ok) { msg.error('Session expired — please sign in again.'); onLogout(); return }
    setBoot(data)
  }, [sess, msg, onLogout])
  useEffect(() => { load() }, [load])
  if (!boot) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  const candidate = boot.candidate
  const allSyl = (boot.syllabus || []).map((s: any) => ({ id: s.id, subject: s.subject, chapter: s.chapter, topic: s.topic, subtopic: s.subtopic }))
  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  const allSubjects = [...new Set(allSyl.map((s: any) => s.subject))] as string[]
  let mySubject: string = boot.covers || ''
  if (!mySubject && boot.batchName) { const bn = norm(boot.batchName); mySubject = allSubjects.find((s) => bn.includes(norm(s))) || '' }
  const myNorm = norm(mySubject)
  const filtered = mySubject ? allSyl.filter((s: any) => norm(s.subject) === myNorm) : allSyl
  const syllabus = filtered.length ? filtered : allSyl
  const myRatings = (boot.ratings || []).map((r: any) => ({ topicId: r.node_id, score: r.score, remark: r.remark }))
  const prog: Record<string, string> = {}; (boot.progress || []).forEach((p: any) => { prog[p.node_id + '|' + p.activity] = p.status })
  const statusOf = (nodeId: string, activity: string) => prog[nodeId + '|' + activity] || 'Not started'
  const ratingOf = (nodeId: string) => myRatings.find((r: any) => r.topicId === nodeId)
  const setStatus = async (nodeId: string, activity: string, status: string) => {
    const { data, error } = await supabase.rpc('pj_set_progress', { p_cid: sess.id, p_email: sess.email, p_pin: sess.pin, p_node: nodeId, p_activity: activity, p_status: status })
    if (error || !data?.ok) { msg.error('Could not save — ' + (error?.message || 'try again')); return }
    load()
  }
  const total = syllabus.length * ACTIVITIES.length
  const done = Object.entries(prog).filter(([k, v]) => v === 'Completed' && syllabus.some((s: any) => k.startsWith(s.id + '|'))).length
  const pct = total ? Math.round(100 * done / total) : 0
  const rs = myRatings.filter((r: any) => r.score != null)
  const avg = rs.length ? rs.reduce((a: number, b: any) => a + Number(b.score), 0) / rs.length : null
  // Build the tree preserving the uploaded sheet's exact order (first-seen),
  // never alphabetical: Subject → Chapter → Topic → Sub-topic leaves.
  const pick = (arr: any[], key: string, make: () => any) => { let n = arr.find((x) => x._k === key); if (!n) { n = make(); n._k = key; arr.push(n) } return n }
  const tree: any[] = []
  syllabus.forEach((s: any) => {
    const subj = pick(tree, s.subject, () => ({ subject: s.subject, chapters: [] }))
    const ch = pick(subj.chapters, s.chapter, () => ({ chapter: s.chapter, topics: [] }))
    const tp = pick(ch.topics, s.topic, () => ({ topic: s.topic, leaves: [] }))
    tp.leaves.push(s)
  })
  return <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Hi, {candidate.name} 👋</div>
        <div style={{ fontSize: 13, color: '#9aa1ad' }}>{mySubject || boot.subjectName || 'Subject'}{boot.batchName ? ` · Batch ${boot.batchName}` : ''}</div>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        <Tooltip title={`${done}/${total || 0} activities completed`}><span style={{ width: 150 }}><Progress percent={pct} size="small" /></span></Tooltip>
        {avg != null && <Tag color={avg >= 4 ? 'green' : avg >= 3 ? 'orange' : 'red'}>Avg rating {avg.toFixed(2)} / 5</Tag>}
        <Button onClick={onLogout}>Sign out</Button>
      </span>
    </div>
    <Card size="small" title="My syllabus — update your progress" styles={{ body: { padding: 14 } }}>
      {syllabus.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No syllabus yet — your trainer will add it." />
        : <Collapse defaultActiveKey={tree.map((t: any) => t.subject)} items={tree.map((node: any) => ({
          key: node.subject, label: <b>{node.subject}</b>,
          children: node.chapters.map((chNode: any, ci: number) => (
            <div key={ci} style={{ marginBottom: 10 }}>
              {chNode.chapter !== '—' && <div style={{ fontSize: 12, color: '#69707d', fontWeight: 700, marginBottom: 6 }}>{chNode.chapter}</div>}
              {chNode.topics.map((tpNode: any, ti: number) => (
                <div key={ti} style={{ marginLeft: chNode.chapter !== '—' ? 12 : 0, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{tpNode.topic}</div>
                  {tpNode.leaves.map((s: any) => { const r = ratingOf(s.id); return (
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
