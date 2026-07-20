# Retrospectives

Postmortems on real mistakes made while building IFOC — not "what broke," but **why it happened**, so the same root cause doesn't produce a different bug later. Written when a `/code-review` pass or a design reversal catches something that should be understood, not just patched.

This is a different kind of document from `docs/decisions/` (ADRs record *why a choice was made*, forward-looking) — retrospectives record *why a mistake was made*, so they're inherently backward-looking and about process, not architecture.

| Doc | Description |
| --- | --- |
| [`2026-07-backend-implementation-lessons.md`](2026-07-backend-implementation-lessons.md) | 3 rounds of `/code-review` during the initial backend build, and one full architectural reversal (Kafka consumer retry logic). 5 root-cause patterns, most involving verification methodology, not raw coding mistakes. |
| [`2026-07-dashboard-metrics-review-lessons.md`](2026-07-dashboard-metrics-review-lessons.md) | The `/code-review` pass on the dashboard-operational-metrics change (10 confirmed findings). 4 root-cause patterns, headlined by a secondary write on the primary projection's critical path interacting with the poison-pill classifier to permanently lose events — two individually-correct mechanisms composing destructively. |
| [`2026-07-observability-review-lessons.md`](2026-07-observability-review-lessons.md) | The `/code-review` pass on the add-observability change (7 confirmed findings). 5 root-cause patterns, two of which are direct recurrences of patterns this repo had already written down — the core lesson is that documenting a pattern once wasn't enough to stop it recurring in a different file. |
| [`2026-07-rule-engine-review-lessons.md`](2026-07-rule-engine-review-lessons.md) | The `/code-review` pass on the add-rule-engine change (10 confirmed/plausible findings). 6 root-cause patterns; the headline one isn't a coding mistake — 3 of the 10 findings are conventions this same agent had already applied correctly earlier in the same session, not reapplied to this change's own new artifacts. |

## When to add one

After any `/code-review` pass finds CONFIRMED bugs that share a root cause worth naming, or after a design decision gets reversed post-implementation. Not for routine bug fixes with no generalizable lesson — the bar is "would a future agent (or the same one) make this exact class of mistake again without this being written down."
