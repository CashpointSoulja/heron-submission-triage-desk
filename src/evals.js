import { runPipeline, CHECKS } from './engine.js';

export function runEvals(goldens) {
  const cases = goldens.map((g) => {
    const r = runPipeline(g.sub);
    const fired = r.flags.map((f) => f.id);
    const caught = g.expected.filter((e) => fired.includes(e));
    const missed = g.expected.filter((e) => !fired.includes(e));
    const falsePos = fired.filter((f) => !g.expected.includes(f));
    return { id: g.sub.id, defect: g.defect, expected: g.expected, fired, caught, missed, falsePos, knownMiss: g.knownMiss, knownFalsePositive: g.knownFalsePositive, clean: !g.expected.length, pass: !missed.length && !falsePos.length };
  });
  const seeded = cases.reduce((a, c) => a + c.expected.length, 0);
  const caught = cases.reduce((a, c) => a + c.caught.length, 0);
  const fp = cases.reduce((a, c) => a + c.falsePos.length, 0);
  const cleanCases = cases.filter((c) => c.clean);
  const perCheck = CHECKS.map((ch) => {
    const tp = cases.filter((c) => c.caught.includes(ch.id)).length;
    const fn = cases.filter((c) => c.missed.includes(ch.id)).length;
    const fpc = cases.filter((c) => c.falsePos.includes(ch.id)).length;
    return { id: ch.id, name: ch.name, tp, fn, fp: fpc };
  });
  return {
    cases,
    seeded,
    caught,
    catchRate: seeded ? caught / seeded : 0,
    falsePositives: fp,
    cleanCases: cleanCases.length,
    cleanFlagged: cleanCases.filter((c) => c.fired.length).length,
    casesPassed: cases.filter((c) => c.pass).length,
    perCheck,
  };
}
