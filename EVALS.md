# Evals

## Why a golden set

Scrub rules are cheap to write and easy to get subtly wrong. A rule that never fires looks the same as a rule that works. The golden set plants known defects in otherwise clean synthetic stacks and scores the engine against them, so every rule change shows its effect on catches and noise.

## Set design

24 synthetic submissions (`src/golden.js`), all built by the same generator as the live queue:

| Group | Cases | Seeded defect |
| --- | --- | --- |
| Clean controls | GLD-01–05 | None (incl. abbreviated address, extra ID, one disclosed position) |
| Doctored arithmetic | GLD-06, 07 | Deposit inflated $3,500; deposit nudged $90 |
| Missing pages / months | GLD-08–10 | Middle page removed; last page removed; middle month withheld |
| Identity mismatches | GLD-11–15 | Statement entity, tax entity, EIN, officer, address |
| Deposit fraud patterns | GLD-16–18 | Round-number wires; large pre-signing deposit; related-payer concentration |
| Credit behaviour | GLD-19, 20 | Repeated NSFs; two undisclosed MCA positions (stacking) |
| Stack quality | GLD-21, 22 | Tax return missing; tax return photographed with unreadable header |
| Hard cases | GLD-23, 24 | Re-typed statement with consistent balances; legitimate round-number contract |

Scoring (`src/evals.js`): for each case, `expected` lists the checks a correct scrub must flag. Expected-and-fired = caught; expected-not-fired = missed; fired-not-expected = false positive.

## Results (`npm run evals`)

| Metric | Value |
| --- | --- |
| Seeded defects caught | **18 / 19 (94.7%)** |
| False-positive flags | **1** |
| Clean controls flagged | 1 / 6 (GLD-24) |
| Cases exactly right | 22 / 24 |

### The honest miss: GLD-23

A statement re-typed from scratch: one deposit inflated by $2,600 and every later running balance and the closing balance recomputed to match. Every statement-only rule passes because the document is internally consistent. **This is shown on screen in the Eval lab.**

What would catch it: data the applicant cannot edit, such as a direct bank connection, bank-issued PDF verification, or comparing the opening balance against the prior month's closing on a bank-sourced statement. This is the clearest argument for pairing scrubbing with bank-sourced data.

### The false positive: GLD-24

A legitimate corporate wellness contract paying $2,000 instalments trips the round-number rule. The rule cannot tell a contracted B2B payer from manufactured deposits. V2: suppress payers that match a contract or invoice in the stack, and learn allow-lists from underwriter overrides.

### Documented limitation found while building

Removing the **first** page of a statement removes the bank name, title, period and "Page x of N" line, so the remaining page no longer looks like a bank statement: it is classified *unknown* and completeness flags the missing month plus an unclassified document. The file is still stopped for review, but the missing-pages rule cannot name the page. The golden set uses a last-page removal for the missing-pages case; first-page matching is on the V2 roadmap (continuation pages should be matched to their parent by account number).

## Limits of this eval

- Synthetic and small: 24 cases authored by the same person who wrote the rules. Real evals need production submissions labelled by underwriters, a held-out set, and per-bank coverage.
- Documents are digital text; OCR errors are not simulated.
- One defect per case (except GLD-10). Real fraud combines signals.
