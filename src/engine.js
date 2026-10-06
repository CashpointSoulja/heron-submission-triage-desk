// Submission scrub engine: deterministic rules, no network, no models.
// Every function reads only the parsed lines of the documents in a submission.

export const DOC_TYPES = ['application', 'bank_statement', 'tax_return', 'voided_check', 'id', 'unknown'];
export const DOC_LABELS = {
  application: 'Application',
  bank_statement: 'Bank statement',
  tax_return: 'Tax return',
  voided_check: 'Voided check',
  id: 'ID',
  unknown: 'Unknown',
};

export const CLASSIFIER_KEYWORDS = {
  application: ['cash advance application', 'requested amount', 'use of funds', 'ownership %', 'business start date'],
  bank_statement: ['statement period', 'opening balance', 'closing balance', 'account number', 'business checking'],
  tax_return: ['form 1120', 'income tax return', 'tax year', 'gross receipts', 'employer identification number'],
  voided_check: ['void', 'pay to the order of', 'routing', 'memo'],
  id: ['driver license', 'date of birth', 'class d', 'dl no'],
};
export const CONFIDENCE_THRESHOLD = 0.7;

// Pooled channels aggregate many customers, so they are not a single payer.
export const KNOWN_PROCESSORS = [
  'SQUARE INC DEPOSIT', 'STRIPE PAYOUT', 'TOAST INC DEP', 'SHOPIFY PAYMENTS', 'CLOVER SETTLEMENT', 'MINDBODY PAYOUT', 'MOBILE DEPOSIT CHECK',
];
const POSITION_PATTERN = /\b(CAPITAL|FUNDING|ADVANCE|ADV)\b/;

export const round2 = (n) => Math.round(n * 100) / 100;

export function allLines(doc) {
  const out = [];
  for (const p of doc.pages) p.lines.forEach((l, i) => out.push({ ...l, docId: doc.id, page: p.number, line: i + 1 }));
  return out;
}
export const ptr = (l) => ({ docId: l.docId, page: l.page, line: l.line, text: l.text });

// ---------- classification ----------
export function classifyDoc(doc) {
  const text = allLines(doc).map((l) => l.text.toLowerCase()).join('\n');
  const scores = {};
  for (const [type, kws] of Object.entries(CLASSIFIER_KEYWORDS)) {
    scores[type] = kws.filter((k) => text.includes(k)).length;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topType, top] = ranked[0];
  const second = ranked[1][1];
  if (top === 0) return { label: 'unknown', guess: null, confidence: 0, scores };
  const coverage = top / CLASSIFIER_KEYWORDS[topType].length;
  const margin = top / (top + second + 0.5);
  const confidence = round2(0.5 * coverage + 0.5 * margin);
  const label = confidence >= CONFIDENCE_THRESHOLD ? topType : 'unknown';
  return { label, guess: topType, confidence, scores };
}

export function classifyAll(sub, overrides = {}) {
  return sub.docs.map((doc) => {
    const c = classifyDoc(doc);
    const override = overrides[doc.id];
    return { docId: doc.id, filename: doc.filename, ...c, effective: override || c.label, overridden: !!override };
  });
}

function docsOf(sub, cls, type) {
  const ids = new Set(cls.filter((c) => c.effective === type).map((c) => c.docId));
  return sub.docs.filter((d) => ids.has(d.id));
}
function field(doc, name) {
  if (!doc) return null;
  return allLines(doc).find((l) => l.data.field === name) || null;
}

// ---------- statements ----------
export function parseStatement(doc) {
  const lines = allLines(doc);
  const period = lines.find((l) => l.data.field === 'period');
  const opening = lines.find((l) => l.data.field === 'opening');
  const closing = lines.find((l) => l.data.field === 'closing');
  const pageOf = lines.filter((l) => l.data.field === 'pageOf');
  const declaredPages = pageOf.length ? Math.max(...pageOf.map((l) => l.data.of)) : doc.pages.length;
  return {
    doc,
    period,
    start: period?.data.start,
    end: period?.data.end,
    opening,
    closing,
    tx: lines.filter((l) => l.data.field === 'tx'),
    totalDeposits: lines.find((l) => l.data.field === 'totalDeposits'),
    holder: lines.find((l) => l.data.field === 'holder'),
    address: lines.find((l) => l.data.field === 'address'),
    declaredPages,
    presentPages: doc.pages.map((p) => p.number),
  };
}

export function statementsOf(sub, cls) {
  return docsOf(sub, cls, 'bank_statement')
    .map(parseStatement)
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
}

