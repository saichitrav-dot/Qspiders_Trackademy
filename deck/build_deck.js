const pptxgen = require('pptxgenjs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';            // 13.33 x 7.5
pres.author = 'Trackademy';
pres.title = 'Trackademy — Overview';

const W = 13.33, H = 7.5;
// QSpiders palette: orange-dominant (red-orange -> amber), teal accent, warm-dark text
const ORANGE = 'F2641E', ORANGE2 = 'F09819', TEAL = '00809D', INK = '2A2622',
      SLATE = '565A62', MUTED = '9AA0A6', LINE = 'E7E3DE', BG = 'F5F6F8',
      WHITE = 'FFFFFF', CREAM = 'FEF2E7', SOFTW = 'FFF1E8', PEACH = 'FFE0CC';
const HEAD = 'Trebuchet MS', BODY = 'Calibri';
const sh = () => ({ type: 'outer', color: 'B6A89C', blur: 9, offset: 3, angle: 90, opacity: 0.18 });

function card(s, x, y, w, h, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.09, fill: { color: opts.fill || WHITE }, line: { color: opts.line || LINE, width: 1 }, shadow: sh() });
}
function ctitle(s, title, kicker) {
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 0.62, w: 0.14, h: 0.56, fill: { color: ORANGE } });
  let ty = 0.6;
  if (kicker) { s.addText(kicker.toUpperCase(), { x: 0.86, y: 0.5, w: 11.5, h: 0.28, fontFace: HEAD, fontSize: 11, bold: true, color: ORANGE, charSpacing: 2, margin: 0 }); ty = 0.8; }
  s.addText(title, { x: 0.86, y: ty, w: 12.1, h: 0.7, fontFace: HEAD, fontSize: 26, bold: true, color: INK, margin: 0 });
}
function featureCard(s, x, y, w, h, num, header, body, fill) {
  card(s, x, y, w, h, { fill: fill || WHITE });
  s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.3, w: 0.46, h: 0.46, fill: { color: TEAL } });
  s.addText(String(num), { x: x + 0.3, y: y + 0.28, w: 0.46, h: 0.46, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 15, bold: true, color: WHITE, margin: 0 });
  s.addText(header, { x: x + 0.92, y: y + 0.3, w: w - 1.15, h: 0.5, fontFace: HEAD, fontSize: 14.5, bold: true, color: INK, margin: 0, valign: 'middle' });
  s.addText(body, { x: x + 0.32, y: y + 0.98, w: w - 0.62, h: h - 1.12, fontFace: BODY, fontSize: 12.5, color: SLATE, margin: 0, lineSpacingMultiple: 1.04, valign: 'top' });
}
function iconRow(s, x, y, w, header, body) {
  s.addShape(pres.shapes.OVAL, { x, y: y + 0.02, w: 0.42, h: 0.42, fill: { color: CREAM } });
  s.addShape(pres.shapes.OVAL, { x: x + 0.13, y: y + 0.15, w: 0.16, h: 0.16, fill: { color: ORANGE } });
  s.addText(header, { x: x + 0.6, y: y - 0.06, w: w - 0.6, h: 0.42, fontFace: HEAD, fontSize: 14.5, bold: true, color: INK, margin: 0, valign: 'middle' });
  s.addText(body, { x: x + 0.6, y: y + 0.4, w: w - 0.6, h: 0.85, fontFace: BODY, fontSize: 12, color: SLATE, margin: 0, lineSpacingMultiple: 1.03 });
}

/* ---------------- Slide 1 — Title (orange hero) ---------------- */
let s = pres.addSlide(); s.background = { color: ORANGE };
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.9, y: 0.9, w: 0.95, h: 0.95, rectRadius: 0.16, fill: { color: WHITE } });
s.addText('Q', { x: 0.9, y: 0.86, w: 0.95, h: 0.95, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 46, bold: true, color: ORANGE, margin: 0 });
s.addText('Trackademy', { x: 0.88, y: 2.45, w: 11.5, h: 1.15, fontFace: HEAD, fontSize: 58, bold: true, color: WHITE, margin: 0 });
s.addText('Content Production Tracking for Training Enterprises', { x: 0.92, y: 3.62, w: 11.5, h: 0.6, fontFace: HEAD, fontSize: 22, bold: true, color: INK, margin: 0 });
s.addText('Plan  ·  Assign  ·  Schedule  ·  Record  ·  Review  ·  Publish — in one place.', { x: 0.95, y: 4.38, w: 11, h: 0.5, fontFace: BODY, fontSize: 15, color: SOFTW, margin: 0 });
s.addText('QSpiders  ·  Bangalore', { x: 0.95, y: 6.55, w: 6, h: 0.4, fontFace: HEAD, fontSize: 12, bold: true, color: SOFTW, charSpacing: 2, margin: 0 });

