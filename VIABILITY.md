# Viability: why this maps to Heron

## What Heron publicly describes

From herondata.io (captured for `design/`): Heron reads submissions as they arrive (forwarded emails, API, portal) with "no behavior change for your brokers"; scrubs bank statements and applications; enriches with business identity checks (Secretary of State, court filings, UCC, sanctions); runs the funder's own underwriting policy ("Where monthly revenue is at least …"); and delivers decision-ready deals into the CRM the team already uses. It describes 200+ funders, brokers and fintechs as customers.

## Where the desk sits in that pipeline

| Heron stage | Desk surface | Extension, not replacement |
| --- | --- | --- |
| Intake (email) | Shared-inbox queue + SLA | Makes queue time visible per deal |
| Classification | Labels + confidence + reclassify | Puts confidence and human correction in front of the underwriter, and re-runs downstream work on correction |
| Extraction | Evidence chips | Every value traceable to document, page, line |
| Scrubbing | 13 rule cards with rule text | Shows *why* a flag fired, makes override a recorded act |
| Decisioning (policy) | Explicit rule rows | Same rule-builder language, pass/fail with reason |
| CRM delivery | Decision-ready package + JSON/CSV | Package includes reviews and rationale, not just data |
| Compliance | Audit trail | One export per file |

The concept is deliberately CRM-embedded in spirit: the package is a record shape, not a new destination. In production it would be a panel inside Salesforce or the funder's CRM, fed by Heron's pipeline.

## Why it could matter commercially (hypotheses)

1. **Speed is the buyer's metric.** If verification is the remaining manual step, making it fast compounds the value of every automated step before it.
2. **Trust drives expansion.** Teams that can see and correct the machine's work will automate more of their flow, and route more volume through it.
3. **Overrides are training data.** Every confirmed or overridden flag with a rationale is a label for tuning rules and models.
4. **Audit is a compliance and model-risk asset** for lenders who must explain decisions.

## Fit gaps and honest risks

- **OCR is the real hard part.** This build uses digital text. Production stacks are scans and photos; confidence must flow from OCR into every field.
- **Bank-statement variety.** Hundreds of bank layouts; rules here assume clean transaction rows.
- **Underwriters may already have this view** inside Heron's product. I have no internal access; this is built from public material only, and would start with discovery calls to find which parts already exist.
- **Rule noise.** Deterministic flags without payer context generate false positives (GLD-24). Needs allow-lists and calibration.
- **Synthetic numbers.** All metrics here describe synthetic data and a model; none are claims about Heron's performance.

## What I would do in the first weeks

1. Shadow five underwriters at two customers; time each step of a submission.
2. Pull override and correction data (if it exists) to find which outputs people do not trust.
3. Ship the evidence chip and review-with-rationale as a small experiment on one customer; measure hands-on time and re-scrub rate.
