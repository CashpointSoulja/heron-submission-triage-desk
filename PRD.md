# PRD: Submission Triage Desk

**Status:** concept · **Author:** Ayo Ahmed · **Extends:** Heron intake, bank-statement scrubbing, decisioning and CRM delivery

## Problem

Small business funders (MCA, revenue-based finance, equipment, SBA lenders) receive most deals as broker emails with a stack of attachments. Before an underwriter can apply judgment, someone must sort the stack, extract the numbers, re-add the statements, cross-check identity details and assemble a package. That work is repetitive, error-prone and sits in front of every decision. Brokers send the same deal to several funders and the first credible offer usually wins, so queue time is lost revenue.

Heron already automates intake, classification, extraction, scrubbing and CRM delivery. The gap this concept explores is the **underwriter's surface for trust**: when the pipeline hands over a scrubbed deal, how does a person verify it in minutes, override it where it is wrong, and leave a defensible record?

## Users

| User | Job | What they need from the desk |
| --- | --- | --- |
| Underwriter | Turn a submission into a decision fast without missing fraud | Pre-scrubbed file, evidence one click away, clear list of what needs judgment |
| Underwriting lead / credit officer | Keep the book inside the credit box and the team inside SLA | Policy as explicit rules, queue SLA, time-to-decision, override visibility |
| Ops / ISO relations | Get incomplete deals fixed quickly | First-pass completeness and exact list of what is missing |
| Compliance / risk | Explain any decision later | Timestamped audit trail with actor, rule, evidence and rationale |

## Goals

1. Every submission is classified, extracted and scrubbed before a person opens it.
2. Every extracted number is traceable to a document, page and line.
3. Every automated check shows its rule; every flag needs a human verdict with a rationale.
4. The desk never approves. It produces a decision-ready package.
5. Accuracy is measured against a golden set, and the misses are shown, not hidden.

## Non-goals (V1)

- OCR of scans and photos (assumed solved upstream by the platform).
- Pricing, offer generation and contract.
- Live bank connections, bureau or background checks.
- Broker portal.

## Requirements

| # | Requirement | Acceptance |
| --- | --- | --- |
| R1 | Shared-inbox queue | Broker, business, ask, received time, completeness, flag count, SLA countdown; filter Open / Incomplete / Decision-ready |
| R2 | Document classification | Label from {application, bank statement, tax return, voided check, ID, unknown} with confidence; < 0.70 stays unknown with best guess; one-click reclassify re-runs every check and is audited |
| R3 | Extraction with evidence | Legal name, EIN, monthly revenue, ADB, positions, time in business, NSF count, owner; each with chips that open the source at the highlighted line |
| R4 | Scrub engine | 13 deterministic checks; each result has status, plain-English detail, rule text and evidence pointers |
| R5 | Credit policy | Rules rendered as "Where field op value"; pass / fail / unknown with reason; missing input is never a pass |
| R6 | Review | Confirm or override each flag with a rationale (required); reopen allowed until decided |
| R7 | Decision-ready | Blocked until all flags reviewed; outcome + rationale required; outcomes include request-docs and decline paths; no auto-approve |
| R8 | Export | Decision package as JSON and CSV; audit trail as JSON and CSV |
| R9 | Audit | Every system and human action with timestamp, actor, event and detail |
| R10 | Eval lab | 24 golden cases; catch rate, false positives, clean-case flag rate, per-check table, honest miss on screen |
| R11 | Metrics | Time-to-decision (measured), scrub time saved (modelled, assumptions visible), first-pass completeness |

## Key design decisions

- **Deterministic rules, not a model, for scrubbing.** Arithmetic, continuity and identity matching have right answers. Running them as code makes them testable, explainable and cheap. Probabilistic components (classification, OCR) are where confidence is surfaced.
- **Flags are questions, not verdicts.** A round-number deposit cluster can be a legitimate contract. The desk states the rule, shows the lines, and asks.
- **Unknown beats wrong.** Low-confidence classification and missing policy inputs stay unknown and block nothing silently.
- **Reclassification is a first-class action**, because a mislabelled tax return silently disables the EIN and owner checks (see SUB-2052).

## Risks

| Risk | Mitigation |
| --- | --- |
| Underwriters rubber-stamp flags | Rationale required; override rate per check reported to the lead (V2) |
| Rule noise erodes trust | Golden set with false-positive budget per check; payer allow-lists (V2) |
| Consistent forgeries pass every statement-only rule | Shown as the honest miss; needs bank-sourced data |
| Policy drift between desk and CRM | Policy versioned and stamped on every package |
