// Meridian Capital Funding: a fictional MCA funder and 12 fictional broker submissions.
import { buildSubmission } from './generator.js';

export const FUNDER = { name: 'Meridian Capital Funding', policyVersion: 'Credit policy v3', slaMinutes: 240 };

export const BROKERS = {
  keystone: { name: 'Keystone Funding Partners', contact: 'Dana Whitlow', email: 'subs@keystonefp.example' },
  crestway: { name: 'Crestway Capital Brokers', contact: 'Marco Ilves', email: 'deals@crestway.example' },
  bluebird: { name: 'Bluebird Business Lending', contact: 'Priya Nandakumar', email: 'priya@bluebirdbl.example' },
  atlas: { name: 'Atlas Merchant Advisors', contact: 'Tom Okafor', email: 'tom@atlasma.example' },
};

const SQ = (w) => ({ name: 'SQUARE INC DEPOSIT', weight: w });
const ST = (w) => ({ name: 'STRIPE PAYOUT', weight: w });
const TO = (w) => ({ name: 'TOAST INC DEP', weight: w });
const SH = (w) => ({ name: 'SHOPIFY PAYMENTS', weight: w });
const CL = (w) => ({ name: 'CLOVER SETTLEMENT', weight: w });
const MB = (w) => ({ name: 'MINDBODY PAYOUT', weight: w });

