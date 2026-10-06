# Demo video script

Video: [`triage-desk-demo.mp4`](triage-desk-demo.mp4), 1080×1920, 71 s, 30 fps. Captions: [`captions.srt`](captions.srt).

Recorded as one continuous scripted run of the real app in a 432×690 phone viewport at 2.5× pixel density (1080×1725 frames), with a caption band below. The pointer highlight, click ripples and zooms are drawn from the pointer positions, clicks and element boxes logged during that run. Nothing on screen is staged; all data is synthetic.

| Time | Scene | On screen | Voiceover |
| --- | --- | --- | --- |
| 0:00.0–0:10.6 | Submission inbox | Inbox with 12 synthetic submissions, completeness badges and SLA clocks; zoom on the queue header. | This is the Submission Triage Desk, a concept extension of Heron for a fictional funder. Twelve broker submissions sit in the shared inbox, each with its ask, completeness and a live SLA clock. |
| 0:10.6–0:18.5 | Open a submission: classified documents | Tap Bluewave Auto Detailing (SUB-2047); stepper, then the classified attachment stack with confidence bars and reclassify selects. | I open Bluewave Auto Detailing. Before anyone touched it, every attachment was classified, with a confidence score and a one-click reclassify. |
| 0:18.5–0:25.3 | Extraction with evidence chips | Tap the monthly-revenue evidence chip; the source drawer opens on Jun_2026_statement.pdf with the exact line highlighted. | Every extracted number carries an evidence chip. Tap one, and the source statement opens on the exact line it came from. |
| 0:25.3–0:35.2 | Scrub flag: review and confirm | Close the drawer; the balance-arithmetic flag shows its rule and evidence; type a rationale and tap Confirm issue. | The scrub engine re-adds every running balance. One printed balance does not follow. The rule is shown, and the flag waits for a person. I confirm it, with a reason. |
| 0:35.2–0:42.2 | Evaluation rules | Credit policy v3 rules, each with pass/fail and the reason. | The funder's credit policy runs as explicit rules, pass or fail, with the reason. Passing never approves a deal. |
| 0:42.2–0:50.6 | Decision-ready export | Pick "Decline: suspected fraud", type the rationale, Mark decision-ready, then Export JSON from the CRM-style package. | With every flag reviewed, I choose an outcome, write the rationale, and export a CRM-ready package. Every step lands in the audit trail. |
| 0:50.6–0:57.6 | Eval lab | Switch to Eval lab: catch rate 94.7%, 1 false positive, 1/6 clean stacks flagged, 22/24 exact. | The eval lab scores the engine on twenty-four seeded submissions. Eighteen of nineteen defects caught, one false positive. |
| 0:57.6–1:04.3 | The honest miss | Scroll to the honest miss card (GLD-23) and the documented false positive (GLD-24). | And here is the honest miss: a re-typed statement with consistent balances. Catching that needs bank-sourced data. |
| 1:04.3–1:10.6 | Close | Scroll to the footer with the non-affiliation notice. | Submission Triage Desk. Independent concept by Ayo Ahmed. Not affiliated with Heron. |

Voiceover is a local text-to-speech placeholder Ayo can record over using the same timings.
