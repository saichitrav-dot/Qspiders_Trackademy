// ============================================================================
// Projects — SUPABASE-backed (shared across users & devices). Needs RecTrack_v41.
//   Organisation → Subject → Batch → Students.
//   Staff manage via pj_* tables (signed-in). Students sign in at /student with
//   email + optional PIN through SECURITY DEFINER functions and update their own
//   progress; they see only their batch's subject as a Subject→Chapter→Topic→
//   Sub-topic tree, plus the ratings their trainer gave (read-only).
// ============================================================================
import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react'
import * as XLSX from 'xlsx'
import {
  Card, Tabs, Table, Tag, Button, Input, Modal, Form, Select, DatePicker, Empty,
  Segmented, Popconfirm, Statistic, Row, Col, Progress, Upload, App as AntApp, Tooltip, Collapse, Spin, Tree,
} from 'antd'
import {
  AppstoreOutlined, PlusOutlined, TeamOutlined, CalendarOutlined, ReadOutlined, StarOutlined,
  RocketOutlined, DashboardOutlined, DeleteOutlined, EditOutlined, UploadOutlined, BankOutlined,
  ArrowLeftOutlined, DownloadOutlined, PartitionOutlined, ReloadOutlined, SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { supabase } from './supabase'

const ACTIVITIES = ['Presentation', 'Assignment', 'Assessment', 'Mock Test']
// Trainer/mentor rates these activities per sub-topic (Videos is student self-progress only).
const RATING_ACTIVITIES = ['Presentation', 'Assignment', 'Assessment', 'Mock Test']
const SCORES = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
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
// Build the Subject → Chapter → Topic → Sub-topic tree, preserving uploaded sheet order.
function buildTree(rows: any[]) {
  const pick = (arr: any[], key: string, make: () => any) => { let n = arr.find((x) => x._k === key); if (!n) { n = make(); n._k = key; arr.push(n) } return n }
  const tree: any[] = []
  rows.forEach((s) => {
    const subj = pick(tree, s.subject, () => ({ subject: s.subject, chapters: [] }))
    const ch = pick(subj.chapters, s.chapter, () => ({ chapter: s.chapter, topics: [] }))
    const tp = pick(ch.topics, s.topic, () => ({ topic: s.topic, leaves: [] }))
    tp.leaves.push(s)
  })
  return tree
}
// Rows whose topic/sub-topic text matches a search query (case-insensitive).
const matchRows = (rows: any[], q: string) => { const ql = q.trim().toLowerCase(); return ql ? rows.filter((s) => (`${s.topic || ''} ${s.subtopic || ''}`).toLowerCase().includes(ql)) : rows }
// AntD Tree data for a built tree: Subject → Chapter → Topic → selectable Sub-topic leaves.
// A topic with no real sub-topics becomes the selectable leaf itself. Returns the branch
// keys (to expand on search) and subject keys (to expand by default) alongside the data.
function buildTreeData(tree: any[]) {
  const branchKeys: string[] = []; const subjectKeys: string[] = []
  const treeData = tree.map((subj: any, si: number) => {
    const sKey = 'S' + si; subjectKeys.push(sKey); branchKeys.push(sKey)
    const kids = subj.chapters.flatMap((ch: any, ci: number) => {
      const topicNodes = ch.topics.map((tp: any, tpi: number) => {
        const realLeaves = tp.leaves.filter((l: any) => l.subtopic && l.subtopic !== '—')
        if (realLeaves.length === 0) return { key: tp.leaves[0].id, title: tp.topic, isLeaf: true }
        const tKey = `T${si}_${ci}_${tpi}`; branchKeys.push(tKey)
        return { key: tKey, title: tp.topic, selectable: false, children: tp.leaves.map((l: any) => ({ key: l.id, title: leafLabel(l), isLeaf: true })) }
      })
      if (ch.chapter === '—') return topicNodes
      const cKey = `C${si}_${ci}`; branchKeys.push(cKey)
      return [{ key: cKey, title: ch.chapter, selectable: false, children: topicNodes }]
    })
    return { key: sKey, title: subj.subject, selectable: false, children: kids }
  })
  return { treeData, branchKeys, subjectKeys }
}
const MISSING = /relation .*pj_|does not exist|schema cache|function pj_/i
const needV41 = (e: any) => e && MISSING.test(e.message || '')

// ---------- data access (Supabase) ----------
type DB = { orgs: any[]; projects: any[]; batches: any[]; candidates: any[]; syllabus: any[]; ratings: any[]; attendance: any[]; deployments: any[]; progress: any[] }
// Page past PostgREST's 1000-row cap, so large courses/ratings all load.
async function pageAll(table: string, orders: { col: string; opts?: any }[]): Promise<{ data: any[]; error: any }> {
  const PAGE = 1000; let from = 0; const out: any[] = []
  for (;;) {
    let q = supabase.from(table).select('*')
    orders.forEach((o) => { q = q.order(o.col, o.opts) })
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) return { data: out, error }
    out.push(...(data || []))
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return { data: out, error: null }
}
async function loadAll(): Promise<{ db: DB; err: any }> {
  const byId = [{ col: 'id' }]
  const [o, s, b, c, sy, r, a, d, p] = await Promise.all([
    pageAll('pj_org', byId), pageAll('pj_subject', byId), pageAll('pj_batch', byId), pageAll('pj_candidate', byId),
    pageAll('pj_syllabus', [{ col: 'ord', opts: { ascending: true, nullsFirst: false } }, { col: 'id', opts: { ascending: true } }]),
    pageAll('pj_rating', byId), pageAll('pj_attendance', byId), pageAll('pj_deployment', byId), pageAll('pj_progress', byId),
  ])
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
      ratings: (r.data || []).map((x: any) => ({ id: x.id, projectId: x.subject_id, candidateId: x.candidate_id, topicId: x.node_id, activity: x.activity || '', score: x.score, remark: x.remark, date: x.rated_on })),
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
// Subject performance — which Subject's candidates are doing best (by rating)
// ============================================================================
function SubjectPerformanceDashboard({ db, onOpen }: any) {
  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  const rows = db.projects.map((p: any) => {
    const cands = db.candidates.filter((c: any) => c.projectId === p.id)
    const candAvgs = cands.map((c: any) => avgRatingOf(db.ratings, c.id)).filter((a: any) => a != null) as number[]
    const avg = candAvgs.length ? candAvgs.reduce((a, b) => a + b, 0) / candAvgs.length : null
    const org = db.orgs.find((o: any) => o.id === p.orgId)?.name || ''
    const sylRows = db.syllabus.filter((s: any) => s.projectId === p.id)
    // Completion per candidate, against THEIR batch's covered subject (as the student sees it).
    let possible = 0, done = 0
    cands.forEach((c: any) => {
      const covers = db.batches.find((b: any) => b.id === c.batchId)?.subject || ''
      let candSyl = covers ? sylRows.filter((s: any) => norm(s.subject) === norm(covers)) : sylRows
      if (!candSyl.length) candSyl = sylRows
      possible += candSyl.length * ACTIVITIES.length
      const ids = new Set(candSyl.map((s: any) => s.id))
      done += db.progress.filter((pr: any) => pr.candidateId === c.id && pr.status === 'Completed' && ACTIVITIES.includes(pr.activity) && ids.has(pr.topicId)).length
    })
    const comp = possible ? Math.round(100 * done / possible) : 0
    return { id: p.id, name: p.name, org, nCand: cands.length, nRated: candAvgs.length, avg, comp }
  }).filter((r: any) => r.nCand > 0)
  if (!rows.length) return null
  const ranked = [...rows].sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1))
  const rated = ranked.filter((r: any) => r.avg != null)
  const totalCand = rows.reduce((a: number, b: any) => a + b.nCand, 0)
  const barColor = (a: number) => a >= 4 ? '#16a34a' : a >= 3 ? '#d97706' : '#dc2626'
  const tagColor = (a: number) => a >= 4 ? 'green' : a >= 3 ? 'orange' : 'red'
  return <Card style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}
    title={<span><DashboardOutlined style={{ color: PRIMARY, marginRight: 8 }} />Subject performance</span>}
    extra={<span style={{ fontSize: 12, color: '#9aa1ad' }}>Ranked by candidates' average rating</span>}>
    {rated.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No ratings yet — rate candidates to compare subjects." />
      : <>
        <Row gutter={12} style={{ marginBottom: 14 }}>
          <Col xs={24} md={10}>
            <div style={{ background: 'linear-gradient(135deg,#fff7ed,#ffedd5)', border: '1px solid #fed7aa', borderRadius: 10, padding: 14, height: '100%' }}>
              <div style={{ fontSize: 11, color: '#9a6b3f', fontWeight: 800, letterSpacing: 0.4 }}>🏆 TOP PERFORMING SUBJECT</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{rated[0].name}</div>
              <div style={{ fontSize: 12, color: '#9aa1ad' }}>{rated[0].org} · {rated[0].nCand} candidate{rated[0].nCand === 1 ? '' : 's'}</div>
              <Tag color={tagColor(rated[0].avg)} style={{ marginTop: 8 }}>Avg {rated[0].avg.toFixed(2)} / 5</Tag>
            </div>
          </Col>
          <Col xs={12} md={7}><Stat label="Subjects rated" value={rated.length} color="#0ea5e9" /></Col>
          <Col xs={12} md={7}><Stat label="Candidates" value={totalCand} color="#7c3aed" /></Col>
        </Row>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranked.map((r: any, i: number) => (
            <div key={r.id} onClick={() => onOpen?.(r.id)} title="Open subject" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', border: '1px solid #eef0f3', borderRadius: 8, cursor: 'pointer' }}>
              <span style={{ width: 22, textAlign: 'center', fontWeight: 800, color: i === 0 ? PRIMARY : '#9aa1ad' }}>{i + 1}</span>
              <div style={{ width: 150, flexShrink: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#9aa1ad', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.org}</div>
              </div>
              <Tag icon={<TeamOutlined />} color="geekblue" style={{ flexShrink: 0, margin: 0 }}>{r.nCand} candidate{r.nCand === 1 ? '' : 's'}</Tag>
              <div style={{ flex: 1, minWidth: 80 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: '#9aa1ad', width: 52, flexShrink: 0 }}>Rating</span>
                  {r.avg != null
                    ? <Progress percent={Math.round(r.avg / 5 * 100)} strokeColor={barColor(r.avg)} format={() => `${r.avg.toFixed(2)}/5`} />
                    : <span style={{ fontSize: 12, color: '#c8ccd4' }}>Not rated yet</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: '#9aa1ad', width: 52, flexShrink: 0 }}>Completion</span>
                  <Progress percent={r.comp} strokeColor="#0ea5e9" format={(v?: number) => `${v}% done`} />
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#69707d', width: 90, textAlign: 'right', flexShrink: 0 }}>{r.nRated}/{r.nCand} rated</span>
            </div>
          ))}
        </div>
      </>}
  </Card>
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
    <SubjectPerformanceDashboard db={db} onOpen={onOpen} />
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
      { key: 'syl', label: <span><ReadOutlined /> Course</span>, children: <SyllabusTab {...ctx} /> },
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
        <Form.Item name="subject" label="Subject this batch covers" tooltip="Students see only this subject's course at login.">
          {sylSubjects.length ? <Select allowClear showSearch placeholder="Pick a subject from the course" options={sylSubjects.map((s) => ({ value: s, label: s }))} /> : <Input placeholder="Type the subject name (upload course first to pick)" />}
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
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
        if (!rows.length) { msg.warning('That sheet looks empty. Columns: Subject, Chapter, Topic, Sub topic.'); return }
        // Match columns regardless of case / spaces / punctuation, so "Sub Topic",
        // "Sub-topic", "SubTopic", "Module", etc. all work.
        const nk = (k: any) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '')
        const pick = (r: any, keys: string[]) => { const m: Record<string, any> = {}; Object.keys(r).forEach((k) => { m[nk(k)] = r[k] }); for (const key of keys) { const v = m[key]; if (v != null && String(v).trim()) return String(v).trim() } return '' }
        const add = rows.map((r) => ({
          subject_id: pid,
          subject: pick(r, ['subject', 'subjectname', 'technology', 'course', 'coursename']) || 'General',
          chapter: pick(r, ['chapter', 'module', 'unit', 'section']) || '—',
          topic: pick(r, ['topic', 'topicname', 'title']),
          subtopic: pick(r, ['subtopic', 'subtopics', 'subtopicname']) || '—',
        })).filter((r) => r.topic || (r.subtopic && r.subtopic !== '—'))
        if (!add.length) {
          const headers = Object.keys(rows[0] || {}).join(', ')
          msg.warning(`No Topic/Sub topic column found. Columns I saw: ${headers || '(none)'}. Expected Subject, Chapter, Topic, Sub topic.`)
          return
        }
        await run(() => insMany('pj_syllabus', add), `${add.length} row(s) uploaded`)
      } catch (err: any) { msg.error('Could not read the file — ' + (err?.message || 'make sure it is an .xlsx/.csv with Subject, Chapter, Topic, Sub topic columns.')) }
    }
    reader.onerror = () => msg.error('Could not read that file. Please try again.')
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
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Course'); XLSX.writeFile(wb, 'course-template.xlsx')
  }
  const subjects = [...new Set(syllabus.map((s: any) => s.subject))].sort() as string[]
  const rowsOfSubject = (subj: string) => syllabus.filter((s: any) => s.subject === subj)
  const downloadSubject = (subj: string) => {
    const ws = XLSX.utils.json_to_sheet(rowsOfSubject(subj).map((s: any) => ({ Subject: s.subject, Chapter: s.chapter === '—' ? '' : s.chapter, Topic: s.topic, 'Sub topic': s.subtopic === '—' ? '' : s.subtopic })))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Course'); XLSX.writeFile(wb, `course-${subj.replace(/[^a-z0-9]+/gi, '-')}.xlsx`)
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
        <Form.Item><Upload accept=".xlsx,.xls,.csv" showUploadList={false} beforeUpload={onFile as any}><Button icon={<UploadOutlined />}>Upload course (Excel)</Button></Upload></Form.Item>
        <Form.Item><Button icon={<DownloadOutlined />} onClick={downloadTemplate}>Download template</Button></Form.Item>
      </Form>
      <div style={{ fontSize: 11, color: '#9aa1ad', marginTop: 8 }}>Template columns — <b>Subject</b>, <b>Chapter</b>, <b>Topic</b>, <b>Sub topic</b>.</div>
    </div>
    {subjects.length === 0 ? <Empty description="No course yet — upload an Excel with Subject, Chapter, Topic, Sub topic columns." />
      : <Row gutter={[12, 12]}>
        {subjects.map((subj) => (
          <Col xs={24} sm={12} lg={8} key={subj}>
            <Card size="small" styles={{ body: { padding: 14 } }} style={{ border: '1px solid #eef0f3', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                <div><div style={{ fontWeight: 700, fontSize: 15 }}><ReadOutlined style={{ color: PRIMARY, marginRight: 6 }} />{subj}</div>
                  <div style={{ fontSize: 12, color: '#9aa1ad', marginTop: 2 }}>{rowsOfSubject(subj).length} row{rowsOfSubject(subj).length === 1 ? '' : 's'}</div></div>
                <Popconfirm title={`Remove “${subj}” course?`} okButtonProps={{ danger: true }} onConfirm={() => delSubject(subj)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
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
// One sub-topic's 4 activity rows. Memoised with its own local state so typing
// or changing a score re-renders ONLY this leaf (not the whole tree), and edits
// are written to a parent ref (no parent re-render per keystroke).
const LeafRater = memo(function LeafRater({ leaf, exMap, pending, scoreOpts, onEdit }: any) {
  const seed = () => {
    const o: Record<string, { score: number; remark: string }> = {}
    RATING_ACTIVITIES.forEach((act) => {
      const k = leaf.id + '|' + act; const p = pending.current[k]; const ex = exMap[k]
      o[act] = { score: (p && 'score' in p) ? p.score : (ex?.score ?? 0), remark: (p && 'remark' in p) ? p.remark : (ex?.remark ?? '') }
    })
    return o
  }
  const [vals, setVals] = useState(seed)
  const set = (act: string, patch: any) => { setVals((v) => ({ ...v, [act]: { ...v[act], ...patch } })); onEdit(leaf.id + '|' + act, patch) }
  return (
    <div style={{ border: '1px solid #eef0f3', borderRadius: 8, padding: '8px 10px', marginBottom: 6, marginLeft: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{leafLabel(leaf)}</div>
      {RATING_ACTIVITIES.map((act) => (
        <div key={act} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#69707d', width: 92, flexShrink: 0 }}>{act}</span>
          <Select size="small" value={vals[act].score} onChange={(v) => set(act, { score: v })} style={{ width: 78, flexShrink: 0 }} options={scoreOpts} />
          <Input size="small" placeholder="Remark" value={vals[act].remark} onChange={(e) => set(act, { remark: e.target.value })} style={{ flex: 1 }} />
        </div>
      ))}
    </div>
  )
})

function RatingsTab({ run, pid, candidates, syllabus, ratings }: any) {
  const { message: msg } = AntApp.useApp()
  const [cid, setCid] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<any[]>([])
  // pending edits live in a ref (keyed `${nodeId}|${activity}`) so editing never re-renders the parent
  const pending = useRef<Record<string, { score?: number; remark?: string }>>({})
  // O(1) lookup of the picked student's existing ratings (avoids scanning the array per control)
  const exMap = useMemo(() => {
    const m: Record<string, any> = {}
    ;(ratings as any[]).forEach((r) => { if (r.candidateId === cid) m[r.topicId + '|' + (r.activity || '')] = r })
    return m
  }, [ratings, cid])
  const onEdit = useCallback((key: string, patch: any) => { pending.current[key] = { ...pending.current[key], ...patch } }, [])
  const scoreOpts = useMemo(() => SCORES.map((n) => ({ value: n, label: n === 0 ? '—' : `${n}` })), [])
  // Same Subject → Chapter → Topic → Sub-topic tree as the student portal.
  const { treeData, branchKeys, subjectKeys, shownCount } = useMemo(() => {
    const shown = matchRows(syllabus, query)
    return { ...buildTreeData(buildTree(shown)), shownCount: shown.length }
  }, [syllabus, query])
  const branchRef = useRef<string[]>([]); branchRef.current = branchKeys
  const subjRef = useRef<string[]>([]); subjRef.current = subjectKeys
  useEffect(() => { setExpanded(query.trim() ? branchRef.current : subjRef.current) }, [query])
  const pickStudent = (id: string | null) => { setCid(id); pending.current = {}; setQuery(''); setSelId(null) } // reset edits so one student's remarks never bleed into another
  const save = async () => {
    if (!cid) return
    const today = dayjs().format('YYYY-MM-DD')
    const ops = Object.entries(pending.current).map(([k, v]) => {
      const [nodeId, act] = k.split('|')
      const ex = exMap[k]
      const score = ('score' in v ? v.score : ex?.score) ?? 0
      const remark = (('remark' in v ? v.remark : ex?.remark) || '').trim() || null
      return { nodeId, act, ex, score, remark }
    }).filter((o) => o.ex || o.score || o.remark)
    if (!ops.length) { msg.warning('Set a score or remark first.'); return }
    // Writes run in parallel (one round-trip), through `run` so a real DB error
    // is surfaced (incl. the "run the migration" hint) and success only on save.
    const ok = await run(async () => {
      const errs = await Promise.all(ops.map((o) => o.ex
        ? upd('pj_rating', o.ex.id, { score: o.score, remark: o.remark, rated_on: today })
        : ins('pj_rating', { subject_id: pid, candidate_id: cid, node_id: o.nodeId, activity: o.act, score: o.score, remark: o.remark, rated_on: today })))
      return errs.find((e) => e) || null
    }, 'Ratings saved')
    if (ok) pending.current = {}
  }
  const ratedNodes = (id: string) => new Set(ratings.filter((r: any) => r.candidateId === id && r.score != null).map((r: any) => r.topicId)).size
  const summaryCols = [
    slCol,
    { title: 'Student', dataIndex: 'name', render: (v: string, c: any) => { const a = avgRatingOf(ratings, c.id); return <span><b>{v}</b>{a != null && <Tag color={a >= 4 ? 'green' : a >= 3 ? 'orange' : 'red'} style={{ marginLeft: 6 }}>{a.toFixed(1)}</Tag>}</span> } },
    { title: 'Rated', width: 72, render: (_: any, c: any) => <span style={{ fontSize: 12, color: '#69707d' }}>{ratedNodes(c.id)}/{syllabus.length}</span> },
    { title: '', width: 70, render: (_: any, c: any) => <Button size="small" type={cid === c.id ? 'primary' : 'default'} onClick={() => pickStudent(c.id)}>Rate</Button> },
  ]
  const sel = selId ? syllabus.find((s: any) => s.id === selId) : null
  return <Row gutter={16}>
    <Col xs={24} lg={7}>
      <Card size="small" title="Students" styles={{ body: { padding: 8 } }}>
        <Table size="small" rowKey="id" columns={summaryCols as any} dataSource={candidates} pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty description="Add students first" /> }} />
      </Card>
    </Col>
    <Col xs={24} lg={17}>
      <Card size="small" styles={{ body: { padding: 12 } }}
        title={<span>Rate by sub-topic{cid ? <> — <b>{candName(candidates, cid)}</b></> : ''}</span>}
        extra={<Select showSearch optionFilterProp="label" placeholder="Pick student" value={cid} onChange={pickStudent} style={{ minWidth: 190 }} options={candidates.map((c: any) => ({ value: c.id, label: c.name }))} />}>
        {!cid ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pick a student to rate" />
          : syllabus.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Add course first" />
            : <>
              <Row gutter={12}>
                <Col xs={24} md={10}>
                  <Input allowClear size="small" prefix={<SearchOutlined style={{ color: '#9aa1ad' }} />} placeholder="Search topic / sub-topic" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 8 }} />
                  {shownCount === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span>No match for “{query}”.</span>} />
                    : <Tree treeData={treeData} height={420} blockNode showLine
                        expandedKeys={expanded} onExpand={(k) => setExpanded(k)}
                        selectedKeys={selId ? [selId] : []}
                        onSelect={(keys) => { if (keys[0] != null) setSelId(String(keys[0])) }} />}
                </Col>
                <Col xs={24} md={14}>
                  {sel ? <>
                      <div style={{ fontSize: 12, color: '#9aa1ad', marginBottom: 8 }}>{nodePath(sel)}</div>
                      <LeafRater key={(cid || '') + '|' + sel.id} leaf={sel} exMap={exMap} pending={pending} scoreOpts={scoreOpts} onEdit={onEdit} />
                    </> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pick a sub-topic on the left to rate" />}
                </Col>
              </Row>
              <div style={{ fontSize: 11, color: '#9aa1ad', margin: '6px 0' }}>Rate sub-topics across the tree, then Save once.</div>
              <Button type="primary" block onClick={save}>Save ratings</Button>
            </>}
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
  const doneOf = (cid: string) => progress.filter((p: any) => p.candidateId === cid && p.status === 'Completed' && ACTIVITIES.includes(p.activity)).length
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
    <Table size="small" rowKey="id" columns={cols as any} dataSource={candidates} pagination={{ pageSize: 15 }} locale={{ emptyText: <Empty description="Add students & course first" /> }} />
    <Modal open={!!open} title={<span>Ratings · {candName(candidates, open || '')}</span>} footer={null} width={640} onCancel={() => setOpen(null)}>
      {ratingList.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No ratings given yet" />
        : <Table size="small" rowKey="id" pagination={false} dataSource={ratingList} columns={[
          { title: 'Topic', dataIndex: 'path' },
          { title: 'Activity', dataIndex: 'activity', width: 120, render: (v: string) => <Tag>{v || 'Overall'}</Tag> },
          { title: 'Score', dataIndex: 'score', width: 90, render: (v: number) => <Tag color={v >= 4 ? 'green' : v >= 3 ? 'orange' : 'red'}>{v} / 5</Tag> },
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
      <Col xs={12} md={6}><Stat label="Course rows" value={syllabus.length} color="#0ea5e9" /></Col>
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
        <div style={{ fontSize: 13, color: '#9aa1ad' }}>Update your course progress and see your ratings.</div>
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
  const [query, setQuery] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<any[]>([])
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('pj_candidate_bootstrap', { p_cid: sess.id, p_email: sess.email, p_pin: sess.pin })
    if (error) { msg.error(error.message); return }
    if (!data?.ok) { msg.error('Session expired — please sign in again.'); onLogout(); return }
    setBoot(data)
  }, [sess, msg, onLogout])
  useEffect(() => { load() }, [load])

  // Derive everything from `boot` once (stable identity until a reload) so the
  // tree and lookups don't rebuild on unrelated re-renders.
  const d = useMemo(() => {
    if (!boot) return null
    const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
    const allSyl = (boot.syllabus || []).map((s: any) => ({ id: s.id, subject: s.subject, chapter: s.chapter, topic: s.topic, subtopic: s.subtopic }))
    const allSubjects = [...new Set(allSyl.map((s: any) => s.subject))] as string[]
    let mySubject: string = boot.covers || ''
    if (!mySubject && boot.batchName) { const bn = norm(boot.batchName); mySubject = allSubjects.find((s) => bn.includes(norm(s))) || '' }
    const myNorm = norm(mySubject)
    const sylFiltered = mySubject ? allSyl.filter((s: any) => norm(s.subject) === myNorm) : allSyl
    const syllabus = sylFiltered.length ? sylFiltered : allSyl
    const myRatings = (boot.ratings || []).map((r: any) => ({ topicId: r.node_id, activity: r.activity || '', score: r.score, remark: r.remark }))
    const prog: Record<string, string> = {}; (boot.progress || []).forEach((p: any) => { prog[p.node_id + '|' + p.activity] = p.status })
    return { candidate: boot.candidate, subjectName: boot.subjectName, batchName: boot.batchName, mySubject, syllabus, myRatings, prog }
  }, [boot])

  // Build the AntD Tree data (Subject → Chapter → Topic → Sub-topic) in sheet order.
  const { treeData, branchKeys, subjectKeys, shownCount } = useMemo(() => {
    if (!d) return { treeData: [] as any[], branchKeys: [] as string[], subjectKeys: [] as string[], shownCount: 0 }
    const shown = matchRows(d.syllabus, query)
    return { ...buildTreeData(buildTree(shown)), shownCount: shown.length }
  }, [d, query])

  // When searching, open every branch so matches show; otherwise open subjects.
  // Keyed on `query` only, so updating progress (which reloads) never collapses the tree.
  const branchRef = useRef<string[]>([]); branchRef.current = branchKeys
  const subjRef = useRef<string[]>([]); subjRef.current = subjectKeys
  useEffect(() => { setExpanded(query.trim() ? branchRef.current : subjRef.current) }, [query])

  if (!boot || !d) return <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Spin /></div>
  const { candidate, syllabus, myRatings, prog, mySubject } = d
  const statusOf = (nodeId: string, activity: string) => prog[nodeId + '|' + activity] || 'Not started'
  const scoreFor = (nodeId: string, activity: string) => { const r = myRatings.find((x: any) => x.topicId === nodeId && (x.activity || '') === activity && x.score != null); return r ? r.score : null }
  const remarkFor = (nodeId: string, activity: string) => { const r = myRatings.find((x: any) => x.topicId === nodeId && (x.activity || '') === activity && x.remark); return r ? r.remark : null }
  const ratingsFor = (nodeId: string) => myRatings.filter((x: any) => x.topicId === nodeId && x.score != null)
  const setStatus = async (nodeId: string, activity: string, status: string) => {
    const { data, error } = await supabase.rpc('pj_set_progress', { p_cid: sess.id, p_email: sess.email, p_pin: sess.pin, p_node: nodeId, p_activity: activity, p_status: status })
    if (error || !data?.ok) { msg.error('Could not save — ' + (error?.message || 'try again')); return }
    load()
  }
  const total = syllabus.length * ACTIVITIES.length
  const done = Object.entries(prog).filter(([k, v]) => v === 'Completed' && ACTIVITIES.includes(k.split('|')[1]) && syllabus.some((s: any) => k.startsWith(s.id + '|'))).length
  const pct = total ? Math.round(100 * done / total) : 0
  const rs = myRatings.filter((r: any) => r.score != null)
  const avg = rs.length ? rs.reduce((a: number, b: any) => a + Number(b.score), 0) / rs.length : null
  const sel = selId ? syllabus.find((s: any) => s.id === selId) : null
  const selRatings = sel ? ratingsFor(sel.id) : []
  const selAvg = selRatings.length ? selRatings.reduce((a: number, b: any) => a + Number(b.score), 0) / selRatings.length : null

  return <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Hi, {candidate.name} 👋</div>
        <div style={{ fontSize: 13, color: '#9aa1ad' }}>{mySubject || d.subjectName || 'Subject'}{d.batchName ? ` · Batch ${d.batchName}` : ''}</div>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        <Tooltip title={`${done}/${total || 0} activities completed`}><span style={{ width: 150 }}><Progress percent={pct} size="small" /></span></Tooltip>
        {avg != null && <Tag color={avg >= 4 ? 'green' : avg >= 3 ? 'orange' : 'red'}>Avg rating {avg.toFixed(2)} / 5</Tag>}
        <Button onClick={onLogout}>Sign out</Button>
      </span>
    </div>
    <Row gutter={16}>
      <Col xs={24} md={9}>
        <Card size="small" title="Course"
          extra={syllabus.length ? <Input allowClear size="small" prefix={<SearchOutlined style={{ color: '#9aa1ad' }} />} placeholder="Search topic / sub-topic" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 170 }} /> : null}
          styles={{ body: { padding: 8 } }}>
          {syllabus.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No course yet — your trainer will add it." />
            : shownCount === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span>No match for “{query}”.</span>} />
            : <Tree treeData={treeData} height={460} blockNode showLine
                expandedKeys={expanded} onExpand={(k) => setExpanded(k)}
                selectedKeys={selId ? [selId] : []}
                onSelect={(keys) => { if (keys[0] != null) setSelId(String(keys[0])) }} />}
        </Card>
      </Col>
      <Col xs={24} md={15}>
        <Card size="small" title={<span>Learning Activities{sel && selAvg != null && <Tag color={selAvg >= 4 ? 'green' : selAvg >= 3 ? 'orange' : 'red'} style={{ marginLeft: 8 }}>Trainer avg {selAvg.toFixed(1)}/5</Tag>}</span>}
          styles={{ body: { padding: 14 } }}>
          {!sel ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pick a sub-topic on the left to update its activities" />
            : <div>
                <div style={{ fontSize: 12, color: '#9aa1ad', marginBottom: 12 }}>{nodePath(sel)}</div>
                {ACTIVITIES.map((a) => { const ts = scoreFor(sel.id, a); const rk = remarkFor(sel.id, a); return (
                  <div key={a} style={{ borderBottom: '1px solid #f3f4f6', padding: '10px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, width: 110, flexShrink: 0 }}>{a}</span>
                      <Select size="small" value={statusOf(sel.id, a)} onChange={(v) => setStatus(sel.id, a, v)} style={{ width: 150 }} options={ACT_STATUS.map((x) => ({ value: x, label: x }))} />
                      {ts != null ? <Tag color={ts >= 4 ? 'green' : ts >= 3 ? 'orange' : 'red'}>Trainer ★{ts}/5</Tag> : <span style={{ fontSize: 11, color: '#c8ccd4' }}>Not rated</span>}
                    </div>
                    {rk && <div style={{ fontSize: 12, color: '#69707d', marginTop: 6, marginLeft: 120 }}>Trainer remark: {rk}</div>}
                  </div>
                ) })}
              </div>}
        </Card>
      </Col>
    </Row>
  </div>
}