/* ---------------- Slide 2 — Problem ---------------- */
s = pres.addSlide(); s.background = { color: BG };
ctitle(s, 'When production runs on spreadsheets and chat, it breaks', 'The problem');
s.addText('A training enterprise ships hundreds of subjects and thousands of recordings across many programs, trainers and studios. Tracked manually, the cracks show:', { x: 0.86, y: 1.68, w: 11.7, h: 0.6, fontFace: BODY, fontSize: 14.5, color: SLATE, margin: 0 });
const probs = [
  ['No live visibility', 'Status hides in spreadsheets and WhatsApp threads — leadership never sees the real picture.'],
  ['Hidden bottlenecks', 'Topics stall at a stage for weeks; nobody notices until a deadline is already slipping.'],
  ['Studio chaos', 'Double-bookings, no-shows and swaps — with no record of who defaulted or when.'],
  ['No accountability', 'Who owns this topic? What is stuck where? Impossible to answer in the moment.'],
];
const px = [0.86, 6.75], py = [2.55, 4.62], pw = 5.7, ph = 1.85;
probs.forEach((p, i) => featureCard(s, px[i % 2], py[i < 2 ? 0 : 1], pw, ph, i + 1, p[0], p[1]));

/* ---------------- Slide 3 — Solution ---------------- */
s = pres.addSlide(); s.background = { color: BG };
ctitle(s, 'Trackademy: one live source of truth', 'The solution');
s.addText([
  { text: 'Every piece of course content — tracked from idea to published, ', options: { bold: true, color: INK } },
  { text: 'across programs, trainers, studios and reviewers, with dashboards leadership can actually read.', options: { color: SLATE } },
], { x: 0.86, y: 1.75, w: 11.6, h: 0.9, fontFace: BODY, fontSize: 17, margin: 0, lineSpacingMultiple: 1.1 });
const steps = ['Plan', 'Assign', 'Schedule', 'Record', 'Review', 'Publish'];
const sw = 1.78, sgap = 0.27, sx0 = (W - (steps.length * sw + (steps.length - 1) * sgap)) / 2, sy = 3.05;
steps.forEach((st, i) => {
  const x = sx0 + i * (sw + sgap);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: sy, w: sw, h: 0.82, rectRadius: 0.1, fill: { color: i % 2 ? ORANGE2 : ORANGE } });
  s.addText(st, { x, y: sy, w: sw, h: 0.82, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 15, bold: true, color: WHITE, margin: 0 });
  if (i < steps.length - 1) s.addText('›', { x: x + sw - 0.04, y: sy, w: sgap + 0.08, h: 0.82, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 20, bold: true, color: MUTED, margin: 0 });
});
card(s, 0.86, 4.45, 11.61, 1.85, {});
s.addText('Organised the way your curriculum already is', { x: 1.2, y: 4.65, w: 10.9, h: 0.4, fontFace: HEAD, fontSize: 14, bold: true, color: INK, margin: 0 });
const tree = ['Program', 'Subject', 'Chapter', 'Topic', 'Sub-topic'];
const tw = 2.0, tgap = 0.22, tx0 = 1.2, tyy = 5.35;
tree.forEach((t, i) => {
  const x = tx0 + i * (tw + tgap);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: tyy, w: tw, h: 0.62, rectRadius: 0.09, fill: { color: CREAM }, line: { color: 'F3CFA8', width: 1 } });
  s.addText(t, { x, y: tyy, w: tw, h: 0.62, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 13, bold: true, color: 'B25B12', margin: 0 });
  if (i < tree.length - 1) s.addText('›', { x: x + tw - 0.02, y: tyy, w: tgap + 0.04, h: 0.62, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 16, bold: true, color: ORANGE, margin: 0 });
});

