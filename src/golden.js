// 24 golden submissions with seeded defects. `expected` lists the checks a
// correct scrub must flag; anything else that fires is a false positive.
import { buildSubmission } from './generator.js';

const broker = { name: 'Eval Harness Broker', contact: 'Fixture', email: 'fixture@eval.example' };
const base = (n, over = {}) => ({
  id: `GLD-${String(n).padStart(2, '0')}`,
  seed: 9100 + n * 7,
  applicationDate: '2026-09-28',
  requested: 40000,
  broker,
  business: {
    legalName: `${['Harbor', 'Juniper', 'Quarry', 'Willow', 'Beacon', 'Granite', 'Maple', 'Cobalt'][n % 8]} ${['Bakery', 'Movers', 'Florist', 'Optics', 'Fitness', 'Hardware', 'Tailors', 'Cleaners'][(n * 3) % 8]} LLC`,
    dba: '',
    ein: `7${n % 10}-${String(1000000 + n * 7919).slice(-7)}`,
    address: `${10 + n} Pine Street, Suite ${n}, Trenton, NJ 08608`,
    owner: ['Ava Brooks', 'Noah Kim', 'Mia Torres', 'Liam Novak', 'Zoe Adler', 'Eli Sato'][n % 6],
    industry: 'Retail',
    startDate: '2017-03-01',
  },
  profile: { revenue: 52000, opening: 22000, expenseRatio: 0.88, sources: [{ name: 'SQUARE INC DEPOSIT', weight: 4 }, { name: 'STRIPE PAYOUT', weight: 2 }] },
  ...over,
});

export const GOLDEN = [
  { spec: base(1), expected: [], defect: 'Clean stack' },
  { spec: base(2), expected: [], defect: 'Clean stack' },
  { spec: base(3, { business: { ...base(3).business, address: '13 Pine St., Ste 3, Trenton, NJ 08608' } }), expected: [], defect: 'Clean stack, abbreviated address on application' },
  { spec: base(4, { includeId: true }), expected: [], defect: 'Clean stack with ID' },
  { spec: base(5, { profile: { ...base(5).profile, positions: [{ name: 'RAPIDLANE CAPITAL', daily: 120 }] } }), expected: [], defect: 'Clean stack, one disclosed position' },
  { spec: base(6, { defects: { doctoredBalance: { month: 1, nthDeposit: 2, delta: 3500 } } }), expected: ['balance_arithmetic'], defect: 'Deposit inflated by $3,500, balances left as printed' },
  { spec: base(7, { defects: { doctoredBalance: { month: 2, nthDeposit: 5, delta: 90 } } }), expected: ['balance_arithmetic'], defect: 'Deposit nudged by $90' },
  { spec: base(8, { defects: { missingPage: { month: 0, page: 2 } } }), expected: ['missing_pages'], defect: 'Middle page removed' },
  { spec: base(9, { defects: { missingPage: { month: 2, page: 2 } } }), expected: ['missing_pages'], defect: 'Last page (with closing balance) removed' },
  { spec: base(10, { defects: { dropMonth: 1 } }), expected: ['completeness', 'statement_continuity'], defect: 'Middle month statement withheld' },
  { spec: base(11, { defects: { statementHolder: 'HARBOR BREAD COMPANY' } }), expected: ['name_match'], defect: 'Statements belong to a different entity' },
  { spec: base(12, { defects: { taxName: 'Juniper Moving Group Inc' } }), expected: ['name_match'], defect: 'Tax return for a different entity' },
  { spec: base(13, { defects: { taxEin: '99-0000001' } }), expected: ['ein_match'], defect: 'EIN differs on tax return' },
  { spec: base(14, { defects: { taxOwner: 'Victor Hale' } }), expected: ['owner_match'], defect: 'Different officer on tax return' },
  { spec: base(15, { defects: { statementAddress: '400 Industrial Ave, Camden, NJ 08102' } }), expected: ['address_match'], defect: 'Statements at a different address' },
  {
    spec: base(16, { extraDeposits: [5000, 7500, 6000, 8500].map((amount, i) => ({ month: 1 + (i % 2), day: 6 + i * 5, desc: ['WIRE IN NOVA HOLDINGS', 'ZELLE FROM J PARK', 'WIRE IN BRIGHTON LLC', 'ZELLE FROM R COLE'][i], amount })) }),
    expected: ['round_deposits'], defect: 'Cluster of round-number wires from unrelated parties',
  },
  { spec: base(17, { extraDeposits: [{ month: 2, day: 29, desc: 'WIRE IN M SANTOS', amount: 31877.4 }] }), expected: ['sudden_deposit'], defect: 'Large one-off deposit 30 days before signing' },
  {
    spec: base(18, { profile: { ...base(18).profile, sources: [{ name: 'ACH CREDIT DELMAR WHOLESALE', weight: 6 }, { name: 'SQUARE INC DEPOSIT', weight: 3 }] } }),
    expected: ['deposit_concentration'], defect: 'Majority of deposits from one related payer',
  },
  { spec: base(19, { profile: { ...base(19).profile, opening: 3000, expenseRatio: 0.99, nsf: [2, 2, 1] } }), expected: ['nsf_overdraft'], defect: 'Repeated NSF returns' },
  {
    spec: base(20, { declaredPositions: 0, profile: { ...base(20).profile, opening: 40000, positions: [{ name: 'SUREPATH FUNDING', daily: 140 }, { name: 'QUICKBRIDGE ADVANCE', daily: 95 }] } }),
    expected: ['position_disclosure'], defect: 'Two undisclosed MCA positions (stacking)',
  },
  { spec: base(21, { defects: { missingDocs: ['tax_return'] } }), expected: ['completeness'], defect: 'Tax return not sent' },
  { spec: base(22, { defects: { garbledTax: true } }), expected: ['completeness'], defect: 'Tax return photographed, header unreadable' },
  {
    spec: base(23, { defects: { consistentForgery: { month: 0, nthDeposit: 4, delta: 2600 } } }),
    expected: ['balance_arithmetic'], defect: 'Statement re-typed: deposit inflated by $2,600 and every later balance re-computed by hand',
    knownMiss: 'Arithmetic is internally consistent, so no statement-only rule can see it. Catching it needs bank-sourced data (direct bank connection or bank-verified PDF) to compare against.',
  },
  {
    spec: base(24, { extraDeposits: [0, 1, 2].flatMap((m) => [{ month: m, day: 5, desc: 'ACH CREDIT LAKESIDE CORP WELLNESS', amount: 2000 }, { month: m, day: 20, desc: 'ACH CREDIT LAKESIDE CORP WELLNESS', amount: 2000 }]) }),
    expected: [], defect: 'Clean: legitimate corporate wellness contract paid in round $2,000 instalments',
    knownFalsePositive: 'Round-number rule cannot tell a contracted B2B payer from manufactured deposits. V2: whitelist payers that match a contract or invoice in the stack.',
  },
];

export const GOLDEN_SUBMISSIONS = GOLDEN.map((g) => ({ ...g, sub: buildSubmission(g.spec) }));
