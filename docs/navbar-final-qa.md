# Navbar repair and final local QA

Date: 2026-11-15. Branch: `codex/cinematic-overview`, existing PR #9. Main baseline:
`8a7304083dc193173029cc9ff891d64b810b23e5`. No merge or deployment.

## Result

All 17 main page tabs are rendered directly in the header. At 768px and above they wrap;
on phones they remain a native horizontal tab strip. Menu remains a supplementary complete
index. Keyboard focus scrolls tabs naturally; the active tab is revealed after route, viewport
and font changes. Header height is measured rather than guessed, so content clears all rows.

Cause: older CSS hid the nav below 1400px (with additional older hide rules at other sizes),
and the shell mapped only six primary routes. The final imported navigation stylesheet overrides
those rules deliberately. A narrow-screen Graph overflow uncovered during review was fixed by
using a zero-minimum grid track, allowing its internal table scroller to contain long IDs.

## Verification

- Production TypeScript/Vite build and 316 frontend unit tests pass.
- 211 backend tests, 19 pipeline tests and all 24 scientific artifact checks pass.
- 88 default browser tests, including eight new navbar tests: seven widths (320, 390, 714,
  768, 1024, 1440, 1920), every page tab, keyboard activation, active state and resize.
- Six actual-API tests (including Swagger capture), two TRACE, five integration and 33 expanded
  QA cases pass: 134 suite executions, not unique features. Final layout cases were repeated
  after the narrow-screen Graph fix.
- Chromium, Firefox and WebKit each pass all seven navbar widths; active Graph tab stays visible
  and the document has no horizontal overflow. Genuine screenshots and machine-readable results
  are in [navbar evidence](evidence/pr9/navbar/).
- 36/36 deterministic assistant benchmark cases pass. The 30-question evaluation has zero
  grounding-integrity problems; hit@5/abstention accuracy remain null because gold labels are absent.
- Existing scientific source files, corpus and calculations are unchanged. The benchmark's
  regenerated timestamp artifact is restored, and older screenshot sets remain historical.

The entire local regression set was rerun; the two final layout/font adjustments were followed
by another complete default browser run, unit/build checks and the affected viewport cases.
Live model/speech quality, real screen-reader use and physical-device performance remain
unverified. Research support only; no NASA endorsement or engineering certification.

## Open locally

Frontend: <http://127.0.0.1:5212/#/overview>
Backend readiness: <http://127.0.0.1:8022/health/ready>
API docs: <http://127.0.0.1:8022/api/docs>

Services are local, separate from other running project instances. Refresh the frontend; use
any visible tab or scroll the tab strip on a narrow screen. Research Library remains accessible
through Evidence Atlas. Reproduction commands and service startup are in
[the PR9 review](pr9-review.md#running-and-reproducing).

Final production entry JS+CSS grows by 5,400 gzip bytes (1.838%) versus main 8a73040,
within the <8KiB/<3% budget. Raw samples are in `evidence/pr9/after-navbar/`;
comparison is in `evidence/pr9/navbar/performance-comparison.json`. Local three-sample timings
are diagnostic only and do not establish real-device speed.