export function missingPages(st) {
  const out = [];
  for (let p = 1; p <= st.declaredPages; p++) if (!st.presentPages.includes(p)) out.push(p);
  return out;
}

export function balanceMismatches(st) {
  const out = [];
  let expected = st.opening ? st.opening.data.value : null;
  let prevPage = st.tx[0]?.page ?? 1;
  for (const t of st.tx) {
    if (t.page !== prevPage && t.page !== prevPage + 1) expected = null; // page gap: resync
    prevPage = t.page;
    if (expected === null) {
      expected = round2(t.data.balance);
      continue;
    }
    const want = round2(expected + t.data.amount);
    if (Math.abs(want - t.data.balance) > 0.005) out.push({ line: t, expected: want, printed: t.data.balance });
    expected = t.data.balance;
  }
  if (st.closing && !missingPages(st).length) {
    const last = st.tx[st.tx.length - 1];
    if (last && Math.abs(last.data.balance - st.closing.data.value) > 0.005)
      out.push({ line: st.closing, expected: last.data.balance, printed: st.closing.data.value });
  }
  return out;
}

const dayMs = 86400000;
const toDay = (iso) => Date.parse(iso + 'T00:00:00Z') / dayMs;

export function continuityIssues(statements) {
  const out = [];
  for (let i = 1; i < statements.length; i++) {
    const a = statements[i - 1];
    const b = statements[i];
    if (!a.end || !b.start) continue;
    const gap = toDay(b.start) - toDay(a.end) - 1;
    if (gap > 0) out.push({ kind: 'date_gap', days: gap, from: a.end, to: b.start, evidence: [a.period, b.period] });
    else if (a.closing && b.opening && Math.abs(a.closing.data.value - b.opening.data.value) > 0.005)
      out.push({ kind: 'balance_chain', closing: a.closing.data.value, opening: b.opening.data.value, evidence: [a.closing, b.opening] });
  }
  return out;
}

export function dailyBalances(st) {
  if (!st.start || !st.end) return [];
  const out = [];
  let bal = st.opening ? st.opening.data.value : st.tx[0] ? round2(st.tx[0].data.balance - st.tx[0].data.amount) : 0;
  const byDay = new Map();
  for (const t of st.tx) byDay.set(t.data.date, t.data.balance);
  for (let d = toDay(st.start); d <= toDay(st.end); d++) {
    const iso = new Date(d * dayMs).toISOString().slice(0, 10);
    if (byDay.has(iso)) bal = byDay.get(iso);
    out.push({ date: iso, balance: bal });
  }
  return out;
}

export const isDeposit = (t) => t.data.amount > 0;
export const isRevenueDeposit = (t) => isDeposit(t) && !/TRANSFER FROM|LOAN PROCEEDS|ADVANCE FUNDING|REVERSAL/.test(t.data.desc);

export function nsfStats(statements) {
  const tx = statements.flatMap((s) => s.tx);
  const nsf = tx.filter((t) => /NSF/.test(t.data.desc));
  const od = tx.filter((t) => /OVERDRAFT/.test(t.data.desc));
  const negDays = statements.flatMap(dailyBalances).filter((d) => d.balance < 0);
  return { nsf, od, negDays };
}

export function detectPositions(statements) {
  const groups = new Map();
  for (const t of statements.flatMap((s) => s.tx)) {
    if (t.data.amount >= 0) continue;
    const name = t.data.desc.replace(/^ACH DEBIT\s+/, '');
    if (!/^ACH DEBIT/.test(t.data.desc) || !POSITION_PATTERN.test(name)) continue;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(t);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length >= 8)
    .map(([name, list]) => ({ name, count: list.length, daily: Math.abs(list[0].data.amount), first: list[0] }));
}

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function roundDeposits(statements) {
  return statements.flatMap((s) => s.tx).filter((t) => isDeposit(t) && t.data.amount >= 1000 && Math.round(t.data.amount * 100) % 50000 === 0);
}

export function concentration(statements) {
  const deps = statements.flatMap((s) => s.tx).filter(isDeposit);
  const total = deps.reduce((s, t) => s + t.data.amount, 0);
  const groups = new Map();
  for (const t of deps) {
    if (KNOWN_PROCESSORS.includes(t.data.desc)) continue;
    groups.set(t.data.desc, [...(groups.get(t.data.desc) || []), t]);
  }
  let top = null;
  for (const [name, list] of groups) {
    const sum = list.reduce((s, t) => s + t.data.amount, 0);
    if (!top || sum > top.sum) top = { name, sum, list };
  }
  return { total, top, share: top && total ? top.sum / total : 0 };
}

