# Test plan

## Scope

1. Rule engine (`src/engine.js`): classification, extraction, each scrub check, credit policy, evidence resolution.
2. Synthetic generator (`src/generator.js`): determinism and integrity.
3. Golden set (`src/golden.js`, `src/evals.js`): each seeded defect is caught, the honest miss and the documented false positive are stable.
4. UI (`index.html`, `src/app.js`): end-to-end flow, exports, responsiveness, console cleanliness.

## Unit tests (`npm test`, Node built-in test runner)

| Area | What is asserted |
| --- | --- |
| Generator | Seeded RNG determinism and range; month maths across year boundary; identical submissions from identical specs; unique submission and document IDs |
| Balance arithmetic | Clean reconcile; wrong printed balance; inflated amount; closing mismatch; sub-cent float tolerance; one-cent detection; resync across missing page; no closing check when pages missing; seed chain without opening |
| Continuity | Back-to-back pass; date gap length; broken balance chain |
| Missing pages | None, middle, several |
| NSF / overdraft / negative days | Fee detection by description; negative-day carry-forward; full calendar coverage |
| Deposits | Round-number definition boundaries; processor and mobile-deposit exclusion; concentration share; 30-day window; $5,000 floor vs 3× median |
| Positions | Recurring funder debits threshold; non-funder exclusion; disclosure vs application |
| Normalisation | Entity suffixes, punctuation, street/suite abbreviations, EIN digits, initials |
| Classification | All clean docs labelled correctly; confidence in [0,1]; garbled scan → unknown with best guess; override changes effective label only; reclassify unlocks dependent checks |
| Completeness | Expected months; missing month named; first-pass count |
| Extraction & evidence | For every live submission and key field, every evidence pointer resolves to the exact line text |
| Credit policy | Boundaries for every rule; unknown input is never a pass; reason text |
| Invariants | Every check runs once per submission; every check has rule text; flags carry evidence; pipeline never emits an approval; clean control has zero flags |
| Golden set | 24 cases; 18/19 caught; 1 false positive; miss = GLD-23; false positive = GLD-24; every other case exact |

## UI verification (Playwright, headless Chromium)

| Check | Method |
| --- | --- |
| No horizontal overflow at 390 / 834 / 1440 | `document.documentElement.scrollWidth === clientWidth` on Desk (with a submission open), Eval lab, Metrics, Audit |
| No console errors | Collect `console.error` and `pageerror` during each load and flow |
| Evidence chip → source line | Click chip, assert drawer highlights the same line text |
| Review gate | Mark decision-ready disabled until all flags reviewed; rationale required |
| Export | JSON package has decision with outcome, rationale, reviewer, time-to-decision; CSV has header and rows; audit CSV downloads |
| Reclassify | Garbled tax scan reclassified → EIN check runs, audit records it |
| Visual | Screenshots inspected by eye at all three widths |

## Out of scope

OCR accuracy on real scans; performance at production volume; accessibility audit beyond keyboard focus and labels.