/* ---------------- Slide 4 — Pipeline ---------------- */
s = pres.addSlide(); s.background = { color: BG };
ctitle(s, 'How content flows — the 7-stage pipeline', 'The workflow');
s.addText('Every sub-topic moves through seven stages. Completion is weighted, and two review gates protect quality before anything is published.', { x: 0.86, y: 1.68, w: 11.7, h: 0.6, fontFace: BODY, fontSize: 14.5, color: SLATE, margin: 0 });
const stages = [['1', 'PPT', '20%', 0], ['2', 'Script', '20%', 0], ['3', 'Presentation', '15%', 0], ['4', 'Shooting', '25%', 0], ['5', 'Shooting Review', 'gate', 1], ['6', 'Editing', '10%', 0], ['7', 'Final Review', 'gate', 1]];
const bw = 1.62, bgap = 0.18, bx0 = (W - (7 * bw + 6 * bgap)) / 2, byy = 2.95, bh = 1.65;
stages.forEach((st, i) => {
  const x = bx0 + i * (bw + bgap);
  const gate = st[3] === 1;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: byy, w: bw, h: bh, rectRadius: 0.09, fill: { color: gate ? WHITE : ORANGE }, line: { color: gate ? TEAL : ORANGE, width: gate ? 1.5 : 1 } });
  s.addText(st[0], { x: x + 0.12, y: byy + 0.12, w: 0.4, h: 0.34, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 12, bold: true, color: gate ? TEAL : PEACH, margin: 0 });
  s.addText(st[1], { x: x + 0.1, y: byy + 0.55, w: bw - 0.2, h: 0.65, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 13, bold: true, color: gate ? INK : WHITE, margin: 0 });
  s.addText(st[2], { x: x + 0.1, y: byy + bh - 0.42, w: bw - 0.2, h: 0.34, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 12, bold: true, color: gate ? TEAL : SOFTW, margin: 0 });
  if (i < 6) s.addText('›', { x: x + bw - 0.03, y: byy, w: bgap + 0.06, h: bh, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 18, bold: true, color: MUTED, margin: 0 });
});
s.addText('Weighted % = a true picture of progress, not just "started / done."   ·   Gates (Shooting Review, Final Review) must pass before the next step.', { x: 0.86, y: 5.05, w: 11.7, h: 0.5, fontFace: BODY, fontSize: 12.5, italic: true, color: MUTED, margin: 0 });

/* ---------------- Slide 5 — Delivers today ---------------- */
s = pres.addSlide(); s.background = { color: BG };
ctitle(s, 'What it delivers today', 'Capabilities');
const feats = [
  ['Multi-program curriculum', 'Program → Sub-topic tree, plus bulk Excel import — append-safe and de-duped on the full path.'],
  ['Smart trainer assignment', 'Assign at any level; lower levels inherit. Delegate "who can assign" to trusted people.'],
  ['Studio scheduling', '4 studios · 2-hour slots · 08:30–20:30. Double-bookings are blocked automatically.'],
  ['Role-based access', 'Program Head sees everything; trainers see only their assigned work. Configurable per person.'],
  ['Reviews & quality', 'Two gates (shoot & final) with quality ratings and written reviewer feedback.'],
  ['Asset management', 'Equipment inventory — in-use, damaged, available — with a dated activity log.'],
];
const fcw = 3.84, fcgap = 0.3, fcx = [0.6, 0.6 + fcw + fcgap, 0.6 + 2 * (fcw + fcgap)], fcy = [2.0, 4.35], fch = 2.15;
feats.forEach((f, i) => featureCard(s, fcx[i % 3], fcy[i < 3 ? 0 : 1], fcw, fch, i + 1, f[0], f[1]));

