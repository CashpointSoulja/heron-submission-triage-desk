import { SUBMISSIONS, FUNDER } from './scenario.js';
import { runPipeline, resolveEvidence, DOC_TYPES, DOC_LABELS, CONFIDENCE_THRESHOLD, POLICY } from './engine.js';
import { GOLDEN, GOLDEN_SUBMISSIONS } from './golden.js';
import { runEvals } from './evals.js';

const STORE = 'triage-desk-v1';
const UNDERWRITER = 'J. Reyes (underwriter)';
const ENGINE = 'Scrub engine';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n, d = 0) => (n === null || n === undefined ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (x) => `${Math.round(x * 1000) / 10}%`;
const byId = Object.fromEntries(SUBMISSIONS.map((s) => [s.id, s]));
const docById = (sub, id) => sub.docs.find((d) => d.id === id);
const timeStr = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dateTime = (t) => new Date(t).toISOString().replace('T', ' ').slice(0, 19) + 'Z';

// ---------- state ----------
const loaded = (() => { try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; } })();
const state = loaded && loaded.v === 1 ? loaded : freshState();
function freshState() {
  const now = Date.now();
  const s = { v: 1, bootAt: now, subs: {}, audit: [] };
  for (const sub of SUBMISSIONS) {
    const receivedAt = now - sub.receivedMinsAgo * 60000;
    s.subs[sub.id] = { receivedAt, overrides: {}, reviews: {}, decision: null, openedAt: null };
    const r = runPipeline(sub);
    let t = receivedAt;
    const log = (actor, type, detail, ms = 400) => { t += ms; s.audit.push({ at: t, sub: sub.id, actor, type, detail }); };
    log('Intake', 'received', `Email from ${sub.broker.email}: "${sub.subject}" with ${sub.docs.length} attachments`, 0);
    for (const c of r.classification) log(ENGINE, 'classified', `${c.filename} → ${DOC_LABELS[c.label]} (confidence ${c.confidence.toFixed(2)}${c.label === 'unknown' && c.guess ? `, best guess ${DOC_LABELS[c.guess]}` : ''})`, 300);
    for (const f of Object.values(r.fields)) log(ENGINE, 'extracted', `${f.label} = ${fmtField(f)} (${f.evidence.length} source line${f.evidence.length === 1 ? '' : 's'})`, 120);
    for (const c of r.checks) log(ENGINE, c.status === 'flag' ? 'flag raised' : 'check run', `${c.name}: ${c.status.toUpperCase()} · ${c.detail}`, 150);
    for (const p of r.policy) log(ENGINE, 'policy evaluated', `${p.name}: ${p.status.toUpperCase()} · ${p.reason}`, 80);
  }
  s.audit.sort((a, b) => a.at - b.at);
  return s;
}
const save = () => localStorage.setItem(STORE, JSON.stringify(state));
function audit(sub, type, detail, actor = UNDERWRITER) { state.audit.push({ at: Date.now(), sub, actor, type, detail }); save(); }
const pipe = {};
function result(id) { const st = state.subs[id]; const key = JSON.stringify(st.overrides); if (!pipe[id] || pipe[id].key !== key) pipe[id] = { key, r: runPipeline(byId[id], st.overrides) }; return pipe[id].r; }

function fmtField(f) {
  if (f.value === null || f.value === undefined) return 'not found';
  if (/revenue|balance|Requested/i.test(f.label)) return money(f.value, 2);
  return String(f.value);
}
function subStatus(id) {
  const st = state.subs[id]; const r = result(id);
  if (st.decision) return { key: 'done', label: 'Decision-ready' };
  const open = r.flags.filter((f) => !st.reviews[f.id]).length;
  if (st.openedAt) return { key: 'review', label: open ? `In review · ${open} open` : 'Ready to package' };
  return { key: 'new', label: 'New' };
}
function sla(id) {
  const st = state.subs[id];
  const end = st.decision ? st.decision.at : Date.now();
  const left = FUNDER.slaMinutes - (end - st.receivedAt) / 60000;
  const h = Math.floor(Math.abs(left) / 60), m = Math.floor(Math.abs(left) % 60);
  const txt = `${h ? h + 'h ' : ''}${m}m`;
  if (st.decision) return { cls: '', text: `Decided in ${Math.round((st.decision.at - st.receivedAt) / 60000)}m` };
  if (left < 0) return { cls: 'late', text: `SLA breached ${txt} ago` };
  return { cls: left < 60 ? 'warn' : '', text: `${txt} left` };
}
function completeness(id) {
  const c = result(id).checks[0];
  return c.status === 'pass' ? { cls: 'pass', text: 'Complete' } : { cls: 'fail', text: c.detail.replace('Missing: ', 'Missing ') };
}

