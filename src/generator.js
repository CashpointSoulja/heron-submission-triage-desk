// Deterministic synthetic document generator. Every business, broker, bank and
// person produced here is fictional.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const round2 = (n) => Math.round(n * 100) / 100;
export const money = (n) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (n) => (n >= 0 ? '+' : '-') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plain = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
const pad = (n) => String(n).padStart(2, '0');
const isoDay = (ym, d) => `${ym}-${pad(d)}`;
function weekday(ym, d) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function businessDays(ym) {
  const out = [];
  for (let d = 1; d <= daysInMonth(ym); d++) {
    const w = weekday(ym, d);
    if (w !== 0 && w !== 6) out.push(d);
  }
  return out;
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function weighted(r, items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let x = r() * total;
  for (const i of items) {
    if ((x -= i.weight) <= 0) return i;
  }
  return items[items.length - 1];
}

const TX_PER_PAGE = 22;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function genTransactions(r, spec, ym, mIdx) {
  const p = spec.profile;
  const tx = [];
  const bdays = businessDays(ym);
  const revenue = p.revenue * (0.92 + 0.16 * r());
  const n = p.depositsPerMonth || 18;
  for (let i = 0; i < n; i++) {
    const src = weighted(r, p.sources);
    tx.push({ day: pick(r, bdays), desc: src.name, amount: round2((revenue / n) * (0.6 + 0.8 * r())) });
  }
  const spend = revenue * (p.expenseRatio || 0.9);
  const rent = round2(spend * 0.14);
  tx.push({ day: bdays[0], desc: `RENT ${p.landlord || 'OAKMONT PROPERTIES'}`, amount: -rent });
  const payroll = round2(spend * 0.18);
  tx.push({ day: bdays[Math.min(9, bdays.length - 1)], desc: 'PAYROLL BRIGHTLEDGER PAYROLL', amount: -payroll });
  tx.push({ day: bdays[bdays.length - 1], desc: 'PAYROLL BRIGHTLEDGER PAYROLL', amount: -round2(payroll * (0.95 + 0.1 * r())) });
  let positionTotal = 0;
  for (const pos of p.positions || []) {
    for (const d of bdays) {
      tx.push({ day: d, desc: `ACH DEBIT ${pos.name}`, amount: -pos.daily });
      positionTotal += pos.daily;
    }
  }
  const suppliers = p.suppliers || ['RESTAURANT DEPOT', 'CITY UTILITIES', 'NORTHSTAR INSURANCE'];
  let remaining = spend - rent - payroll * 2 - positionTotal;
  const k = 8;
  for (let i = 0; i < k; i++) {
    const amt = round2(Math.max(40, (remaining / k) * (0.6 + 0.8 * r())));
    tx.push({ day: pick(r, bdays), desc: pick(r, suppliers), amount: -amt });
  }
  for (const f of Array.from({ length: (p.nsf || [])[mIdx] || 0 })) {
    void f;
    tx.push({ day: pick(r, bdays), desc: 'NSF RETURNED ITEM FEE', amount: -35 });
  }
  for (const x of spec.extraDeposits || []) {
    if (x.month === mIdx) tx.push({ day: x.day, desc: x.desc, amount: x.amount });
  }
  tx.sort((a, b) => a.day - b.day || b.amount - a.amount);
  return tx;
}

function buildStatement(spec, ym, mIdx, opening, r) {
  const tx = genTransactions(r, spec, ym, mIdx);
  let bal = opening;
  const rows = [];
  const forgery = spec.defects?.consistentForgery;
  let depositIdx = 0;
  for (const t of tx) {
    if (forgery && forgery.month === mIdx && t.amount > 0 && depositIdx++ === forgery.nthDeposit) {
      t.amount = round2(t.amount + forgery.delta);
    }
    bal = round2(bal + t.amount);
    rows.push({ ...t, date: isoDay(ym, t.day), balance: bal });
    if (bal < 0 && t.amount < 0 && !/OVERDRAFT/.test(t.desc)) {
      bal = round2(bal - 36);
      rows.push({ day: t.day, date: isoDay(ym, t.day), desc: 'OVERDRAFT FEE', amount: -36, balance: bal });
    }
  }
  return { ym, opening, closing: bal, rows };
}

function statementDoc(spec, st, idx, last4) {
  const b = spec.business;
  const holder = spec.defects?.statementHolder || b.legalName.toUpperCase();
  const address = spec.defects?.statementAddress || b.address;
  const days = daysInMonth(st.ym);
  const start = isoDay(st.ym, 1);
  const end = isoDay(st.ym, days);
  const bank = spec.bank || 'HARBORLINE COMMUNITY BANK';
  const pagesCount = Math.max(1, Math.ceil(st.rows.length / TX_PER_PAGE));
  const pages = [];
  const deposits = round2(st.rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0));
  const withdrawals = round2(st.rows.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  for (let p = 0; p < pagesCount; p++) {
    const lines = [];
    if (p === 0) {
      lines.push({ text: bank, data: { field: 'bank', value: bank } });
      lines.push({ text: 'Business Checking Statement', data: { field: 'title' } });
      lines.push({ text: `Account holder: ${holder}`, data: { field: 'holder', value: holder } });
      lines.push({ text: `Address: ${address}`, data: { field: 'address', value: address } });
      lines.push({ text: `Account number: ****${last4}`, data: { field: 'account', value: last4 } });
      lines.push({ text: `Statement period: ${start} to ${end}`, data: { field: 'period', start, end } });
      lines.push({ text: `Opening balance: ${money(st.opening)}`, data: { field: 'opening', value: st.opening } });
    } else {
      lines.push({ text: `${bank} · ****${last4} · continued`, data: { field: 'title' } });
    }
    lines.push({ text: `Page ${p + 1} of ${pagesCount}`, data: { field: 'pageOf', page: p + 1, of: pagesCount } });
    for (const t of st.rows.slice(p * TX_PER_PAGE, (p + 1) * TX_PER_PAGE)) {
      const [, mm, dd] = t.date.split('-');
      lines.push({
        text: `${mm}/${dd}  ${t.desc}  ${signed(t.amount)}  ${plain(t.balance)}`,
        data: { field: 'tx', date: t.date, desc: t.desc, amount: t.amount, balance: t.balance },
      });
    }
    if (p === pagesCount - 1) {
      lines.push({ text: `Total deposits: ${money(deposits)}`, data: { field: 'totalDeposits', value: deposits } });
      lines.push({ text: `Total withdrawals: ${money(withdrawals)}`, data: { field: 'totalWithdrawals', value: withdrawals } });
      lines.push({ text: `Closing balance: ${money(st.closing)}`, data: { field: 'closing', value: st.closing } });
    }
    pages.push({ number: p + 1, lines });
  }
  const [y, m] = st.ym.split('-');
  return {
    kind: 'bank_statement',
    filename: (spec.filenames?.statement || ((mn, yy) => `${mn}_${yy}_statement.pdf`))(MONTH_NAMES[+m - 1], y, idx),
    month: st.ym,
    pages,
  };
}

function applicationDoc(spec) {
  const b = spec.business;
  const positions = spec.declaredPositions ?? (spec.profile.positions || []).length;
  const L = [
    ['title', 'MERIDIAN CAPITAL FUNDING · Merchant Cash Advance Application'],
    ['broker', `Submitted by broker: ${spec.broker.name} (${spec.broker.contact})`],
    ['legalName', `Legal business name: ${b.legalName}`, b.legalName],
    ['dba', `DBA: ${b.dba || 'None'}`, b.dba || ''],
    ['ein', `EIN: ${b.ein}`, b.ein],
    ['address', `Business address: ${b.address}`, b.address],
    ['startDate', `Business start date: ${b.startDate}`, b.startDate],
    ['industry', `Industry: ${b.industry}`, b.industry],
    ['owner', `Owner name: ${b.owner}`, b.owner],
    ['ownership', 'Ownership %: 100'],
    ['requested', `Requested amount: ${money(spec.requested)}`, spec.requested],
    ['statedRevenue', `Stated monthly revenue: ${money(spec.statedRevenue || spec.profile.revenue)}`, spec.statedRevenue || spec.profile.revenue],
    ['declaredPositions', `Existing advances or positions: ${positions}`, positions],
    ['useOfFunds', `Use of funds: ${spec.useOfFunds || 'Working capital'}`],
    ['signedDate', `Signed: /s/ ${b.owner} on ${spec.applicationDate}`, spec.applicationDate],
  ];
  return {
    kind: 'application',
    filename: spec.filenames?.application || 'MCA_application_signed.pdf',
    pages: [{ number: 1, lines: L.map(([field, text, value]) => ({ text, data: { field, value } })) }],
  };
}

function taxDoc(spec, annualReceipts, garbled) {
  const b = spec.business;
  const ein = spec.defects?.taxEin || b.ein;
  const name = spec.defects?.taxName || b.legalName;
  const owner = spec.defects?.taxOwner || b.owner;
  const L = [
    ['title', garbled ? 'F0RM 11?0-S  U.S. lnc0m3 T#x R3turn' : 'FORM 1120-S  U.S. Income Tax Return for an S Corporation'],
    ['taxYear', garbled ? 'T#x y3ar: 2O25' : 'Tax year: 2025', 2025],
    ['legalName', `Name: ${name}`, name],
    ['ein', garbled ? `EIN ${ein}` : `Employer identification number: ${ein}`, ein],
    ['address', `Address: ${spec.defects?.taxAddress || b.address}`, spec.defects?.taxAddress || b.address],
    ['grossReceipts', `Gross receipts or sales: ${money(annualReceipts)}`, annualReceipts],
    ['totalIncome', `Total income (loss): ${money(round2(annualReceipts * 0.11))}`, round2(annualReceipts * 0.11)],
    ['owner', `Officer: ${owner}`, owner],
  ];
  return {
    kind: 'tax_return',
    quality: garbled ? 'photo' : 'digital',
    filename: garbled ? 'scan_0007.jpg' : spec.filenames?.tax || '2025_business_tax_return.pdf',
    pages: [{ number: 1, lines: L.map(([field, text, value]) => ({ text, data: { field, value } })) }],
  };
}

function checkDoc(spec, last4) {
  const b = spec.business;
  const L = [
    ['legalName', b.legalName.toUpperCase(), b.legalName],
    ['address', b.address, b.address],
    ['payTo', 'PAY TO THE ORDER OF ______________________'],
    ['void', 'VOID  VOID  VOID'],
    ['memo', 'MEMO ____________'],
    ['routing', `Routing 0${(spec.seed % 90000000) + 10000000}  Account ****${last4}`, last4],
  ];
  return {
    kind: 'voided_check',
    filename: spec.filenames?.check || 'voided_check.jpg',
    quality: 'photo',
    pages: [{ number: 1, lines: L.map(([field, text, value]) => ({ text, data: { field, value } })) }],
  };
}

function idDoc(spec) {
  const b = spec.business;
  const L = [
    ['title', 'STATE OF NEW JERSEY · DRIVER LICENSE'],
    ['owner', `Name: ${b.owner}`, b.owner],
    ['dob', 'Date of birth: 1984-03-11'],
    ['class', 'Class D · Expires 2029-03-11'],
    ['dlno', 'DL no: S0000-00000-00000 (specimen)'],
  ];
  return {
    kind: 'id',
    filename: spec.filenames?.id || 'IMG_4471.jpg',
    quality: 'photo',
    pages: [{ number: 1, lines: L.map(([field, text, value]) => ({ text, data: { field, value } })) }],
  };
}

export function prevMonths(applicationDate, n) {
  const [y, m] = applicationDate.split('-').map(Number);
  const out = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  return out;
}

export function buildSubmission(spec) {
  const r = rng(spec.seed);
  const months = prevMonths(spec.applicationDate, 3);
  const last4 = String(1000 + (spec.seed % 9000));
  let opening = spec.profile.opening;
  const statements = months.map((ym, i) => {
    const st = buildStatement(spec, ym, i, opening, r);
    opening = st.closing;
    return st;
  });
  const d = spec.defects || {};
  const docs = [];
  if (!d.missingDocs?.includes('application')) docs.push(applicationDoc(spec));
  statements.forEach((st, i) => {
    if (d.dropMonth === i) return;
    const doc = statementDoc(spec, st, i, last4);
    if (d.doctoredBalance && d.doctoredBalance.month === i) {
      const txLines = doc.pages.flatMap((p) => p.lines).filter((l) => l.data.field === 'tx' && l.data.amount > 0);
      const line = txLines[d.doctoredBalance.nthDeposit];
      const a = round2(line.data.amount + d.doctoredBalance.delta);
      const [, mm, dd] = line.data.date.split('-');
      line.data = { ...line.data, amount: a };
      line.text = `${mm}/${dd}  ${line.data.desc}  ${signed(a)}  ${plain(line.data.balance)}`;
    }
    if (d.missingPage && d.missingPage.month === i) {
      doc.pages = doc.pages.filter((p) => p.number !== d.missingPage.page);
    }
    docs.push(doc);
  });
  const annual = round2(spec.profile.revenue * 12 * (spec.taxRatio || 0.97));
  if (!d.missingDocs?.includes('tax_return')) docs.push(taxDoc(spec, annual, d.garbledTax));
  if (!d.missingDocs?.includes('voided_check')) docs.push(checkDoc(spec, last4));
  if (spec.includeId) docs.push(idDoc(spec));
  const order = spec.docOrder || docs.map((_, i) => i);
  const ordered = order.map((i) => docs[i]).filter(Boolean);
  ordered.forEach((doc, i) => (doc.id = `${spec.id}-D${i + 1}`));
  return {
    id: spec.id,
    business: spec.business,
    broker: spec.broker,
    requested: spec.requested,
    applicationDate: spec.applicationDate,
    receivedMinsAgo: spec.receivedMinsAgo ?? 30,
    subject: spec.subject || `New sub: ${spec.business.dba || spec.business.legalName} · ${money(spec.requested)}`,
    docs: ordered,
    truth: { statements, defects: d },
  };
}