/* ---------------- Slide 6 — Analytics ---------------- */
s = pres.addSlide(); s.background = { color: BG };
ctitle(s, 'Visibility leadership can actually read', 'Analytics');
const dash = [
  ['Command Center', 'Programs overview, live pipeline and headline KPIs at a glance.'],
  ['Management Dashboard', 'Production funnel + "where time is being lost" bottleneck analysis.'],
  ['Capacity vs benchmark', 'Are we resourced for the backlog? Studios & trainers vs the target pace.'],
  ['Quality & sentiment', 'Recording-quality mix and reviewer sentiment, summarised automatically.'],
  ['SLA early-warning', '2-day stage window — breaches and missed slots surface before they hurt.'],
];
dash.forEach((d, i) => {
  const y = 1.85 + i * 1.0;
  s.addShape(pres.shapes.OVAL, { x: 0.86, y: y + 0.04, w: 0.16, h: 0.16, fill: { color: TEAL } });
  s.addText([{ text: d[0] + '  ', options: { bold: true, color: INK } }, { text: '— ' + d[1], options: { color: SLATE } }], { x: 1.15, y: y - 0.1, w: 5.25, h: 0.9, fontFace: BODY, fontSize: 13.5, margin: 0, lineSpacingMultiple: 1.03, valign: 'top' });
});
card(s, 6.7, 1.75, 5.97, 4.7, {});
s.addText('Sample · completion by program (%)', { x: 6.95, y: 1.95, w: 5.5, h: 0.4, fontFace: HEAD, fontSize: 13, bold: true, color: INK, margin: 0 });
s.addChart(pres.charts.BAR, [{ name: 'Completion', labels: ['JAVA FS', 'Python FS', 'Test Auto', 'DevOps', 'Playwright', 'Data Eng'], values: [42, 64, 38, 27, 18, 12] }], {
  x: 6.85, y: 2.4, w: 5.7, h: 3.85, barDir: 'bar', chartColors: [ORANGE], chartArea: { fill: { color: WHITE } },
  catAxisLabelColor: '64748B', valAxisLabelColor: '64748B', catAxisLabelFontFace: BODY, valAxisLabelFontFace: BODY, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9,
  valGridLine: { color: 'EDF1F6', size: 0.5 }, catGridLine: { style: 'none' }, showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: INK, dataLabelFontFace: BODY, dataLabelFontSize: 10, showLegend: false, valAxisMaxVal: 80, valAxisMinVal: 0,
});

/* ---------------- Slide 7 — Enterprise ---------------- */
s = pres.addSlide(); s.background = { color: BG };
ctitle(s, 'Built for enterprise', 'Why it scales');
const ent = [
  ['Scales with you', 'Hundreds of programs and thousands of sub-topics, with no change to how you work.'],
  ['Secure by default', 'Cloud PostgreSQL with row-level security — least-privilege, role-based access.'],
  ['Configurable, no-code', 'Custom fields, menu access, delegation and curriculum-by-Excel — no developer needed.'],
  ['Guard-rails built in', 'No double-booking, SLA windows and a single source of truth keep data clean.'],
  ['Anywhere, instantly', 'Web-based and shareable — works in the office, on any device, updates live for everyone.'],
  ['Low cost to run', 'Managed cloud — no servers to maintain, predictable and economical to operate.'],
];
const ecx = [0.86, 6.95], ecy = [1.95, 3.55, 5.15];
ent.forEach((e, i) => iconRow(s, ecx[i % 2], ecy[Math.floor(i / 2)], 5.55, e[0], e[1]));

/* ---------------- Slide 8 — Technology ---------------- */
s = pres.addSlide(); s.background = { color: BG };
ctitle(s, 'The technology', 'Under the hood');
const tech = [
  ['Front end', ['React 18 + TypeScript', 'Vite build tooling', 'Ant Design component system', 'Recharts data visualisation']],
  ['Data & security', ['Supabase — managed PostgreSQL', 'Built-in authentication', 'Row-Level Security policies', 'Instant, secure APIs']],
  ['Delivery', ['Netlify global CDN', 'Shareable web URL', 'Zero install — runs in a browser', 'Continuous deployment']],
];
const tcw = 3.84, tcx = [0.6, 0.6 + tcw + 0.3, 0.6 + 2 * (tcw + 0.3)], tcy = 1.95, tch = 3.15;
tech.forEach((t, i) => {
  const x = tcx[i];
  card(s, x, tcy, tcw, tch, {});
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.3, y: tcy + 0.3, w: tcw - 0.6, h: 0.55, rectRadius: 0.07, fill: { color: ORANGE } });
  s.addText(t[0], { x: x + 0.3, y: tcy + 0.3, w: tcw - 0.6, h: 0.55, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 15, bold: true, color: WHITE, margin: 0 });
  s.addText(t[1].map((b) => ({ text: b, options: { bullet: { code: '2022', indent: 14 }, color: SLATE, breakLine: true, paraSpaceAfter: 6 } })), { x: x + 0.4, y: tcy + 1.05, w: tcw - 0.7, h: tch - 1.2, fontFace: BODY, fontSize: 12.5, color: SLATE, margin: 0 });
});
card(s, 0.6, 5.35, W - 1.2, 1.25, { fill: INK, line: INK });
s.addText('Why it matters', { x: 0.95, y: 5.55, w: 3, h: 0.4, fontFace: HEAD, fontSize: 14, bold: true, color: ORANGE2, margin: 0 });
s.addText('Modern & maintainable  ·  secure by default  ·  low running cost  ·  scales as your catalogue grows', { x: 0.95, y: 5.95, w: 11.5, h: 0.5, fontFace: BODY, fontSize: 14, color: WHITE, margin: 0 });