// ---------- icons ----------
const ICON = {
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="#4A1809" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="#4A1809" stroke-width="1.6"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="#1A5637" stroke-width="1.8"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5M8.5 11h5M11 8.5v5"/></svg>',
  funnel: '<svg viewBox="0 0 24 24" fill="#143E4D"><path d="M3 4h18l-7 8v7l-4 2v-9z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="#4A1809" stroke-width="2"><path d="m5 12 4 4 10-10"/></svg>',
  flask: '<svg viewBox="0 0 24 24" fill="none" stroke="#143E4D" stroke-width="1.6"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="#1A5637" stroke-width="1.8"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="#5E132C" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/></svg>',
};
const pixels = (n = 8) => `<div class="pixels" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i style="background:${['#FF835E', '#8DDDB4', '#99C4DB', '#EC80A4', '#FAEA82'][i % 5]}"></i>`).join('')}</div>`;
const secHead = (tile, icon, eyebrow, title, sub, right = '') => `<div class="sec-head"><div class="tile ${tile}">${ICON[icon]}</div><div class="grow"><div class="small muted">${eyebrow}</div><h3>${title}</h3>${sub ? `<p class="small muted">${sub}</p>` : ''}</div>${right}</div>`;

function evChip(subId, e, label) {
  if (!e?.docId) return '';
  const d = docById(byId[subId], e.docId);
  const lab = label || `${d?.filename || e.docId} · p${e.page} · L${e.line}`;
  return `<button class="ev" type="button" data-ev="${esc(subId)}|${esc(e.docId)}|${e.page}|${e.line}" title="${esc(e.text)}"><i class="pin" aria-hidden="true"></i><span>${esc(lab)}</span></button>`;
}

// ---------- views ----------
let filter = 'all';
function inboxHTML(activeId) {
  const items = SUBMISSIONS.filter((s) => {
    if (filter === 'all') return true;
    const st = subStatus(s.id).key;
    if (filter === 'open') return st !== 'done';
    if (filter === 'incomplete') return completeness(s.id).cls === 'fail';
    if (filter === 'done') return st === 'done';
    return true;
  }).sort((a, b) => state.subs[a.id].receivedAt - state.subs[b.id].receivedAt);
  const open = SUBMISSIONS.filter((s) => !state.subs[s.id].decision).length;
  return `<section class="card inbox" aria-label="Submission inbox">
    <div class="inbox-head"><div><h3>Shared inbox</h3><p class="small muted">subs@meridiancf.example · oldest first</p></div><span class="badge info">${open} open</span></div>
    <div class="inbox-filters" role="group" aria-label="Filter">${[['all', 'All'], ['open', 'Open'], ['incomplete', 'Incomplete'], ['done', 'Decision-ready']].map(([k, l]) => `<button class="chipbtn" type="button" data-filter="${k}" aria-pressed="${filter === k}">${l}</button>`).join('')}</div>
    <ul class="rows">${items.map((s) => {
      const st = subStatus(s.id), c = completeness(s.id), r = result(s.id), q = sla(s.id);
      return `<li><a class="row" href="#/desk/${s.id}" aria-current="${s.id === activeId}" data-sub="${s.id}">
        <i class="box ${st.key === 'done' ? 'done' : ''}" aria-hidden="true"></i>
        <div style="min-width:0"><div class="who"><span>${esc(s.broker.name)}</span></div>
          <div class="biz">${esc(s.business.dba || s.business.legalName)}</div>
          <div class="meta"><span class="badge ${c.cls}">${esc(c.text.length > 30 ? c.text.slice(0, 28) + '…' : c.text)}</span>${r.flags.length ? `<span class="badge flag">${r.flags.length} flag${r.flags.length > 1 ? 's' : ''}</span>` : '<span class="badge pass">0 flags</span>'}${st.key === 'done' ? '<span class="badge done">Ready</span>' : ''}</div></div>
        <div class="right"><div class="amt">${money(s.requested)}</div><div class="muted">${timeStr(state.subs[s.id].receivedAt).slice(0, 5)}</div><div class="sla ${q.cls}" data-sla="${s.id}">${q.text}</div></div>
      </a></li>`;
    }).join('') || '<li class="pad muted small">Nothing here.</li>'}</ul>
  </section>`;
}

function deskHTML(id) {
  const sub = byId[id];
  const detail = sub ? subHTML(sub) : `<div class="card empty"><div class="eyebrow">Ready</div><h2>Every submission below is already <br>classified, extracted and scrubbed.</h2><p class="muted">Pick one from the inbox. Nothing is approved without you.</p></div>`;
  return `<section class="hero"><div><span class="eyebrow">01 · ${esc(FUNDER.name)} · ${esc(FUNDER.policyVersion)}</span><h1>Every submission, scrubbed <br>before you open it.</h1></div>
    <div><p class="muted">Broker emails land here with their attachment stack already sorted, read and checked. Each number links to the line it came from, each check shows its rule, and each flag waits for a person.</p>${pixels(12)}</div></section>
    <div class="band desk ${sub ? 'has-sub' : ''}">${inboxHTML(id)}<div class="detail" id="detail">${detail}</div></div>`;
}

function subHTML(sub) {
  const st = state.subs[sub.id], r = result(sub.id), q = sla(sub.id), stt = subStatus(sub.id);
  const reviewed = r.flags.filter((f) => st.reviews[f.id]).length;
  const steps = [['docs', 'Documents', r.classification.every((c) => c.effective !== 'unknown')], ['fields', 'Extraction', true], ['checks', `Scrub · ${reviewed}/${r.flags.length} reviewed`, reviewed === r.flags.length], ['policy', 'Credit policy', !r.policy.some((p) => p.status !== 'pass')], ['decision', 'Decision package', !!st.decision]];
  return `<a class="btn sm ghost back" href="#/desk">← Inbox</a>
  <section class="card pad" id="sec-head"><div class="sub-head"><div style="min-width:0">
    <div class="small muted">${esc(sub.id)} · ${esc(sub.subject)}</div><h2>${esc(sub.business.legalName)}</h2>
    <div class="kv"><span>Broker <b>${esc(sub.broker.name)}</b></span><span>Requested <b>${money(sub.requested)}</b></span><span>Industry <b>${esc(sub.business.industry)}</b></span><span>Received <b>${timeStr(st.receivedAt)}</b></span></div></div>
    <div style="text-align:right"><span class="badge ${stt.key === 'done' ? 'done' : stt.key === 'review' ? 'review' : 'info'}">${esc(stt.label)}</span><div class="sla small ${q.cls}" data-sla="${sub.id}" style="margin-top:6px">${q.text}</div></div></div>
    <div class="stepper">${steps.map(([a, l, ok]) => `<a href="#sec-${a}" data-jump="sec-${a}" class="${ok ? 'ok' : 'todo'}">${esc(l)}</a>`).join('')}</div>
  </section>
  ${docsHTML(sub, r)}${fieldsHTML(sub, r)}${checksHTML(sub, r)}${policyHTML(sub, r)}${decisionHTML(sub, r)}`;
}

function docsHTML(sub, r) {
  const st = state.subs[sub.id];
  return `<section class="card pad" id="sec-docs">${secHead('t', 'doc', '02 · Classification', 'Documents in the stack', `${sub.docs.length} attachments sorted by type. Below ${CONFIDENCE_THRESHOLD.toFixed(2)} confidence a file stays unknown until a person labels it.`)}
  <div class="docs">${r.classification.map((c) => {
    const d = docById(sub, c.docId), low = c.label === 'unknown' && !c.overridden;
    const bars = Math.round(c.confidence * 10);
    return `<div class="doc ${low ? 'low' : ''}" data-doc="${c.docId}"><div class="doc-top"><div class="doc-thumb ${/\.jpe?g$/.test(d.filename) ? 'img' : ''}" aria-hidden="true"></div>
      <div style="min-width:0;flex:1"><div class="doc-name" title="${esc(d.filename)}">${esc(d.filename)}</div><div class="small">${esc(DOC_LABELS[c.effective])}${c.overridden ? ' <span class="badge info">reclassified</span>' : ''}${low && c.guess ? ` <span class="muted">· guess: ${esc(DOC_LABELS[c.guess])}</span>` : ''}</div></div></div>
      <div class="conf"><span class="conf-bar" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < bars ? 'on' : ''}"></i>`).join('')}</span>${c.confidence.toFixed(2)} confidence · ${d.pages.length}p</div>
      <div class="doc-actions"><label class="sr" for="rc-${c.docId}">Reclassify ${esc(d.filename)}</label><select id="rc-${c.docId}" data-reclass="${sub.id}|${c.docId}" ${st.decision ? 'disabled' : ''}>${DOC_TYPES.map((t) => `<option value="${t}" ${t === c.effective ? 'selected' : ''}>${esc(DOC_LABELS[t])}</option>`).join('')}</select>
      <button class="btn sm" type="button" data-ev="${sub.id}|${c.docId}|1|1">View</button></div></div>`;
  }).join('')}</div></section>`;
}

