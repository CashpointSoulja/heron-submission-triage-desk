import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GOLDEN, GOLDEN_SUBMISSIONS } from '../src/golden.js';
import { runEvals } from '../src/evals.js';

const r = runEvals(GOLDEN_SUBMISSIONS);

describe('golden set', () => {
  test('has 24 cases', () => assert.equal(GOLDEN.length, 24));
  test('catch rate is 18 of 19 seeded defects', () => {
    assert.equal(r.seeded, 19);
    assert.equal(r.caught, 18);
  });
  test('exactly one false positive flag', () => assert.equal(r.falsePositives, 1));
  test('the miss is the documented re-typed statement', () => {
    const miss = r.cases.filter((c) => c.missed.length);
    assert.deepEqual(miss.map((c) => c.id), ['GLD-23']);
    assert.ok(miss[0].knownMiss);
  });
  test('the false positive is the documented wellness contract', () => {
    const fp = r.cases.filter((c) => c.falsePos.length);
    assert.deepEqual(fp.map((c) => c.id), ['GLD-24']);
    assert.ok(fp[0].knownFalsePositive);
  });
  for (const c of r.cases.filter((x) => !x.knownMiss && !x.knownFalsePositive)) {
    test(`${c.id} ${c.defect}`, () => {
      assert.deepEqual([...c.fired].sort(), [...c.expected].sort());
    });
  }
});
