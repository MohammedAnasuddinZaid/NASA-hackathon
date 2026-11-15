# PR2 merge reconciliation

On 2026-11-15 the user authorized conflict resolution and merging all remaining PRs.
PR7 was merged first; GitHub then marked PR5 and PR6 merged through their preserved history.
PR1, PR3 and PR4 were already merged. PR2 was the only remaining open feature PR.

PR2 head before reconciliation: ef603f7639f3904c7ceb225daef39cf894a7f9a9.
Latest main incorporated as the second merge parent: b0daf88e0f9dabe0affc7ec572649251adb91347.

The final-integration audit already established that PR2's scientific storage/API foundation
was incorporated into main and its remaining API browsing behavior restored by PR7.
This reconciliation retains the exact tested main application, scientific files, tests and CI.
No older TRACE, planner, basket, research or corpus guard code replaces the integrated versions.
Original PR2 commits remain in ancestry; no rebase, force push or branch deletion is used.

## Actual conflicts resolved

- `.env.example`
- `README.md`
- `backend/README.md`
- `e2e/app.spec.ts`
- `e2e/evidence.spec.ts`
- `playwright.config.ts`
- `scripts/evidence-test-server.mjs`
- `src/components/RecordDrawer.tsx`
- `src/lib/apiClient.ts`
- `src/main.tsx`
- `src/pages/Assistant.tsx`
- `src/pages/Atlas.tsx`
- `src/pages/Compare.tsx`
- `src/pages/Methodology.tsx`
- `tests/apiClient.test.ts`

All conflicts resolve to the reviewed main version for the reasons above. Before adding this
record, `git diff --cached --exit-code origin/main --` passed: the resolved tree was identical
to main. The only net PR2 change against main is this reconciliation record.

## Validation

PR7's 224 frontend, 210 backend, 19 pipeline and 42 local browser tests passed, with all three
hosted CI jobs green on commit1277779. The reconciled application has no code/data changes
relative to that merged result. Exact scientific byte regeneration and backend checks are rerun
locally; the new PR2 CI run must pass before its GitHub merge. Main's post-merge CI is also checked.
See docs/final-integration-review.md for the historical audit and documented research/AI limits.