function fieldsHTML(sub, r) {
  const keys = ['legalName', 'ein', 'monthlyRevenue', 'avgDailyBalance', 'existingPositions', 'monthsInBusiness', 'nsfCount', 'owner'];
  return `<section class="card pad" id="sec-fields">${secHead('g', 'search', '03 · Extraction', 'Key fields, with their source', 'Click an evidence chip to open the document at the exact line.')}
  <div class="fields">${keys.map((k) => {
    const f = r.fields[k];
    const ev = f.evidence.slice(0, k === 'nsfCount' ? 3 : 4);
    return `<div class="field" data-field="${k}"><div class="lab">${esc(f.label)}</div><div class="val">${esc(fmtField(f))}</div>
      <div class="chips">${ev.map((e) => evChip(sub.id, e)).join('') || '<span class="small muted">No source line</span>'}${f.evidence.length > ev.length ? `<span class="small muted">+${f.evidence.length - ev.length} more</span>` : ''}</div>
      ${f.names?.length ? `<div class="note">${f.names.map(esc).join('<br>')}</div>` : ''}${f.note ? `<div class="note">${esc(f.note)}</div>` : ''}</div>`;
  }).join('')}</div></section>`;
}

function checksHTML(sub, r) {
  const st = state.subs[sub.id];
  const order = [...r.checks].sort((a, b) => (b.status === 'flag') - (a.status === 'flag'));
  return `<section class="card pad" id="sec-checks">${secHead('b', 'funnel', '04 · Scrub', `${r.flags.length} flag${r.flags.length === 1 ? '' : 's'} across ${r.checks.length} checks`, 'Deterministic rules, run in code. Every flag needs a person to confirm or override it, with a reason.', `<span class="badge ${r.flags.length ? 'flag' : 'pass'}">${r.flags.length ? 'Review' : 'All clear'}</span>`)}
  <div class="checks">${order.map((c) => {
    const rv = st.reviews[c.id];
    const badge = c.status === 'flag' ? (rv ? `<span class="badge ${rv.verdict === 'confirmed' ? 'fail' : 'pass'}">${rv.verdict === 'confirmed' ? 'Confirmed' : 'Overridden'}</span>` : '<span class="badge flag">Review</span>') : c.status === 'pass' ? '<span class="badge pass">Pass</span>' : '<span class="badge na">Not run</span>';
    return `<div class="check ${c.status === 'flag' && !rv ? 'flag' : ''}" data-check="${c.id}"><div class="check-top"><div><div class="check-name">${esc(c.name)}</div><div class="check-cat">${esc(c.category)}</div></div>${badge}</div>
      <div class="detail-t">${esc(c.detail)}</div>
      ${c.evidence.length ? `<div class="chips">${c.evidence.slice(0, 4).map((e) => evChip(sub.id, e)).join('')}${c.evidence.length > 4 ? `<span class="small muted">+${c.evidence.length - 4} more</span>` : ''}</div>` : ''}
      <details class="rule-wrap" ${c.status === 'flag' ? 'open' : ''}><summary>Rule</summary><div class="rule">${esc(c.rule)}</div></details>
      ${c.status === 'flag' ? reviewHTML(sub.id, c, rv) : ''}</div>`;
  }).join('')}</div></section>`;
}
function reviewHTML(subId, c, rv) {
  if (rv) return `<div class="review"><div class="verdict"><b style="font-weight:500">${rv.verdict === 'confirmed' ? 'Confirmed as a real issue' : 'Overridden as acceptable'}</b><span class="muted small">${esc(UNDERWRITER)} · ${timeStr(rv.at)}</span></div><div class="small">“${esc(rv.note)}”</div>${state.subs[subId].decision ? '' : `<div><button class="btn sm ghost" type="button" data-undo="${subId}|${c.id}">Reopen</button></div>`}</div>`;
  return `<div class="review"><label class="sr" for="nt-${c.id}">Rationale for ${esc(c.name)}</label><textarea id="nt-${c.id}" data-note="${c.id}" placeholder="Rationale (required), e.g. what you checked and why"></textarea>
    <div class="acts"><button class="btn sm primary" type="button" data-review="${subId}|${c.id}|confirmed">Confirm issue</button><button class="btn sm" type="button" data-review="${subId}|${c.id}|overridden">Override</button></div></div>`;
}

