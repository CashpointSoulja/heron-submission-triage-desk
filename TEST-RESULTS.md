# Test results

Run on 2026-10-06 with Node v22.23.3, headless Chromium for UI checks. Output below is pasted from the commands, unedited except for trimming the per-test lines.

## Unit tests: `npm test`

```
# Subtest: generator
ok 1 - generator
# Subtest: balance arithmetic
ok 2 - balance arithmetic
# Subtest: statement continuity
ok 3 - statement continuity
# Subtest: missing pages
ok 4 - missing pages
# Subtest: NSF, overdraft and negative days
ok 5 - NSF, overdraft and negative days
# Subtest: deposit analysis
ok 6 - deposit analysis
# Subtest: positions
ok 7 - positions
# Subtest: normalisation and cross-document checks
ok 8 - normalisation and cross-document checks
# Subtest: classification
ok 9 - classification
# Subtest: completeness
ok 10 - completeness
# Subtest: extraction and evidence
ok 11 - extraction and evidence
# Subtest: credit policy
ok 12 - credit policy
# Subtest: pipeline invariants
ok 13 - pipeline invariants
# Subtest: golden set
ok 14 - golden set
# tests 207
# suites 14
# pass 207
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 312.575699
```

## Golden set: `npm run evals`

```
GLD-01  PASS           expected []  fired []  Clean stack
GLD-02  PASS           expected []  fired []  Clean stack
GLD-03  PASS           expected []  fired []  Clean stack, abbreviated address on application
GLD-04  PASS           expected []  fired []  Clean stack with ID
GLD-05  PASS           expected []  fired []  Clean stack, one disclosed position
GLD-06  PASS           expected [balance_arithmetic]  fired [balance_arithmetic]  Deposit inflated by $3,500, balances left as printed
GLD-07  PASS           expected [balance_arithmetic]  fired [balance_arithmetic]  Deposit nudged by $90
GLD-08  PASS           expected [missing_pages]  fired [missing_pages]  Middle page removed
GLD-09  PASS           expected [missing_pages]  fired [missing_pages]  Last page (with closing balance) removed
GLD-10  PASS           expected [completeness, statement_continuity]  fired [completeness, statement_continuity]  Middle month statement withheld
GLD-11  PASS           expected [name_match]  fired [name_match]  Statements belong to a different entity
GLD-12  PASS           expected [name_match]  fired [name_match]  Tax return for a different entity
GLD-13  PASS           expected [ein_match]  fired [ein_match]  EIN differs on tax return
GLD-14  PASS           expected [owner_match]  fired [owner_match]  Different officer on tax return
GLD-15  PASS           expected [address_match]  fired [address_match]  Statements at a different address
GLD-16  PASS           expected [round_deposits]  fired [round_deposits]  Cluster of round-number wires from unrelated parties
GLD-17  PASS           expected [sudden_deposit]  fired [sudden_deposit]  Large one-off deposit 30 days before signing
GLD-18  PASS           expected [deposit_concentration]  fired [deposit_concentration]  Majority of deposits from one related payer
GLD-19  PASS           expected [nsf_overdraft]  fired [nsf_overdraft]  Repeated NSF returns
GLD-20  PASS           expected [position_disclosure]  fired [position_disclosure]  Two undisclosed MCA positions (stacking)
GLD-21  PASS           expected [completeness]  fired [completeness]  Tax return not sent
GLD-22  PASS           expected [completeness]  fired [completeness]  Tax return photographed, header unreadable
GLD-23  MISS           expected [balance_arithmetic]  fired []  Statement re-typed: deposit inflated by $2,600 and every later balance re-computed by hand
GLD-24  FALSE POSITIVE expected []  fired [round_deposits]  Clean: legitimate corporate wellness contract paid in round $2,000 instalments

Seeded defects caught: 18/19 (94.7%)
False positive flags: 1 (clean cases flagged: 1/6)
Cases fully correct: 22/24
```

## UI checks (headless Chromium, local static server)

Overflow = `document.documentElement.scrollWidth` vs `clientWidth`. Console = `console.error` + uncaught page errors during load.

| View | 1440 | 834 | 390 | Console errors |
| --- | --- | --- | --- | --- |
| Desk, submission open (SUB-2047) | 1440 / 1440 | 834 / 834 | 390 / 390 | 0 |
| Desk, inbox only | 1440 / 1440 | 834 / 834 | 390 / 390 | 0 |
| Eval lab | 1440 / 1440 | 834 / 834 | 390 / 390 | 0 |
| Metrics | 1440 / 1440 | 834 / 834 | 390 / 390 | 0 |
| Audit trail | 1440 / 1440 | 834 / 834 | 390 / 390 | 0 |

Two overflow bugs were found and fixed during this pass: Eval lab at 390px (657px wide, grid track sized to table content) and Audit at 390px (629px, long `<select>` options).

### Scripted flow (SUB-2042, then SUB-2052)

```
drawer hit: Legal business name: Brightsmile Dental Studio PC
pkg decision: {
  outcome: 'Ready for offer',
  rationale: 'All rules pass; name variance explained by trading name.',
  by: 'J. Reyes (underwriter)',
  at: '2026-10-06 19:15:54Z',
  timeToDecisionMinutes: 27
}
section,item,value,status,source_or_note
submission,id,SUB-2042,,Meridian Capital Funding
submission,broker,Crestway Capital Brokers,,
submission,requested,80000,,
before flags 1 flag across 13 checks
after flags 1 flag across 13 checks
ttd: 27m
audit rows top: 19:15:54ZSUB-2052J. Reyes (underwriter)reclassifiedscan_0007.jpg → Tax return; scrub and policy re-run (1 flags)
audit lines 441
errors []
```

Evidence chip opened the source drawer on the same line; override with rationale unlocked *Mark decision-ready*; JSON and CSV package exports and the audit CSV downloaded. On SUB-2052, reclassifying the unreadable tax scan kept one flag (completeness: voided check still missing) while the EIN check moved from *not run* to *pass* (also asserted in unit tests).

Screenshots: [`docs/screenshots/`](docs/screenshots/).

## Live deploy check

`https://cashpointsoulja.github.io/heron-submission-triage-desk/` returned HTTP 200 after the first Pages workflow run ("completed successfully"). The same overflow/console script, pointed at the live URL, gave `sw == cw` and 0 console errors at 1440, 834 and 390 for the desk (SUB-2047) and Eval lab.

## Video

`video/triage-desk-demo.mp4`: ffprobe 1080×1920, 70.6 s, H.264 + AAC; `silencedetect=noise=-40dB:d=0.9` reports no gaps; container and stream metadata stripped.
