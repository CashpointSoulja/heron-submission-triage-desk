# Metrics

## North star

**Median time-to-decision-ready** (submission received → underwriter marks the package decision-ready), within SLA.

Why: brokers shop deals; the first credible response tends to win. Time-to-decision is the outcome the funder pays for. It combines automation (pre-scrubbing) and trust (how fast a person can verify it).

## The three desk metrics

| Metric | Definition | How it is produced in this build | Status |
| --- | --- | --- | --- |
| Time-to-decision | Median minutes from `receivedAt` to `decision.at`; hands-on time = `openedAt` → `decision.at` | Measured live in the browser from audit timestamps | **Measured** (synthetic session only) |
| Scrub time saved per submission | Modelled manual scrub minutes − desk minutes (open + review each flag) | Computed per submission from the assumption table below | **Modelled hypothesis** |
| First-pass completeness rate | Share of submissions whose stack passes the completeness check on arrival, before any reclassification or follow-up | Computed from the queue: 10 of 12 = 83.3% | **Computed** (synthetic queue) |

### Scrub-time model assumptions

| Manual step | Minutes |
| --- | --- |
| Open and classify each attachment | 0.75 per file |
| Re-add one statement's running balance | 6 per statement |
| Date continuity | 3 |
| NSF, overdraft, negative days | 5 |
| Deposit analysis | 8 |
| Name / address / EIN / owner cross-check | 6 |
| Apply credit policy | 4 |
| Write up the package | 6 |
| **Desk:** open file + review each flag | 2 + 3 per flag |

On the 12 synthetic submissions this models about 54 minutes manual vs about 5 minutes on the desk per file (≈49 minutes saved). These numbers are placeholders to be replaced by time-and-motion data from real underwriters; the point is the structure (saving scales with statements per deal, cost scales with flags), not the exact value.

## Guardrail metrics

| Guardrail | Why | Target (proposal) |
| --- | --- | --- |
| Golden-set catch rate | Speed is worthless if fraud gets through | ≥ 95% on seeded defects, with every miss documented |
| False-positive flags per clean file | Noise trains people to click through | ≤ 0.2 |
| Override rate per check | High override = rule is wrong or badly tuned | Investigate any check > 30% |
| Funded-deal default / fraud loss rate | Lagging truth | No regression vs pre-desk cohort |
| Audit completeness | Every decision has rationale + reviewer | 100% |

## Input metrics

- % of documents auto-classified ≥ 0.70 confidence
- % of fields with at least one evidence pointer (100% in this build, enforced by tests)
- Reclassification rate per document type
- Requests for missing documents per broker (feeds ISO scorecards)

## What would make me kill or pivot it

- Hands-on time does not fall because underwriters still re-scrub (trust not earned) → invest in evidence UX and calibration before more checks.
- Override rate stays high on fraud checks → rules too blunt; move to payer-aware or bank-sourced checks.