function policyHTML(sub, r) {
  const fails = r.policy.filter((p) => p.status === 'fail').length, unk = r.policy.filter((p) => p.status === 'unknown').length;
  return `<section class="card pad" id="sec-policy">${secHead('y', 'list', '05 · Evaluation rules', `${esc(FUNDER.policyVersion)}: ${fails ? `${fails} rule${fails > 1 ? 's' : ''} failed` : unk ? `${unk} unknown` : 'all rules pass'}`, 'The funder’s credit box, written as explicit rules. Passing every rule makes a file eligible for an offer; it does not approve it.')}
  <div class="policy">${r.policy.map((p) => `<div class="prow" data-rule="${p.id}"><span class="small muted where-l">Where</span><span class="pill">${esc(p.where)}</span><span class="pill op">${esc(p.op)}</span><span class="pill val">${p.unit === '$' ? money(p.value) : `${p.value}${p.unit === 'x' ? 'x' : ' ' + p.unit}`}</span><span class="why">${esc(p.reason)}</span><span class="badge ${p.status}">${p.status === 'pass' ? 'Pass' : p.status === 'fail' ? 'Fail' : 'Unknown'}</span></div>`).join('')}</div></section>`;
}

function packageObj(sub) {
  const st = state.subs[sub.id], r = result(sub.id);
  return {
    submission: sub.id, funder: FUNDER.name, policy: FUNDER.policyVersion,
    business: { legalName: r.fields.legalName.value, dba: sub.business.dba, ein: r.fields.ein.value, owner: r.fields.owner.value, industry: sub.business.industry },
    broker: sub.broker.name, requested: sub.requested, receivedAt: dateTime(st.receivedAt),
    fields: Object.fromEntries(Object.entries(r.fields).map(([k, f]) => [k, { value: f.value, sources: f.evidence.map((e) => `${docById(sub, e.docId).filename} p${e.page} L${e.line}`) }])),
    documents: r.classification.map((c) => ({ file: c.filename, type: c.effective, confidence: c.confidence, reclassified: c.overridden })),
    checks: r.checks.map((c) => ({ check: c.name, status: c.status, detail: c.detail, review: st.reviews[c.id] ? { verdict: st.reviews[c.id].verdict, rationale: st.reviews[c.id].note, by: UNDERWRITER, at: dateTime(st.reviews[c.id].at) } : null })),
    policy: r.policy.map((p) => ({ rule: `${p.where} ${p.op} ${p.value}`, status: p.status, reason: p.reason })),
    decision: st.decision ? { outcome: st.decision.outcome, rationale: st.decision.rationale, by: UNDERWRITER, at: dateTime(st.decision.at), timeToDecisionMinutes: Math.round((st.decision.at - st.receivedAt) / 60000) } : null,
  };
}
const OUTCOMES = ['Ready for offer', 'Ready for offer with conditions', 'Request missing documents', 'Decline: outside credit policy', 'Decline: suspected fraud'];
function decisionHTML(sub, r) {
  const st = state.subs[sub.id], p = packageObj(sub);
  const open = r.flags.filter((f) => !st.reviews[f.id]);
  const fails = r.policy.filter((x) => x.status === 'fail');
  const dl = [['Business', `${p.business.legalName || '—'}${sub.business.dba ? ` (${sub.business.dba})` : ''}`], ['EIN', p.business.ein || '—'], ['Owner', p.business.owner || '—'], ['Requested', money(sub.requested)], ['Monthly revenue', money(r.fields.monthlyRevenue.value)], ['Avg daily balance', money(r.fields.avgDailyBalance.value)], ['Existing positions', fmtField(r.fields.existingPositions)], ['Months in business', fmtField(r.fields.monthsInBusiness)], ['Scrub', `${r.flags.length} flag(s): ${r.flags.map((f) => `${f.name}${st.reviews[f.id] ? ` [${st.reviews[f.id].verdict}]` : ' [open]'}`).join(', ') || 'none'}`], ['Credit policy', fails.length ? `Fails ${fails.map((f) => f.name).join(', ')}` : 'All rules pass'], ['Outcome', st.decision ? `${st.decision.outcome}` : 'Not decided']];
  const form = st.decision
    ? `<div class="gate ok">Marked decision-ready by ${esc(UNDERWRITER)} at ${timeStr(st.decision.at)}. Rationale: “${esc(st.decision.rationale)}”</div><div class="row-btns"><button class="btn sm ghost" type="button" data-reopen="${sub.id}">Reopen file</button></div>`
    : `<div class="gate ${open.length ? '' : 'ok'}">${open.length ? `${open.length} flag${open.length > 1 ? 's' : ''} still need${open.length > 1 ? '' : 's'} a review: ${open.map((f) => esc(f.name)).join(', ')}` : 'All flags reviewed. Choose an outcome and give a rationale.'}</div>
      <label>Outcome<select id="outcome" ${open.length ? 'disabled' : ''}>${OUTCOMES.map((o) => `<option ${(fails.length ? o.startsWith('Decline: outside') : o === 'Ready for offer') ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label>Rationale<textarea id="rationale" ${open.length ? 'disabled' : ''} placeholder="Why this outcome (required)"></textarea></label>
      <div class="row-btns"><button class="btn primary" type="button" id="mark-ready" data-sub="${sub.id}" ${open.length ? 'disabled' : ''}><i class="glyph"></i>Mark decision-ready</button></div>`;
  return `<section class="card pad" id="sec-decision">${secHead('p', 'check', '06 · Decision-ready', 'Package for the CRM', 'One screen the deal desk can act on, with every source and review attached.')}
  <div class="decision"><div class="pkg" id="pkg"><div class="pkg-head"><span>CRM record · ${esc(sub.id)}</span><div class="row-btns"><button class="btn sm" type="button" data-export="json|${sub.id}">Export JSON</button><button class="btn sm" type="button" data-export="csv|${sub.id}">Export CSV</button></div></div>
    <dl>${dl.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></div>
    <div class="form">${form}<p class="small muted">Nothing on this desk approves a deal. Passing rules and reviewed flags only make the file ready for a decision.</p></div></div></section>`;
}

// ---------- eval lab ----------
let evalCache;
function evalHTML() {
  const r = evalCache || (evalCache = runEvals(GOLDEN_SUBMISSIONS));
  const miss = r.cases.find((c) => c.knownMiss), fp = r.cases.find((c) => c.knownFalsePositive);
  const g = (id) => GOLDEN.find((x) => x.spec.id === id);
  return `<section class="hero"><div><span class="eyebrow">02 · Eval lab</span><h1>24 seeded submissions. <br>One honest miss.</h1></div><div><p class="muted">The scrub engine runs against a golden set of synthetic stacks with known defects planted in them. The same code runs on the desk and in the unit tests.</p>${pixels(12)}</div></section>
  <div class="band stack">
    <div class="stats"><div class="stat"><div class="lab">Catch rate</div><div class="big">${pct(r.catchRate)}</div><div class="small muted">${r.caught} of ${r.seeded} seeded defects flagged</div></div>
      <div class="stat"><div class="lab">False positive flags</div><div class="big">${r.falsePositives}</div><div class="small muted">flags not tied to a seeded defect</div></div>
      <div class="stat"><div class="lab">Clean stacks flagged</div><div class="big">${r.cleanFlagged}/${r.cleanCases}</div><div class="small muted">clean controls that raised any flag</div></div>
      <div class="stat"><div class="lab">Cases exactly right</div><div class="big">${r.casesPassed}/${r.cases.length}</div><div class="small muted">every expected flag, nothing extra</div></div></div>
    <div class="callouts">
      <div class="callout miss" id="honest-miss"><span class="badge fail">Honest miss · ${esc(miss.id)}</span><h3>${esc(miss.defect)}</h3><p class="small">Expected <b style="font-weight:500">${esc(miss.expected.join(', '))}</b>. Flags fired: ${miss.fired.length ? esc(miss.fired.join(', ')) : 'none'}.</p><p class="small">${esc(g(miss.id).knownMiss)}</p></div>
      <div class="callout fp"><span class="badge flag">False positive · ${esc(fp.id)}</span><h3>${esc(fp.defect)}</h3><p class="small">Fired <b style="font-weight:500">${esc(fp.falsePos.join(', '))}</b> on a legitimate payer.</p><p class="small">${esc(g(fp.id).knownFalsePositive)}</p></div></div>
    <div class="card pad">${secHead('b', 'flask', 'Golden set', 'Case by case', 'Expected flags are what a correct scrub must raise. Anything else is a false positive.')}
      <div class="tablewrap"><table><thead><tr><th>Case</th><th>Seeded defect</th><th>Expected</th><th>Fired</th><th>Result</th></tr></thead><tbody>${r.cases.map((c) => `<tr class="${c.missed.length ? 'is-miss' : ''}"><td class="mono">${c.id}</td><td>${esc(c.defect)}</td><td><div class="tags">${c.expected.map((x) => `<span class="badge na">${x}</span>`).join('') || '<span class="muted small">none</span>'}</div></td><td><div class="tags">${c.fired.map((x) => `<span class="badge ${c.expected.includes(x) ? 'pass' : 'flag'}">${x}</span>`).join('') || '<span class="muted small">none</span>'}</div></td><td>${c.pass ? '<span class="badge pass">Correct</span>' : c.missed.length ? '<span class="badge fail">Missed</span>' : '<span class="badge flag">False positive</span>'}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card pad">${secHead('g', 'pulse', 'By check', 'Where each rule earns its keep', '')}
      <div class="tablewrap"><table><thead><tr><th>Check</th><th>Caught</th><th>Missed</th><th>False positives</th></tr></thead><tbody>${r.perCheck.filter((p) => p.tp + p.fn + p.fp).map((p) => `<tr><td>${esc(p.name)}</td><td>${p.tp}</td><td>${p.fn}</td><td>${p.fp}</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted" style="margin-top:10px">Unit tests: <span class="mono">npm test</span> runs 207 tests across the rule engine and this golden set. Results are recorded in TEST-RESULTS.md.</p></div>
  </div>`;
}

// ---------- metrics ----------
const MANUAL_MIN = { classify: 0.75, perStatementArithmetic: 6, continuity: 3, nsf: 5, deposits: 8, crossDoc: 6, policy: 4, package: 6 };
const REVIEW_MIN_PER_FLAG = 3, OPEN_MIN = 2;
function manualMinutes(sub) { const n = sub.docs.filter((d) => d.kind === 'bank_statement').length; return round1(sub.docs.length * MANUAL_MIN.classify + n * MANUAL_MIN.perStatementArithmetic + MANUAL_MIN.continuity + MANUAL_MIN.nsf + MANUAL_MIN.deposits + MANUAL_MIN.crossDoc + MANUAL_MIN.policy + MANUAL_MIN.package); }
const round1 = (x) => Math.round(x * 10) / 10;
function metricsHTML() {
  const rows = SUBMISSIONS.map((s) => { const r = runPipeline(s), man = manualMinutes(s), desk = OPEN_MIN + r.flags.length * REVIEW_MIN_PER_FLAG; return { s, r, man, desk, saved: round1(man - desk) }; });
  const avgSaved = round1(rows.reduce((a, x) => a + x.saved, 0) / rows.length);
  const fp = rows.filter((x) => x.r.complete).length;
  const decided = SUBMISSIONS.filter((s) => state.subs[s.id].decision);
  const ttd = decided.map((s) => (state.subs[s.id].decision.at - state.subs[s.id].receivedAt) / 60000);
  const handle = decided.filter((s) => state.subs[s.id].openedAt).map((s) => (state.subs[s.id].decision.at - state.subs[s.id].openedAt) / 60000);
  const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[Math.floor((b.length - 1) / 2)]; };
  const fmtMin = (m) => (m === null ? '—' : m < 1 ? `${Math.round(m * 60)}s` : `${round1(m)}m`);
  return `<section class="hero"><div><span class="eyebrow">03 · Metrics</span><h1>Is the desk making <br>deals move faster?</h1></div><div><p class="muted">Three numbers the underwriting lead watches. Time-to-decision is measured live in this browser. Time saved is modelled from stated assumptions. Completeness is computed from the queue.</p>${pixels(12)}</div></section>
  <div class="band stack">
    <div class="stats three" id="metric-cards">
      <div class="stat"><div class="lab">Time-to-decision (median, receipt → decision-ready)</div><div class="big">${fmtMin(med(ttd))}</div><div class="small muted">${decided.length ? `${decided.length} decided this session · hands-on time ${fmtMin(med(handle))}` : 'Measured: decide a submission on the desk to start the clock'} · SLA ${FUNDER.slaMinutes / 60}h</div></div>
      <div class="stat"><div class="lab">Scrub time saved per submission</div><div class="big">${avgSaved}m</div><div class="small muted">Modelled: manual scrub ${round1(rows.reduce((a, x) => a + x.man, 0) / rows.length)}m vs desk review ${round1(rows.reduce((a, x) => a + x.desk, 0) / rows.length)}m</div></div>
      <div class="stat"><div class="lab">First-pass completeness rate</div><div class="big">${pct(fp / rows.length)}</div><div class="small muted">${fp} of ${rows.length} stacks complete on arrival, no follow-up email needed</div></div></div>
    <div class="grid2"><div class="card pad">${secHead('g', 'pulse', 'Per submission', 'Modelled minutes', '')}<div class="tablewrap"><table><thead><tr><th>Submission</th><th>Flags</th><th>Manual</th><th>Desk</th><th>Saved</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${esc(x.s.business.dba || x.s.business.legalName)}</td><td>${x.r.flags.length}</td><td>${x.man}m</td><td>${x.desk}m</td><td>${x.saved}m</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card pad">${secHead('y', 'list', 'Assumptions', 'How the model is built', 'Hypotheses to validate with underwriters, not measurements.')}<div class="tablewrap"><table><tbody>
        <tr><td>Open and classify each attachment</td><td>${MANUAL_MIN.classify}m / file</td></tr><tr><td>Re-add one statement’s running balance</td><td>${MANUAL_MIN.perStatementArithmetic}m / statement</td></tr><tr><td>Check date continuity</td><td>${MANUAL_MIN.continuity}m</td></tr><tr><td>Count NSFs, overdrafts, negative days</td><td>${MANUAL_MIN.nsf}m</td></tr><tr><td>Deposit analysis (round, concentration, sudden)</td><td>${MANUAL_MIN.deposits}m</td></tr><tr><td>Cross-check name, address, EIN, owner</td><td>${MANUAL_MIN.crossDoc}m</td></tr><tr><td>Apply credit policy</td><td>${MANUAL_MIN.policy}m</td></tr><tr><td>Write up the package</td><td>${MANUAL_MIN.package}m</td></tr><tr><td><b style="font-weight:500">Desk:</b> open the file + review each flag</td><td>${OPEN_MIN}m + ${REVIEW_MIN_PER_FLAG}m / flag</td></tr></tbody></table></div></div></div>
  </div>`;
}

// ---------- audit ----------
let auditFilter = '';
function auditHTML() {
  const rows = state.audit.filter((a) => !auditFilter || a.sub === auditFilter).slice().reverse();
  return `<section class="hero"><div><span class="eyebrow">04 · Audit trail</span><h1>Every step, timestamped.</h1></div><div><p class="muted">Classification, extraction, every check, every policy rule, every review and every decision lands here with who did it and when. Export it for compliance or a model-risk review.</p>${pixels(12)}</div></section>
  <div class="band stack"><div class="card pad"><div class="toolbar"><label class="small muted">Submission <select id="audit-filter" class="pill" style="border:0"><option value="">All (${state.audit.length} events)</option>${SUBMISSIONS.map((s) => `<option value="${s.id}" ${auditFilter === s.id ? 'selected' : ''}>${s.id} · ${esc(s.business.dba || s.business.legalName)}</option>`).join('')}</select></label>
    <div class="row-btns"><button class="btn sm" type="button" data-export-audit="json">Export JSON</button><button class="btn sm" type="button" data-export-audit="csv">Export CSV</button><button class="btn sm ghost" type="button" id="reset">Reset demo</button></div></div>
    <div class="tablewrap"><table><thead><tr><th>Time (UTC)</th><th>Submission</th><th>Actor</th><th>Event</th><th>Detail</th></tr></thead><tbody>${rows.slice(0, 300).map((a) => `<tr><td class="mono">${dateTime(a.at).slice(11)}</td><td class="mono">${a.sub}</td><td>${esc(a.actor)}</td><td><span class="badge ${a.type === 'flag raised' ? 'flag' : a.actor === UNDERWRITER ? 'info' : 'na'}">${esc(a.type)}</span></td><td class="small">${esc(a.detail)}</td></tr>`).join('')}</tbody></table></div>
    ${rows.length > 300 ? `<p class="small muted" style="margin-top:8px">Showing latest 300 of ${rows.length}. Export for the full log.</p>` : ''}</div></div>`;
}

// ---------- drawer ----------
function openDoc(subId, docId, page, line) {
  const sub = byId[subId], d = docById(sub, docId); if (!d) return;
  const hit = resolveEvidence(sub, { docId, page, line });
  const isScan = /\.jpe?g$/.test(d.filename);
  const el = $('#drawer');
  el.innerHTML = `<div class="drawer-panel" role="dialog" aria-modal="true" aria-label="${esc(d.filename)}"><div class="drawer-head"><div style="min-width:0"><div class="small muted">${esc(sub.business.dba || sub.business.legalName)} · ${esc(DOC_LABELS[result(subId).classification.find((c) => c.docId === docId).effective])}</div><h3 style="overflow-wrap:anywhere">${esc(d.filename)}</h3>${line > 1 || page > 1 ? `<div class="small">Evidence: page ${page}, line ${line}</div>` : ''}</div><button class="btn sm" type="button" id="close-drawer">Close</button></div>
    <div class="drawer-body">${d.pages.map((p) => `<div class="paper ${isScan ? 'scan' : ''}"><div class="paper-label"><span>Page ${p.number}</span><span>Synthetic document</span></div>${p.lines.map((l, i) => `<div class="ln ${p.number === page && i + 1 === line && hit && (line > 1 || page > 1) ? 'hit' : ''}" ${p.number === page && i + 1 === line ? 'id="hit"' : ''}><span class="n">${i + 1}</span><span class="t">${esc(l.text)}</span></div>`).join('')}</div>`).join('')}</div></div>`;
  el.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#close-drawer').focus();
  requestAnimationFrame(() => $('#hit')?.scrollIntoView({ block: 'center' }));
  if (line > 1 || page > 1) audit(subId, 'evidence opened', `${d.filename} page ${page} line ${line}`);
}
function closeDrawer() { const el = $('#drawer'); el.hidden = true; el.innerHTML = ''; document.body.style.overflow = ''; }

// ---------- export ----------
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 500);
  toast(`Exported ${name}`);
}
const csvCell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n');
function exportPackage(kind, subId) {
  const p = packageObj(byId[subId]);
  if (kind === 'json') download(`${subId}-decision-package.json`, JSON.stringify(p, null, 2), 'application/json');
  else {
    const rows = [['section', 'item', 'value', 'status', 'source_or_note']];
    rows.push(['submission', 'id', p.submission, '', p.funder], ['submission', 'broker', p.broker, '', ''], ['submission', 'requested', p.requested, '', '']);
    for (const [k, f] of Object.entries(p.fields)) rows.push(['field', k, f.value, '', f.sources.join(' | ')]);
    for (const c of p.checks) rows.push(['check', c.check, c.detail, c.status, c.review ? `${c.review.verdict}: ${c.review.rationale}` : '']);
    for (const r of p.policy) rows.push(['policy', r.rule, r.reason, r.status, '']);
    rows.push(['decision', 'outcome', p.decision?.outcome ?? 'not decided', '', p.decision?.rationale ?? '']);
    download(`${subId}-decision-package.csv`, toCsv(rows), 'text/csv');
  }
  audit(subId, 'exported', `Decision package exported as ${kind.toUpperCase()}`);
}
function exportAudit(kind) {
  const rows = state.audit.filter((a) => !auditFilter || a.sub === auditFilter).map((a) => ({ at: dateTime(a.at), submission: a.sub, actor: a.actor, event: a.type, detail: a.detail }));
  const name = `audit-trail${auditFilter ? '-' + auditFilter : ''}.${kind}`;
  if (kind === 'json') download(name, JSON.stringify(rows, null, 2), 'application/json');
  else download(name, toCsv([['at', 'submission', 'actor', 'event', 'detail'], ...rows.map((r) => Object.values(r))]), 'text/csv');
}

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

// ---------- router ----------
function route() {
  const [view, id] = location.hash.replace(/^#\/?/, '').split('/');
  const v = view || 'desk';
  document.querySelectorAll('.tabs a').forEach((a) => a.toggleAttribute('aria-current', false) || (a.dataset.tab === v && a.setAttribute('aria-current', 'page')));
  const app = $('#app');
  if (v === 'evals') app.innerHTML = evalHTML();
  else if (v === 'metrics') app.innerHTML = metricsHTML();
  else if (v === 'audit') app.innerHTML = auditHTML();
  else {
    if (id && byId[id] && !state.subs[id].openedAt) { state.subs[id].openedAt = Date.now(); audit(id, 'opened', 'Underwriter opened the submission'); }
    app.innerHTML = deskHTML(byId[id] ? id : null);
  }
  return { v, id };
}
let last = {};
function render(keepScroll) {
  const y = window.scrollY;
  const next = route();
  if (keepScroll) window.scrollTo(0, y);
  else if (next.v !== last.v || next.id !== last.id) { window.scrollTo(0, 0); }
  last = next;
}
window.addEventListener('hashchange', () => render(false));

// ---------- events ----------
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a');
  if (e.target.id === 'drawer') return closeDrawer();
  if (!t) return;
  const d = t.dataset;
  if (d.ev) { const [s, doc, p, l] = d.ev.split('|'); openDoc(s, doc, +p, +l); return; }
  if (t.id === 'close-drawer') return closeDrawer();
  if (d.filter) { filter = d.filter; return render(true); }
  if (d.jump) { e.preventDefault(); const el = document.getElementById(d.jump); el?.scrollIntoView({ behavior: 'smooth', block: 'start' }); el?.classList.remove('flash'); void el?.offsetWidth; el?.classList.add('flash'); return; }
  if (d.review) {
    const [s, c, verdict] = d.review.split('|');
    const ta = document.querySelector(`[data-note="${c}"]`); const note = ta.value.trim();
    if (note.length < 4) { ta.focus(); ta.style.borderColor = '#CD461D'; toast('Add a short rationale first'); return; }
    state.subs[s].reviews[c] = { verdict, note, at: Date.now() };
    audit(s, verdict === 'confirmed' ? 'flag confirmed' : 'flag overridden', `${result(s).checks.find((x) => x.id === c).name}: ${note}`);
    toast(verdict === 'confirmed' ? 'Flag confirmed' : 'Flag overridden');
    return render(true);
  }
  if (d.undo) { const [s, c] = d.undo.split('|'); delete state.subs[s].reviews[c]; audit(s, 'flag reopened', c); return render(true); }
  if (t.id === 'mark-ready') {
    const s = d.sub, rat = $('#rationale').value.trim(), outcome = $('#outcome').value;
    if (rat.length < 4) { $('#rationale').focus(); toast('Add a rationale for the outcome'); return; }
    state.subs[s].decision = { outcome, rationale: rat, at: Date.now() };
    audit(s, 'decision-ready', `${outcome}: ${rat}`); toast('Marked decision-ready');
    render(true); $('#sec-decision')?.scrollIntoView({ block: 'start' });
    return;
  }
  if (d.reopen) { state.subs[d.reopen].decision = null; audit(d.reopen, 'reopened', 'Decision withdrawn for rework'); return render(true); }
  if (d.export) { const [k, s] = d.export.split('|'); return exportPackage(k, s); }
  if (d.exportAudit) return exportAudit(d.exportAudit);
  if (t.id === 'export-audit-nav') return exportAudit('json');
  if (t.id === 'reset') { localStorage.removeItem(STORE); location.hash = '#/desk'; location.reload(); }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.reclass) {
    const [s, doc] = t.dataset.reclass.split('|');
    const base = result(s).classification.find((c) => c.docId === doc).label;
    if (t.value === base) delete state.subs[s].overrides[doc]; else state.subs[s].overrides[doc] = t.value;
    const r = result(s);
    for (const k of Object.keys(state.subs[s].reviews)) if (!r.flags.some((f) => f.id === k)) delete state.subs[s].reviews[k];
    audit(s, 'reclassified', `${docById(byId[s], doc).filename} → ${DOC_LABELS[t.value]}; scrub and policy re-run (${r.flags.length} flags)`);
    toast(`Reclassified as ${DOC_LABELS[t.value]}. Checks re-run.`);
    save(); render(true);
  }
  if (t.id === 'audit-filter') { auditFilter = t.value; render(true); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });
setInterval(() => document.querySelectorAll('[data-sla]').forEach((el) => { const q = sla(el.dataset.sla); el.textContent = q.text; el.className = el.className.replace(/\b(warn|late)\b/g, '').trim() + (q.cls ? ' ' + q.cls : ''); }), 15000);

if (!location.hash) history.replaceState(null, '', '#/desk');
render(false);