/* ---------------- Slide 9 — Roadmap ---------------- */
s = pres.addSlide(); s.background = { color: BG };
ctitle(s, 'Roadmap — where we take it next', "What's ahead");
s.addText('Each item below extends today\'s cloud foundation — an addition, not a rebuild.', { x: 0.86, y: 1.62, w: 11.7, h: 0.4, fontFace: BODY, fontSize: 13, italic: true, color: MUTED, margin: 0 });
const road = [
  ['Near-term', ['Notifications & reminders (email / WhatsApp) for SLAs, assignments and slot times', 'Mobile / PWA view for trainers on the studio floor', 'Exportable reports & weekly digests']],
  ['Mid-term', ['LMS & library integration (Moodle / Docebo / internal) — auto-publish finished content', 'AI assists: PPT → script drafts, auto captions & transcripts', 'Automated A/V quality checks on uploads']],
  ['Long-term', ['Forecasting & capacity planning; trainer productivity & cost analytics', 'Multi-center (multi-tenant), SSO and full audit log', 'Open API & webhooks; learner-feedback loop']],
];
const rcw = 3.84, rcx = [0.6, 0.6 + rcw + 0.3, 0.6 + 2 * (rcw + 0.3)], rcy = 2.15, rch = 4.45;
road.forEach((r, i) => {
  const x = rcx[i];
  card(s, x, rcy, rcw, rch, {});
  s.addShape(pres.shapes.RECTANGLE, { x: x, y: rcy + 0.4, w: 0.14, h: 0.4, fill: { color: ORANGE } });
  s.addText(r[0], { x: x + 0.3, y: rcy + 0.36, w: rcw - 0.5, h: 0.5, fontFace: HEAD, fontSize: 17, bold: true, color: INK, margin: 0, valign: 'middle' });
  s.addText(r[1].map((b) => ({ text: b, options: { bullet: { code: '2022', indent: 16 }, color: SLATE, breakLine: true, paraSpaceAfter: 10 } })), { x: x + 0.32, y: rcy + 1.1, w: rcw - 0.6, h: rch - 1.3, fontFace: BODY, fontSize: 12.5, color: SLATE, margin: 0, lineSpacingMultiple: 1.03 });
});

/* ---------------- Slide 10 — Closing (orange hero) ---------------- */
s = pres.addSlide(); s.background = { color: ORANGE };
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.92, y: 1.25, w: 0.7, h: 0.7, rectRadius: 0.12, fill: { color: WHITE } });
s.addText('Q', { x: 0.92, y: 1.22, w: 0.7, h: 0.7, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 32, bold: true, color: ORANGE, margin: 0 });
s.addText('From scattered spreadsheets to a single, live production engine.', { x: 0.92, y: 2.5, w: 11.4, h: 1.7, fontFace: HEAD, fontSize: 34, bold: true, color: WHITE, margin: 0, lineSpacingMultiple: 1.05 });
s.addText('Trackademy gives training enterprises real-time control of content production — built around how the work actually happens, from first slide to published video.', { x: 0.95, y: 4.45, w: 10.8, h: 0.9, fontFace: BODY, fontSize: 16, color: INK, margin: 0, lineSpacingMultiple: 1.05 });
s.addText('Trackademy  ·  QSpiders Bangalore', { x: 0.95, y: 6.4, w: 8, h: 0.4, fontFace: HEAD, fontSize: 13, bold: true, color: SOFTW, charSpacing: 1, margin: 0 });

pres.writeFile({ fileName: 'C:/Users/praks/Downloads/Trackademy_Overview.pptx' }).then(f => console.log('WROTE', f));