export function suddenDeposits(statements, appDate) {
  const deps = statements.flatMap((s) => s.tx).filter(isDeposit);
  const med = median(deps.map((t) => t.data.amount));
  const ref = appDate ? toDay(appDate) : statements.length ? toDay(statements[statements.length - 1].end) : 0;
  const threshold = Math.max(5000, 3 * med);
  return {
    median: med,
    threshold,
    hits: deps.filter((t) => ref - toDay(t.data.date) <= 30 && ref - toDay(t.data.date) >= 0 && t.data.amount >= threshold),
  };
}

// ---------- normalisation ----------
export function normName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(llc|inc|pc|co|corp|corporation|ltd|the|pllc|company)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function normAddress(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bsuite\b/g, 'ste')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\s+/g, ' ')
    .trim();
}
export const normEin = (s) => (s || '').replace(/\D/g, '');
export const normPerson = (s) => (s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\b[a-z]\b/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- extraction ----------
export function monthsBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

export function extract(sub, cls) {
  const app = docsOf(sub, cls, 'application')[0];
  const tax = docsOf(sub, cls, 'tax_return')[0];
  const sts = statementsOf(sub, cls);
  const f = {};
  const nameL = field(app, 'legalName') || field(tax, 'legalName');
  f.legalName = { label: 'Legal name', value: nameL?.data.value ?? null, evidence: nameL ? [ptr(nameL)] : [] };
  const einL = field(app, 'ein') || field(tax, 'ein');
  f.ein = { label: 'EIN', value: einL?.data.value ?? null, evidence: einL ? [ptr(einL)] : [] };
  const revs = sts.map((s) => ({ s, v: round2(s.tx.filter(isRevenueDeposit).reduce((a, t) => a + t.data.amount, 0)) }));
  f.monthlyRevenue = {
    label: 'Monthly revenue (avg)',
    value: revs.length ? round2(revs.reduce((a, r) => a + r.v, 0) / revs.length) : null,
    evidence: revs.filter((r) => r.s.totalDeposits).map((r) => ptr(r.s.totalDeposits)),
    note: revs.length ? `Average of ${revs.length} statement month${revs.length > 1 ? 's' : ''}, revenue deposits only` : 'No statements',
  };
  const days = sts.flatMap(dailyBalances);
  f.avgDailyBalance = {
    label: 'Average daily balance',
    value: days.length ? round2(days.reduce((a, d) => a + d.balance, 0) / days.length) : null,
    evidence: sts.filter((s) => s.period).map((s) => ptr(s.period)),
    note: `${days.length} calendar days of end-of-day balances`,
  };
  const pos = detectPositions(sts);
  f.existingPositions = {
    label: 'Existing positions',
    value: sts.length ? pos.length : null,
    names: pos.map((p) => `${p.name} (${p.count} debits of $${p.daily})`),
    evidence: pos.map((p) => ptr(p.first)),
  };
  const startL = field(app, 'startDate');
  const signedL = field(app, 'signedDate');
  f.monthsInBusiness = {
    label: 'Months in business',
    value: startL && signedL ? monthsBetween(startL.data.value, signedL.data.value) : null,
    evidence: [startL, signedL].filter(Boolean).map(ptr),
  };
  const reqL = field(app, 'requested');
  f.requested = { label: 'Requested amount', value: reqL?.data.value ?? null, evidence: reqL ? [ptr(reqL)] : [] };
  const declL = field(app, 'declaredPositions');
  f.declaredPositions = { label: 'Declared positions', value: declL?.data.value ?? null, evidence: declL ? [ptr(declL)] : [] };
  const ownerL = field(app, 'owner');
  f.owner = { label: 'Owner', value: ownerL?.data.value ?? null, evidence: ownerL ? [ptr(ownerL)] : [] };
  const nsf = nsfStats(sts);
  f.nsfCount = { label: 'NSF + overdraft items', value: sts.length ? nsf.nsf.length + nsf.od.length : null, evidence: [...nsf.nsf, ...nsf.od].slice(0, 6).map(ptr) };
  return f;
}

// ---------- scrub checks ----------
export const CHECKS = [
  { id: 'completeness', name: 'Stack completeness', category: 'Data quality', rule: 'Requires 1 application, 3 consecutive monthly bank statements ending the month before signing, 1 tax return and 1 voided check.' },
  { id: 'balance_arithmetic', name: 'Balance arithmetic', category: 'Fraud signal', rule: 'For every transaction line: previous balance + amount must equal the printed balance (to the cent); last balance must equal the closing balance.' },
  { id: 'statement_continuity', name: 'Statement continuity', category: 'Data quality', rule: 'Each statement period must start the day after the previous one ends, and its opening balance must equal the previous closing balance.' },
  { id: 'missing_pages', name: 'Missing pages', category: 'Data quality', rule: 'Every page from 1 to N declared in "Page x of N" must be present.' },
  { id: 'nsf_overdraft', name: 'NSF, overdraft and negative days', category: 'Credit', rule: 'Counts NSF fees, overdraft fees and calendar days ending below $0. Flags if any are found.' },
  { id: 'round_deposits', name: 'Round-number deposits', category: 'Fraud signal', rule: 'Flags 3 or more deposits of $1,000+ that are exact multiples of $500.' },
  { id: 'deposit_concentration', name: 'Single-source concentration', category: 'Fraud signal', rule: 'Flags when one non-processor payer supplies more than 40% of all deposits (card processors and mobile check deposits excluded).' },
  { id: 'sudden_deposit', name: 'Large deposit before application', category: 'Fraud signal', rule: 'Flags deposits within 30 days before the signing date that are at least max($5,000, 3x the median deposit).' },
  { id: 'name_match', name: 'Business name match', category: 'Fraud signal', rule: 'Normalised legal name (case, punctuation, LLC/Inc/PC removed) must match across application, statements, tax return and voided check.' },
  { id: 'address_match', name: 'Address match', category: 'Data quality', rule: 'Normalised business address (St/Ave/Ste abbreviations) must match across application, statements and tax return.' },
  { id: 'ein_match', name: 'EIN match', category: 'Fraud signal', rule: 'EIN digits on the application must equal the EIN on the tax return.' },
  { id: 'owner_match', name: 'Owner match', category: 'Fraud signal', rule: 'Owner name on the application must match the tax return officer and any ID.' },
  { id: 'position_disclosure', name: 'Position disclosure', category: 'Credit', rule: 'Positions detected from recurring funder debits must not exceed positions declared on the application.' },
];
export const CHECK_BY_ID = Object.fromEntries(CHECKS.map((c) => [c.id, c]));

const fmt = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function result(id, status, detail, evidence = []) {
  return { ...CHECK_BY_ID[id], status, detail, evidence: evidence.filter(Boolean).map((e) => (e.docId ? (e.text !== undefined && e.data === undefined ? e : ptr(e)) : e)) };
}

export function completenessCheck(sub, cls, sts) {
  const app = docsOf(sub, cls, 'application');
  const tax = docsOf(sub, cls, 'tax_return');
  const chk = docsOf(sub, cls, 'voided_check');
  const unknown = cls.filter((c) => c.effective === 'unknown');
  const missing = [];
  if (!app.length) missing.push('application');
  if (!tax.length) missing.push('tax return');
  if (!chk.length) missing.push('voided check');
  const signed = field(app[0], 'signedDate')?.data.value;
  const need = signed ? expectedMonths(signed) : null;
  const have = sts.map((s) => s.start?.slice(0, 7));
  const missingMonths = need ? need.filter((m) => !have.includes(m)) : sts.length >= 3 ? [] : ['3 months'];
  if (missingMonths.length) missing.push(`statement ${missingMonths.join(', ')}`);
  if (unknown.length) missing.push(`${unknown.length} unclassified document${unknown.length > 1 ? 's' : ''}`);
  return result(
    'completeness',
    missing.length ? 'flag' : 'pass',
    missing.length ? `Missing: ${missing.join('; ')}` : `All required documents present (${sub.docs.length} files)`,
    unknown.map((u) => ({ docId: u.docId, page: 1, line: 1, text: u.filename })),
  );
}
export function expectedMonths(signed) {
  const [y, m] = signed.split('-').map(Number);
  const out = [];
  for (let i = 3; i >= 1; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function runChecks(sub, cls) {
  const sts = statementsOf(sub, cls);
  const app = docsOf(sub, cls, 'application')[0];
  const tax = docsOf(sub, cls, 'tax_return')[0];
  const chk = docsOf(sub, cls, 'voided_check')[0];
  const idd = docsOf(sub, cls, 'id')[0];
  const out = [completenessCheck(sub, cls, sts)];
  const noSt = (id) => result(id, 'na', 'No bank statements classified; check could not run');

  if (!sts.length) out.push(noSt('balance_arithmetic'));
  else {
    const mm = sts.flatMap(balanceMismatches);
    out.push(
      result('balance_arithmetic', mm.length ? 'flag' : 'pass',
        mm.length
          ? `${mm.length} line${mm.length > 1 ? 's' : ''} where the printed balance does not follow: expected ${fmt(mm[0].expected)}, printed ${fmt(mm[0].printed)}`
          : `${sts.reduce((a, s) => a + s.tx.length, 0)} transaction lines re-computed across ${sts.length} statements; all balances reconcile`,
        mm.map((m) => m.line)),
    );
  }
  if (sts.length < 2) out.push(result('statement_continuity', sts.length ? 'na' : 'na', 'Needs at least 2 statements'));
  else {
    const ci = continuityIssues(sts);
    out.push(
      result('statement_continuity', ci.length ? 'flag' : 'pass',
        ci.length
          ? ci.map((c) => (c.kind === 'date_gap' ? `${c.days}-day gap between ${c.from} and ${c.to}` : `Closing ${fmt(c.closing)} does not equal next opening ${fmt(c.opening)}`)).join('; ')
          : `${sts.length} statements run back to back and balances chain`,
        ci.flatMap((c) => c.evidence)),
    );
  }
  if (!sts.length) out.push(noSt('missing_pages'));
  else {
    const mp = sts.map((s) => ({ s, pages: missingPages(s) })).filter((x) => x.pages.length);
    out.push(
      result('missing_pages', mp.length ? 'flag' : 'pass',
        mp.length ? mp.map((x) => `${x.s.doc.filename}: page ${x.pages.join(', ')} of ${x.s.declaredPages} missing`).join('; ') : 'All declared pages present',
        mp.map((x) => allLines(x.s.doc).find((l) => l.data.field === 'pageOf'))),
    );
  }
  if (!sts.length) out.push(noSt('nsf_overdraft'));
  else {
    const n = nsfStats(sts);
    const any = n.nsf.length + n.od.length + n.negDays.length;
    out.push(
      result('nsf_overdraft', any ? 'flag' : 'pass', `${n.nsf.length} NSF, ${n.od.length} overdraft, ${n.negDays.length} negative day${n.negDays.length === 1 ? '' : 's'}`, [...n.nsf, ...n.od].slice(0, 8)),
    );
  }
  if (!sts.length) out.push(noSt('round_deposits'));
  else {
    const rd = roundDeposits(sts);
    out.push(result('round_deposits', rd.length >= 3 ? 'flag' : 'pass', `${rd.length} round-number deposit${rd.length === 1 ? '' : 's'} of $1,000+${rd.length ? ': ' + rd.slice(0, 4).map((t) => fmt(t.data.amount)).join(', ') : ''}`, rd.length >= 3 ? rd : []));
  }
  if (!sts.length) out.push(noSt('deposit_concentration'));
  else {
    const c = concentration(sts);
    const pct = Math.round(c.share * 100);
    out.push(result('deposit_concentration', c.share > 0.4 ? 'flag' : 'pass', c.top ? `Largest non-processor source: ${c.top.name}, ${pct}% of deposits` : 'All deposits come from card processors', c.share > 0.4 ? c.top.list.slice(0, 6) : []));
  }
  if (!sts.length) out.push(noSt('sudden_deposit'));
  else {
    const sd = suddenDeposits(sts, field(app, 'signedDate')?.data.value);
    out.push(result('sudden_deposit', sd.hits.length ? 'flag' : 'pass', sd.hits.length ? `${sd.hits.length} deposit${sd.hits.length > 1 ? 's' : ''} at or above ${fmt(sd.threshold)} in the 30 days before signing (median deposit ${fmt(sd.median)})` : `No deposit at or above ${fmt(sd.threshold)} in the 30 days before signing`, sd.hits));
  }
  // cross-document
  const nameSources = [
    ['Application', field(app, 'legalName')],
    ...sts.map((s) => [s.doc.filename, s.holder]),
    ['Tax return', field(tax, 'legalName')],
    ['Voided check', field(chk, 'legalName')],
  ].filter(([, l]) => l);
  out.push(crossCheck('name_match', nameSources, normName));
  const addrSources = [['Application', field(app, 'address')], ...sts.map((s) => [s.doc.filename, s.address]), ['Tax return', field(tax, 'address')]].filter(([, l]) => l);
  out.push(crossCheck('address_match', addrSources, normAddress));
  out.push(crossCheck('ein_match', [['Application', field(app, 'ein')], ['Tax return', field(tax, 'ein')]].filter(([, l]) => l), normEin));
  out.push(crossCheck('owner_match', [['Application', field(app, 'owner')], ['Tax return', field(tax, 'owner')], ['ID', field(idd, 'owner')]].filter(([, l]) => l), normPerson));
  if (!sts.length || !app) out.push(result('position_disclosure', 'na', 'Needs an application and statements'));
  else {
    const det = detectPositions(sts);
    const decl = field(app, 'declaredPositions');
    const over = det.length > decl.data.value;
    out.push(result('position_disclosure', over ? 'flag' : 'pass', `${det.length} detected from statements vs ${decl.data.value} declared${det.length ? ': ' + det.map((d) => d.name).join(', ') : ''}`, over ? [decl, ...det.map((d) => d.first)] : []));
  }
  return out;
}

function crossCheck(id, sources, norm) {
  if (sources.length < 2) return result(id, 'na', 'Fewer than 2 documents carry this field');
  const base = norm(sources[0][1].data.value);
  const diff = sources.filter(([, l]) => norm(l.data.value) !== base);
  if (!diff.length) return result(id, 'pass', `Matches across ${sources.length} documents`);
  return result(id, 'flag', diff.map(([n, l]) => `${n} says "${l.data.value}" vs application "${sources[0][1].data.value}"`).join('; '), [sources[0][1], ...diff.map(([, l]) => l)]);
}

// ---------- credit policy ----------
export const POLICY = [
  { id: 'min_tib', name: 'Time in business', where: 'months in business', op: 'is at least', value: 12, field: 'monthsInBusiness', test: (v, p) => v >= p, unit: 'months' },
  { id: 'min_revenue', name: 'Monthly revenue', where: 'monthly revenue', op: 'is at least', value: 20000, field: 'monthlyRevenue', test: (v, p) => v >= p, unit: '$' },
  { id: 'max_nsf', name: 'NSF and overdrafts', where: 'NSF + overdraft items (3 mo)', op: 'is at most', value: 3, field: 'nsfCount', test: (v, p) => v <= p, unit: 'items' },
  { id: 'max_positions', name: 'Existing positions', where: 'existing positions', op: 'is at most', value: 2, field: 'existingPositions', test: (v, p) => v <= p, unit: 'positions' },
  { id: 'min_adb', name: 'Average daily balance', where: 'average daily balance', op: 'is at least', value: 2500, field: 'avgDailyBalance', test: (v, p) => v >= p, unit: '$' },
  { id: 'max_ask', name: 'Ask vs revenue', where: 'requested ÷ monthly revenue', op: 'is at most', value: 1.5, field: null, test: (v, p) => v <= p, unit: 'x' },
];

export function evaluatePolicy(fields) {
  return POLICY.map((r) => {
    let v = r.field ? fields[r.field]?.value : null;
    let evidence = r.field ? fields[r.field]?.evidence || [] : [];
    if (r.id === 'max_ask') {
      const req = fields.requested?.value;
      const rev = fields.monthlyRevenue?.value;
      v = req != null && rev ? round2(req / rev) : null;
      evidence = [...(fields.requested?.evidence || []), ...(fields.monthlyRevenue?.evidence || [])];
    }
    if (v === null || v === undefined) return { ...r, status: 'unknown', actual: null, reason: 'Input not available from the documents', evidence };
    const ok = r.test(v, r.value);
    const show = (x) => (r.unit === '$' ? fmt(x) : r.unit === 'x' ? `${x}x` : `${x} ${r.unit}`);
    return { ...r, status: ok ? 'pass' : 'fail', actual: v, reason: `${show(v)} ${ok ? 'meets' : 'breaks'} "${r.op} ${show(r.value)}"`, evidence };
  });
}

// ---------- pipeline ----------
export function runPipeline(sub, overrides = {}) {
  const classification = classifyAll(sub, overrides);
  const fields = extract(sub, classification);
  const checks = runChecks(sub, classification);
  const policy = evaluatePolicy(fields);
  const flags = checks.filter((c) => c.status === 'flag');
  return { classification, fields, checks, policy, flags, complete: checks[0].status === 'pass' };
}

export function resolveEvidence(sub, e) {
  const doc = sub.docs.find((d) => d.id === e.docId);
  const page = doc?.pages.find((p) => p.number === e.page);
  return page?.lines[e.line - 1] || null;
}
