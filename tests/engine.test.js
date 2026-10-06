import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import { buildSubmission, rng, prevMonths, daysInMonth } from '../src/generator.js';
import { SPECS, SUBMISSIONS } from '../src/scenario.js';

const L = (data, page = 1, line = 1, docId = 'X') => ({ text: '', data, page, line, docId });
const tx = (date, amount, balance, page = 1, desc = 'SQUARE INC DEPOSIT') => L({ field: 'tx', date, desc, amount, balance }, page);
const st = (over = {}) => ({
  doc: { id: 'X', filename: 'x.pdf', pages: [] },
  start: '2026-06-01', end: '2026-06-30',
  period: L({ field: 'period', start: '2026-06-01', end: '2026-06-30' }),
  opening: L({ field: 'opening', value: 100 }),
  closing: L({ field: 'closing', value: 150 }),
  tx: [tx('2026-06-02', 100, 200), tx('2026-06-03', -50, 150)],
  declaredPages: 1, presentPages: [1],
  ...over,
});
const findSub = (id) => SUBMISSIONS.find((s) => s.id === id);
const check = (r, id) => r.checks.find((c) => c.id === id);

describe('generator', () => {
  test('rng is deterministic', () => {
    const a = rng(5), b = rng(5);
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  });
  test('rng differs by seed', () => assert.notEqual(rng(1)(), rng(2)()));
  test('rng stays in [0,1)', () => {
    const r = rng(9);
    for (let i = 0; i < 500; i++) { const x = r(); assert.ok(x >= 0 && x < 1); }
  });
  test('prevMonths returns the 3 months before signing', () => assert.deepEqual(prevMonths('2026-09-28', 3), ['2026-06', '2026-07', '2026-08']));
  test('prevMonths crosses year boundary', () => assert.deepEqual(prevMonths('2026-02-10', 3), ['2025-11', '2025-12', '2026-01']));
  test('daysInMonth handles February', () => assert.equal(daysInMonth('2028-02'), 29));
  test('same spec builds identical submission', () => assert.deepEqual(buildSubmission(SPECS[0]), buildSubmission(SPECS[0])));
  test('scenario has 12 submissions', () => assert.equal(SUBMISSIONS.length, 12));
  test('submission ids are unique', () => assert.equal(new Set(SUBMISSIONS.map((s) => s.id)).size, 12));
  test('document ids are unique across scenario', () => {
    const ids = SUBMISSIONS.flatMap((s) => s.docs.map((d) => d.id));
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('balance arithmetic', () => {
  test('clean statement reconciles', () => assert.equal(E.balanceMismatches(st()).length, 0));
  test('detects a printed balance that does not follow', () => {
    const s = st({ tx: [tx('2026-06-02', 100, 200), tx('2026-06-03', -50, 160)], closing: L({ field: 'closing', value: 160 }) });
    const m = E.balanceMismatches(s);
    assert.equal(m.length, 1);
    assert.equal(m[0].expected, 150);
    assert.equal(m[0].printed, 160);
  });
  test('detects an inflated amount', () => {
    const s = st({ tx: [tx('2026-06-02', 400, 200), tx('2026-06-03', -50, 150)] });
    assert.equal(E.balanceMismatches(s).length, 1);
  });
  test('detects closing balance mismatch', () => {
    const m = E.balanceMismatches(st({ closing: L({ field: 'closing', value: 999 }) }));
    assert.equal(m.length, 1);
    assert.equal(m[0].printed, 999);
  });
  test('tolerates float noise below a cent', () => {
    const s = st({ opening: L({ field: 'opening', value: 0.1 }), tx: [tx('2026-06-02', 0.2, 0.3)], closing: L({ field: 'closing', value: 0.3 }) });
    assert.equal(E.balanceMismatches(s).length, 0);
  });
  test('flags a one-cent difference', () => {
    const s = st({ tx: [tx('2026-06-02', 100, 200.01), tx('2026-06-03', -50, 150.01)], closing: L({ field: 'closing', value: 150.01 }) });
    assert.equal(E.balanceMismatches(s).length, 1);
  });
  test('resyncs across a missing page instead of double-flagging', () => {
    const s = st({ tx: [tx('2026-06-02', 100, 200, 1), tx('2026-06-20', -10, 500, 3), tx('2026-06-21', -10, 490, 3)], declaredPages: 3, presentPages: [1, 3] });
    assert.equal(E.balanceMismatches(s).length, 0);
  });
  test('skips closing comparison when pages are missing', () => {
    const s = st({ closing: L({ field: 'closing', value: 999 }), declaredPages: 2, presentPages: [1] });
    assert.equal(E.balanceMismatches(s).length, 0);
  });
  test('without opening balance, first line seeds the chain', () => {
    const s = st({ opening: null, tx: [tx('2026-06-02', 100, 700), tx('2026-06-03', -50, 650)], closing: L({ field: 'closing', value: 650 }) });
    assert.equal(E.balanceMismatches(s).length, 0);
  });
  test('Bluewave doctored statement is flagged', () => assert.equal(check(E.runPipeline(findSub('SUB-2047')), 'balance_arithmetic').status, 'flag'));
  test('Bluewave flag cites a transaction line', () => {
    const c = check(E.runPipeline(findSub('SUB-2047')), 'balance_arithmetic');
    assert.match(c.evidence[0].text, /^\d\d\/\d\d /);
  });
});

describe('statement continuity', () => {
  const a = st();
  test('back-to-back statements pass', () => {
    const b = st({ start: '2026-07-01', end: '2026-07-31', opening: L({ field: 'opening', value: 150 }) });
    assert.equal(E.continuityIssues([a, b]).length, 0);
  });
  test('detects a date gap', () => {
    const b = st({ start: '2026-08-01', end: '2026-08-31' });
    const i = E.continuityIssues([a, b]);
    assert.equal(i[0].kind, 'date_gap');
    assert.equal(i[0].days, 31);
  });
  test('detects a broken balance chain', () => {
    const b = st({ start: '2026-07-01', end: '2026-07-31', opening: L({ field: 'opening', value: 151 }) });
    assert.equal(E.continuityIssues([a, b])[0].kind, 'balance_chain');
  });
  test('one-day gap is reported as 1 day', () => {
    const b = st({ start: '2026-07-02', end: '2026-07-31' });
    assert.equal(E.continuityIssues([a, b])[0].days, 1);
  });
  test('Greenleaf withheld month is flagged', () => assert.equal(check(E.runPipeline(findSub('SUB-2048')), 'statement_continuity').status, 'flag'));
  test('Tidewater statements chain cleanly', () => assert.equal(check(E.runPipeline(findSub('SUB-2049')), 'statement_continuity').status, 'pass'));
});

describe('missing pages', () => {
  test('none missing', () => assert.deepEqual(E.missingPages(st()), []));
  test('middle page missing', () => assert.deepEqual(E.missingPages(st({ declaredPages: 3, presentPages: [1, 3] })), [2]));
  test('several missing', () => assert.deepEqual(E.missingPages(st({ declaredPages: 4, presentPages: [1] })), [2, 3, 4]));
  test('Copperline missing page flagged', () => assert.equal(check(E.runPipeline(findSub('SUB-2045')), 'missing_pages').status, 'flag'));
  test('Copperline detail names the page', () => assert.match(check(E.runPipeline(findSub('SUB-2045')), 'missing_pages').detail, /page 2 of 2 missing/));
});

describe('NSF, overdraft and negative days', () => {
  const s = (rows) => st({ tx: rows });
  test('counts NSF fees', () => assert.equal(E.nsfStats([s([tx('2026-06-02', -35, 65, 1, 'NSF RETURNED ITEM FEE')])]).nsf.length, 1));
  test('counts overdraft fees', () => assert.equal(E.nsfStats([s([tx('2026-06-02', -36, 64, 1, 'OVERDRAFT FEE')])]).od.length, 1));
  test('counts negative days and carries balance forward', () => {
    const n = E.nsfStats([s([tx('2026-06-10', -200, -100)])]);
    assert.equal(n.negDays.length, 21);
  });
  test('clean statement has zero items', () => {
    const n = E.nsfStats([st()]);
    assert.equal(n.nsf.length + n.od.length + n.negDays.length, 0);
  });
  test('dailyBalances covers every calendar day', () => assert.equal(E.dailyBalances(st()).length, 30));
  test('dailyBalances starts from opening', () => assert.equal(E.dailyBalances(st())[0].balance, 100));
  test('Ironworks fails max NSF policy', () => assert.equal(E.runPipeline(findSub('SUB-2043')).policy.find((p) => p.id === 'max_nsf').status, 'fail'));
  test('Rolling Feast has no NSF items', () => assert.equal(check(E.runPipeline(findSub('SUB-2041')), 'nsf_overdraft').status, 'pass'));
});

describe('deposit analysis', () => {
  const dep = (amount, desc = 'WIRE IN X', date = '2026-06-10') => tx(date, amount, 0, 1, desc);
  test('round deposit: exact $500 multiple over $1,000', () => assert.equal(E.roundDeposits([st({ tx: [dep(1500)] })]).length, 1));
  test('round deposit ignores cents', () => assert.equal(E.roundDeposits([st({ tx: [dep(1500.01)] })]).length, 0));
  test('round deposit ignores small amounts', () => assert.equal(E.roundDeposits([st({ tx: [dep(500)] })]).length, 0));
  test('round deposit ignores $100 multiples that are not $500 multiples', () => assert.equal(E.roundDeposits([st({ tx: [dep(1200)] })]).length, 0));
  test('round deposit ignores withdrawals', () => assert.equal(E.roundDeposits([st({ tx: [dep(-5000)] })]).length, 0));
  test('concentration excludes card processors', () => {
    const c = E.concentration([st({ tx: [dep(9000, 'SQUARE INC DEPOSIT'), dep(1000, 'WIRE IN A')] })]);
    assert.equal(c.top.name, 'WIRE IN A');
    assert.equal(c.share, 0.1);
  });
  test('concentration excludes mobile check deposits', () => {
    const c = E.concentration([st({ tx: [dep(9000, 'MOBILE DEPOSIT CHECK')] })]);
    assert.equal(c.top, null);
  });
  test('concentration share above 40% is computed', () => {
    const c = E.concentration([st({ tx: [dep(6000, 'ACH CREDIT ONE'), dep(4000, 'SQUARE INC DEPOSIT')] })]);
    assert.equal(c.share, 0.6);
  });
  test('sudden deposit within 30 days and over threshold', () => {
    const s = st({ tx: [dep(1000, 'A', '2026-06-01'), dep(1100, 'A', '2026-06-02'), dep(9000, 'B', '2026-06-25')] });
    assert.equal(E.suddenDeposits([s], '2026-06-30').hits.length, 1);
  });
  test('sudden deposit ignores deposits older than 30 days', () => {
    const s = st({ tx: [dep(1000, 'A', '2026-06-01'), dep(9000, 'B', '2026-06-02')] });
    assert.equal(E.suddenDeposits([s], '2026-07-15').hits.length, 0);
  });
  test('sudden deposit threshold floors at $5,000', () => {
    const s = st({ tx: [dep(100, 'A', '2026-06-18'), dep(100, 'A', '2026-06-19'), dep(100, 'A', '2026-06-20'), dep(4000, 'B', '2026-06-25')] });
    assert.equal(E.suddenDeposits([s], '2026-06-30').threshold, 5000);
    assert.equal(E.suddenDeposits([s], '2026-06-30').hits.length, 0);
  });
  test('sudden deposit threshold is 3x median when higher', () => {
    const s = st({ tx: [dep(3000, 'A'), dep(3000, 'A'), dep(3000, 'A')] });
    assert.equal(E.suddenDeposits([s], '2026-06-30').threshold, 9000);
  });
  test('isRevenueDeposit excludes internal transfers', () => assert.equal(E.isRevenueDeposit(dep(500, 'TRANSFER FROM SAVINGS')), false));
  test('isRevenueDeposit keeps processor payouts', () => assert.equal(E.isRevenueDeposit(dep(500, 'STRIPE PAYOUT')), true));
  test('Northpeak round-number wires flagged', () => assert.equal(check(E.runPipeline(findSub('SUB-2044')), 'round_deposits').status, 'flag'));
  test('Northpeak large pre-application wire flagged', () => assert.equal(check(E.runPipeline(findSub('SUB-2044')), 'sudden_deposit').status, 'flag'));
});

describe('positions', () => {
  const debit = (desc, i) => tx(`2026-06-${String(i + 1).padStart(2, '0')}`, -100, 0, 1, desc);
  test('recurring funder debits become a position', () => {
    const p = E.detectPositions([st({ tx: Array.from({ length: 10 }, (_, i) => debit('ACH DEBIT RAPIDLANE CAPITAL', i)) })]);
    assert.equal(p.length, 1);
    assert.equal(p[0].count, 10);
  });
  test('fewer than 8 debits is not a position', () => {
    assert.equal(E.detectPositions([st({ tx: Array.from({ length: 7 }, (_, i) => debit('ACH DEBIT RAPIDLANE CAPITAL', i)) })]).length, 0);
  });
  test('non-funder ACH debits are ignored', () => {
    assert.equal(E.detectPositions([st({ tx: Array.from({ length: 12 }, (_, i) => debit('ACH DEBIT CITY WATER', i)) })]).length, 0);
  });
  test('Saffron Table shows 3 detected positions', () => assert.equal(E.runPipeline(findSub('SUB-2046')).fields.existingPositions.value, 3));
  test('Saffron Table under-declared positions flagged', () => assert.equal(check(E.runPipeline(findSub('SUB-2046')), 'position_disclosure').status, 'flag'));
  test('Saffron Table fails max positions policy', () => assert.equal(E.runPipeline(findSub('SUB-2046')).policy.find((p) => p.id === 'max_positions').status, 'fail'));
});

describe('normalisation and cross-document checks', () => {
  test('normName strips entity suffix and case', () => assert.equal(E.normName('ROLLING FEAST FOOD TRUCKS LLC'), E.normName('Rolling Feast Food Trucks, LLC')));
  test('normName keeps real differences', () => assert.notEqual(E.normName('Brightsmile Dental Studio PC'), E.normName('BRIGHT SMILE DENTAL GROUP')));
  test('normName handles ampersand punctuation', () => assert.equal(E.normName('Summit Print & Sign Inc'), E.normName('SUMMIT PRINT  SIGN')));
  test('normAddress equates Street/St and Suite/Ste', () => assert.equal(E.normAddress('13 Pine Street, Suite 3'), E.normAddress('13 Pine St., Ste 3')));
  test('normAddress equates Avenue/Ave', () => assert.equal(E.normAddress('42 Maple Avenue'), E.normAddress('42 maple ave')));
  test('normAddress keeps different numbers apart', () => assert.notEqual(E.normAddress('13 Pine St'), E.normAddress('31 Pine St')));
  test('normEin ignores dash', () => assert.equal(E.normEin('52-8830146'), '528830146'));
  test('normPerson drops initials and titles punctuation', () => assert.equal(E.normPerson('Grace M. Lindqvist'), E.normPerson('grace lindqvist')));
  test('Brightsmile name mismatch flagged', () => assert.equal(check(E.runPipeline(findSub('SUB-2042')), 'name_match').status, 'flag'));
  test('Brightsmile name flag cites both documents', () => assert.ok(check(E.runPipeline(findSub('SUB-2042')), 'name_match').evidence.length >= 2));
  test('Oakridge EIN mismatch flagged', () => assert.equal(check(E.runPipeline(findSub('SUB-2051')), 'ein_match').status, 'flag'));
  test('Oakridge name still matches', () => assert.equal(check(E.runPipeline(findSub('SUB-2051')), 'name_match').status, 'pass'));
  test('Rolling Feast owner matches app, tax and ID', () => assert.match(check(E.runPipeline(findSub('SUB-2041')), 'owner_match').detail, /3 documents/));
});

describe('classification', () => {
  test('every digital document in the clean subs is classified correctly', () => {
    for (const s of SUBMISSIONS.filter((x) => x.id !== 'SUB-2052')) for (const d of s.docs) assert.equal(E.classifyDoc(d).label, d.kind, `${d.id}`);
  });
  test('confidence is between 0 and 1', () => {
    for (const s of SUBMISSIONS) for (const d of s.docs) { const c = E.classifyDoc(d).confidence; assert.ok(c >= 0 && c <= 1); }
  });
  test('garbled tax return falls below threshold', () => {
    const d = findSub('SUB-2052').docs.find((x) => x.kind === 'tax_return');
    const c = E.classifyDoc(d);
    assert.equal(c.label, 'unknown');
    assert.equal(c.guess, 'tax_return');
    assert.ok(c.confidence < E.CONFIDENCE_THRESHOLD);
  });
  test('empty document is unknown with zero confidence', () => {
    const c = E.classifyDoc({ id: 'Z', pages: [{ number: 1, lines: [{ text: 'hello', data: {} }] }] });
    assert.equal(c.label, 'unknown');
    assert.equal(c.confidence, 0);
  });
  test('override changes effective label only', () => {
    const s = findSub('SUB-2052');
    const d = s.docs.find((x) => x.kind === 'tax_return');
    const c = E.classifyAll(s, { [d.id]: 'tax_return' }).find((x) => x.docId === d.id);
    assert.equal(c.label, 'unknown');
    assert.equal(c.effective, 'tax_return');
    assert.equal(c.overridden, true);
  });
  test('reclassifying Summit tax return unlocks the EIN check', () => {
    const s = findSub('SUB-2052');
    const d = s.docs.find((x) => x.kind === 'tax_return');
    assert.equal(check(E.runPipeline(s), 'ein_match').status, 'na');
    assert.equal(check(E.runPipeline(s, { [d.id]: 'tax_return' }), 'ein_match').status, 'pass');
  });
  test('Summit stays incomplete after reclassify (no voided check)', () => {
    const s = findSub('SUB-2052');
    const d = s.docs.find((x) => x.kind === 'tax_return');
    assert.match(check(E.runPipeline(s, { [d.id]: 'tax_return' }), 'completeness').detail, /voided check/);
  });
  test('reclassifying a statement as unknown removes it from scrubbing', () => {
    const s = findSub('SUB-2049');
    const d = s.docs.find((x) => x.kind === 'bank_statement');
    assert.equal(check(E.runPipeline(s, { [d.id]: 'unknown' }), 'completeness').status, 'flag');
  });
});

describe('completeness', () => {
  test('expectedMonths', () => assert.deepEqual(E.expectedMonths('2026-09-28'), ['2026-06', '2026-07', '2026-08']));
  test('complete stack passes', () => assert.equal(E.runPipeline(findSub('SUB-2041')).complete, true));
  test('missing month is named', () => assert.match(check(E.runPipeline(findSub('SUB-2048')), 'completeness').detail, /2026-07/));
  test('first-pass completeness count for the scenario', () => assert.equal(SUBMISSIONS.filter((s) => E.runPipeline(s).complete).length, 10));
});

describe('extraction and evidence', () => {
  for (const s of SUBMISSIONS) {
    const r = E.runPipeline(s);
    for (const key of ['legalName', 'ein', 'monthlyRevenue', 'avgDailyBalance', 'existingPositions']) {
      test(`${s.id} ${key} evidence resolves to a real source line`, () => {
        const f = r.fields[key];
        for (const e of f.evidence) {
          const line = E.resolveEvidence(s, e);
          assert.ok(line, `pointer ${e.docId} p${e.page} l${e.line}`);
          assert.equal(line.text, e.text);
        }
        if (key !== 'existingPositions' || f.value) assert.ok(f.evidence.length > 0);
      });
    }
  }
  test('legal name comes from the application', () => assert.equal(E.runPipeline(findSub('SUB-2041')).fields.legalName.value, 'Rolling Feast Food Trucks LLC'));
  test('months in business computed from start and signed dates', () => assert.equal(E.runPipeline(findSub('SUB-2050')).fields.monthsInBusiness.value, 8));
  test('monthsBetween respects day of month', () => assert.equal(E.monthsBetween('2025-09-29', '2026-09-28'), 11));
  test('monthly revenue is an average of statement months', () => {
    const r = E.runPipeline(findSub('SUB-2049'));
    assert.match(r.fields.monthlyRevenue.note, /3 statement months/);
  });
});

describe('credit policy', () => {
  const fields = (o) => ({
    monthsInBusiness: { value: 24 }, monthlyRevenue: { value: 30000 }, nsfCount: { value: 0 },
    existingPositions: { value: 0 }, avgDailyBalance: { value: 5000 }, requested: { value: 30000 }, ...o,
  });
  const rule = (f, id) => E.evaluatePolicy(fields(f)).find((p) => p.id === id);
  test('all rules pass for a healthy file', () => assert.ok(E.evaluatePolicy(fields()).every((p) => p.status === 'pass')));
  test('time in business boundary 12 passes', () => assert.equal(rule({ monthsInBusiness: { value: 12 } }, 'min_tib').status, 'pass'));
  test('time in business 11 fails', () => assert.equal(rule({ monthsInBusiness: { value: 11 } }, 'min_tib').status, 'fail'));
  test('revenue boundary passes', () => assert.equal(rule({ monthlyRevenue: { value: 20000 } }, 'min_revenue').status, 'pass'));
  test('revenue below fails', () => assert.equal(rule({ monthlyRevenue: { value: 19999.99 } }, 'min_revenue').status, 'fail'));
  test('NSF 3 passes, 4 fails', () => {
    assert.equal(rule({ nsfCount: { value: 3 } }, 'max_nsf').status, 'pass');
    assert.equal(rule({ nsfCount: { value: 4 } }, 'max_nsf').status, 'fail');
  });
  test('positions 2 passes, 3 fails', () => {
    assert.equal(rule({ existingPositions: { value: 2 } }, 'max_positions').status, 'pass');
    assert.equal(rule({ existingPositions: { value: 3 } }, 'max_positions').status, 'fail');
  });
  test('ADB below floor fails', () => assert.equal(rule({ avgDailyBalance: { value: 2499 } }, 'min_adb').status, 'fail'));
  test('ask ratio computed', () => assert.equal(rule({ requested: { value: 45000 } }, 'max_ask').actual, 1.5));
  test('ask ratio above 1.5 fails', () => assert.equal(rule({ requested: { value: 46000 } }, 'max_ask').status, 'fail'));
  test('missing input is unknown, never pass', () => assert.equal(rule({ monthsInBusiness: { value: null } }, 'min_tib').status, 'unknown'));
  test('reason names the threshold', () => assert.match(rule({ nsfCount: { value: 5 } }, 'max_nsf').reason, /breaks "is at most 3 items"/));
  test('Lumen fails time in business', () => assert.equal(E.runPipeline(findSub('SUB-2050')).policy.find((p) => p.id === 'min_tib').status, 'fail'));
});

describe('pipeline invariants', () => {
  for (const s of SUBMISSIONS) {
    test(`${s.id} runs every check exactly once`, () => {
      const r = E.runPipeline(s);
      assert.deepEqual(r.checks.map((c) => c.id), E.CHECKS.map((c) => c.id));
    });
  }
  test('every check shows its rule text', () => {
    for (const c of E.runPipeline(SUBMISSIONS[0]).checks) assert.ok(c.rule.length > 20);
  });
  test('flags always carry evidence or a detail', () => {
    for (const s of SUBMISSIONS) for (const f of E.runPipeline(s).flags) assert.ok(f.detail && (f.evidence.length || f.id === 'completeness'));
  });
  test('pipeline never outputs an approval', () => {
    for (const s of SUBMISSIONS) assert.equal('decision' in E.runPipeline(s), false);
  });
  test('Tidewater is the clean control: zero flags', () => assert.equal(E.runPipeline(findSub('SUB-2049')).flags.length, 0));
});
