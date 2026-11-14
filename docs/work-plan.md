# MVP specification and work plan

FIRETRACE supports research into spacecraft combustion using preserved NASA evidence. It is independent research support, with no safety certification or NASA endorsement.

## Architecture
Retain Vite, React, TypeScript and bundled JSON for the current local explorer. The Python pipeline produces the corpus. A backend is needed only when a model integration is selected; credentials must remain server-side. Do not migrate frameworks merely to match the original proposed stack.

## Milestones and acceptance criteria
1. Correctness: specific assistant questions retrieve the requested reported quantity; named LUCI queries retrieve context; missing values stay missing. Comparisons expose dimensions and flow direction, use selection-specific caveats, and never imply certification. Export summary counts match the selected rows. Build, regression tests and browser flows pass.
2. Traceability: verify additional claims against reports; reconcile source downloads and metadata, document the field dictionary and provenance limitations. Do not generalize table omissions to all NASA research.
3. Scenario evidence: show candidate records with explicit matching/mismatching/unknown conditions. Relevance is not safety probability. Keep solids, droplets, orbital and simulated partial gravity distinct.
4. Submission: align presentation/video length to event guidance, disclose AI tools and media, attribute sources and code, and obtain authorization before public deployment.

## Progress — 2026-11-14
- Baseline reviewed in browser; 131 records retained unchanged.
- Fixed routing of named LUCI questions and explicit burn/ignition quantities.
- Added checks for differing sample dimensions and airflow direction; removed unrelated investigation caveats from same-family comparisons.
- Export quality counts now follow selection.
- Added regression tests for reproduced failures. Validation: production build passed; 88 unit tests, 20 end-to-end tests and the 30-question benchmark passed. The corrected Saffire burn-time and LUCI answers were also verified in the open browser.

## Remaining limitations
Assistant remains deterministic and supports a limited set of intents. Scenario planner remains a coverage checklist. No new model, dataset, safety prediction or deployment is introduced by this milestone. Source download documentation, scientific claim audit, accessibility and submission artifacts remain subsequent work.

PR #1 scientific traceability work is documented in scientific-audit.md: reproducible ingestion, scope corrections, original downloads, ledger and screenshots. Final checks: 89 unit / 23 browser / 9 ingestion / 20 existing backend tests; 30 benchmark cases.
