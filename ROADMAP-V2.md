# Roadmap V2

Ordered by expected impact on time-to-decision and trust.

| # | Item | Why | Signal of success |
| --- | --- | --- | --- |
| 1 | OCR confidence per field | Real stacks are scans; low-confidence characters should surface on the chip | Fewer silent extraction errors found in review |
| 2 | Bank-sourced verification | Closes the GLD-23 honest miss: compare statements to bank-connected data | Re-typed statement caught in eval |
| 3 | Payer-aware deposit rules | Cut false positives like GLD-24 using contracts, invoices and override history | False positives per clean file ↓ |
| 4 | Continuation-page matching | Missing first page should name the page (by account number + period) | Missing-pages rule catches first-page removal |
| 5 | Override analytics for leads | Which checks are overridden, by whom, with what reason | Rules tuned; override rate per check < 30% |
| 6 | Auto-drafted broker follow-up | Completeness gaps become a pre-written email to the ISO | Time from receipt to complete stack ↓ |
| 7 | Policy versioning and simulation | Run a proposed rule change on last month's files before shipping it | Policy changes ship with impact estimate |
| 8 | CRM-native panel | Same desk as a Salesforce / HubSpot side panel | Adoption without a new tab |
| 9 | Enrichment cards | Secretary of State, UCC, liens, sanctions results inline with evidence | Background checks reviewed on the same screen |
| 10 | Multi-signal fraud score | Combine weak signals (round deposits + new account + sudden deposit) with explanation | Higher catch on combined-pattern golden cases |

## Not planned

- Auto-approval. The desk produces decision-ready packages; humans decide.
- A broker portal. Intake stays email/API so brokers change nothing.
