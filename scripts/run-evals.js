import { GOLDEN_SUBMISSIONS } from '../src/golden.js';
import { runEvals } from '../src/evals.js';

const r = runEvals(GOLDEN_SUBMISSIONS);
for (const c of r.cases) {
  const tag = c.pass ? 'PASS' : c.missed.length ? 'MISS' : 'FALSE POSITIVE';
  console.log(`${c.id}  ${tag.padEnd(14)} expected [${c.expected.join(', ')}]  fired [${c.fired.join(', ')}]  ${c.defect}`);
}
console.log(`\nSeeded defects caught: ${r.caught}/${r.seeded} (${(r.catchRate * 100).toFixed(1)}%)`);
console.log(`False positive flags: ${r.falsePositives} (clean cases flagged: ${r.cleanFlagged}/${r.cleanCases})`);
console.log(`Cases fully correct: ${r.casesPassed}/${r.cases.length}`);