export const SPECS = [
  {
    id: 'SUB-2041', seed: 2041, receivedMinsAgo: 12, applicationDate: '2026-09-28', requested: 60000, broker: BROKERS.keystone,
    business: { legalName: 'Rolling Feast Food Trucks LLC', dba: 'Rolling Feast', ein: '84-2210457', address: '118 Ferry Street, Newark, NJ 07105', owner: 'Luis Ortega', industry: 'Food trucks (fleet of 4)', startDate: '2019-05-01' },
    profile: { revenue: 74000, opening: 21500, expenseRatio: 0.9, sources: [SQ(6), TO(2)], suppliers: ['RESTAURANT DEPOT', 'PSE&G UTILITIES', 'GARDEN STATE FUEL'] },
    filenames: { application: 'RollingFeast_app.pdf', statement: (m, y) => `RF_${m}${y}.pdf` },
    includeId: true,
  },
  {
    id: 'SUB-2042', seed: 2042, receivedMinsAgo: 27, applicationDate: '2026-09-28', requested: 80000, broker: BROKERS.crestway,
    business: { legalName: 'Brightsmile Dental Studio PC', dba: 'Brightsmile Dental', ein: '61-3378190', address: '42 Maple Avenue, Suite 3, Montclair, NJ 07042', owner: 'Dr. Hannah Weiss', industry: 'Dental practice', startDate: '2016-02-01' },
    profile: { revenue: 96000, opening: 38000, expenseRatio: 0.88, sources: [ST(3), { name: 'DELTAWAY DENTAL INS', weight: 2 }, { name: 'UNIMERIT HEALTH CLAIMS', weight: 2 }, { name: 'CAREBRIDGE INS PMT', weight: 2 }], suppliers: ['PATTERSONE DENTAL SUPPLY', 'PSE&G UTILITIES', 'MEDGUARD MALPRACTICE'] },
    defects: { statementHolder: 'BRIGHT SMILE DENTAL GROUP' },
    filenames: { application: 'Brightsmile application.pdf' },
  },
  {
    id: 'SUB-2043', seed: 2043, receivedMinsAgo: 41, applicationDate: '2026-09-28', requested: 35000, broker: BROKERS.bluebird,
    business: { legalName: 'Ironworks Strength Gym LLC', dba: 'Ironworks', ein: '47-5521093', address: '9 Railroad Place, Hoboken, NJ 07030', owner: 'Kayla Brandt', industry: 'Fitness gym', startDate: '2021-08-01' },
    profile: { revenue: 31000, opening: 2600, expenseRatio: 0.99, nsf: [2, 1, 2], sources: [MB(5), SQ(1)], landlord: 'HUDSON YARD REALTY', suppliers: ['ROGUEFIT EQUIPMENT', 'PSE&G UTILITIES', 'NORTHSTAR INSURANCE'] },
  },
  {
    id: 'SUB-2044', seed: 2044, receivedMinsAgo: 58, applicationDate: '2026-09-28', requested: 120000, broker: BROKERS.atlas,
    business: { legalName: 'Northpeak Outfitters Inc', dba: 'Northpeak', ein: '83-1904426', address: '300 Commerce Way, Unit 12, Edison, NJ 08837', owner: 'Ethan Marsh', industry: 'E-commerce (outdoor apparel)', startDate: '2020-03-01' },
    profile: { revenue: 88000, opening: 48000, expenseRatio: 0.93, sources: [SH(7), ST(2)], suppliers: ['PACIFIC TEXTILE MILLS', 'SHIPFAST LOGISTICS', 'META ADS'] },
    extraDeposits: [
      { month: 2, day: 4, desc: 'WIRE IN ATLAS RIDGE HOLDINGS', amount: 5000 },
      { month: 2, day: 11, desc: 'WIRE IN ATLAS RIDGE HOLDINGS', amount: 7500 },
      { month: 2, day: 18, desc: 'WIRE IN ATLAS RIDGE HOLDINGS', amount: 5000 },
      { month: 2, day: 31, desc: 'WIRE IN K REYES', amount: 38412.5 },
    ],
    statedRevenue: 140000,
  },
  {
    id: 'SUB-2045', seed: 2045, receivedMinsAgo: 76, applicationDate: '2026-09-28', requested: 45000, broker: BROKERS.keystone,
    business: { legalName: 'Copperline Plumbing & Heating LLC', dba: 'Copperline', ein: '22-4410938', address: '77 Orange Road, Clifton, NJ 07013', owner: 'Sean Gallagher', industry: 'Plumbing contractor', startDate: '2014-06-01' },
    profile: { revenue: 58000, opening: 17000, expenseRatio: 0.9, sources: [ST(2), CL(2), { name: 'MOBILE DEPOSIT CHECK', weight: 3 }], suppliers: ['FERGUSOM SUPPLY', 'GARDEN STATE FUEL', 'NORTHSTAR INSURANCE'] },
    defects: { missingPage: { month: 1, page: 2 } },
  },
  {
    id: 'SUB-2046', seed: 2046, receivedMinsAgo: 95, applicationDate: '2026-09-28', requested: 50000, broker: BROKERS.crestway,
    business: { legalName: 'Saffron Table Restaurant LLC', dba: 'Saffron Table', ein: '35-7781204', address: '510 Bloomfield Avenue, Bloomfield, NJ 07003', owner: 'Anjali Rao', industry: 'Restaurant (full service)', startDate: '2018-10-01' },
    profile: { revenue: 82000, opening: 34000, expenseRatio: 0.9, sources: [TO(6), { name: 'DOORDASH MERCHANT', weight: 1 }], positions: [{ name: 'RAPIDLANE CAPITAL', daily: 189 }, { name: 'SUREPATH FUNDING', daily: 145 }, { name: 'QUICKBRIDGE ADVANCE', daily: 98 }], suppliers: ['RESTAURANT DEPOT', 'SYSCOMEX FOODS', 'PSE&G UTILITIES'] },
    declaredPositions: 1,
  },
  {
    id: 'SUB-2047', seed: 2047, receivedMinsAgo: 118, applicationDate: '2026-09-28', requested: 30000, broker: BROKERS.bluebird,
    business: { legalName: 'Bluewave Auto Detailing LLC', dba: 'Bluewave', ein: '46-2093317', address: '1450 Route 22, Union, NJ 07083', owner: 'Darnell Hughes', industry: 'Auto detailing', startDate: '2020-01-01' },
    profile: { revenue: 36000, opening: 6500, expenseRatio: 0.9, sources: [SQ(5), CL(1)], suppliers: ['CHEMGUYS WHOLESALE', 'PSE&G UTILITIES', 'NORTHSTAR INSURANCE'] },
    defects: { doctoredBalance: { month: 2, nthDeposit: 3, delta: 4200 } },
  },
  {
    id: 'SUB-2048', seed: 2048, receivedMinsAgo: 142, applicationDate: '2026-09-28', requested: 40000, broker: BROKERS.atlas,
    business: { legalName: 'Greenleaf Landscaping Co', dba: 'Greenleaf', ein: '27-6690125', address: '23 Mill Road, Morristown, NJ 07960', owner: 'Rosa Delgado', industry: 'Landscaping', startDate: '2017-04-01' },
    profile: { revenue: 52000, opening: 14000, expenseRatio: 0.88, sources: [{ name: 'MOBILE DEPOSIT CHECK', weight: 3 }, ST(2), SQ(1)], suppliers: ['SITEONE NURSERY', 'GARDEN STATE FUEL', 'NORTHSTAR INSURANCE'] },
    defects: { dropMonth: 1 },
  },
  {
    id: 'SUB-2049', seed: 2049, receivedMinsAgo: 166, applicationDate: '2026-09-28', requested: 55000, broker: BROKERS.keystone,
    business: { legalName: 'Tidewater Courier Co', dba: 'Tidewater Courier', ein: '88-1023476', address: '6 Port Street, Elizabeth, NJ 07201', owner: 'Grace Lindqvist', industry: 'Same-day courier', startDate: '2015-09-01' },
    profile: { revenue: 69000, opening: 26000, expenseRatio: 0.89, sources: [ST(5), { name: 'ACH CREDIT PORTSIDE BILLING', weight: 1 }, { name: 'ACH CREDIT HARBORVIEW PHARMACY', weight: 1 }], suppliers: ['GARDEN STATE FUEL', 'FLEETCARE REPAIRS', 'NORTHSTAR INSURANCE'] },
  },
  {
    id: 'SUB-2050', seed: 2050, receivedMinsAgo: 189, applicationDate: '2026-09-28', requested: 20000, broker: BROKERS.crestway,
    business: { legalName: 'Lumen Hair Studio LLC', dba: 'Lumen', ein: '93-4417702', address: '88 Church Street, Montclair, NJ 07042', owner: 'Simone Achebe', industry: 'Hair salon', startDate: '2026-01-15' },
    profile: { revenue: 24000, opening: 9000, expenseRatio: 0.86, sources: [SQ(5)], suppliers: ['SALONCENTRIC SUPPLY', 'PSE&G UTILITIES', 'NORTHSTAR INSURANCE'] },
  },
  {
    id: 'SUB-2051', seed: 2051, receivedMinsAgo: 212, applicationDate: '2026-09-28', requested: 70000, broker: BROKERS.bluebird,
    business: { legalName: 'Oakridge Pet Clinic PC', dba: 'Oakridge Vets', ein: '52-8830146', address: '210 Oak Ridge Road, Parsippany, NJ 07054', owner: 'Dr. Felix Moreau', industry: 'Veterinary clinic', startDate: '2012-03-01' },
    profile: { revenue: 84000, opening: 30500, expenseRatio: 0.88, sources: [CL(4), ST(2)], suppliers: ['VETSOURCE WHOLESALE', 'PSE&G UTILITIES', 'MEDGUARD MALPRACTICE'] },
    defects: { taxEin: '52-8830164' },
  },
  {
    id: 'SUB-2052', seed: 2052, receivedMinsAgo: 231, applicationDate: '2026-09-28', requested: 25000, broker: BROKERS.atlas,
    business: { legalName: 'Summit Print & Sign Inc', dba: 'Summit Print', ein: '30-5512870', address: '14 Valley Road, Wayne, NJ 07470', owner: 'Owen Petrakis', industry: 'Print and signage', startDate: '2013-11-01' },
    profile: { revenue: 41000, opening: 9800, expenseRatio: 0.9, sources: [ST(3), SQ(2), { name: 'MOBILE DEPOSIT CHECK', weight: 2 }], suppliers: ['INKWELL PAPER CO', 'PSE&G UTILITIES', 'NORTHSTAR INSURANCE'] },
    defects: { garbledTax: true, missingDocs: ['voided_check'] },
    includeId: true,
  },
];

export const SUBMISSIONS = SPECS.map(buildSubmission);
