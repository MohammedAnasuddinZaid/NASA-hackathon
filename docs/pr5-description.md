## 1. Summary

Adds a persistent evidence basket and a deterministic workflow for turning selected records into source-linked research briefs and real CSV/JSON/Markdown/printable HTML downloads. Selections survive navigation/reload; dataset changes trigger re-resolution/review. Missing measurements, correction statuses and source addresses remain intact.

Independent branch `feat/evidence-basket-research-exports` starts directly from current `main` **d7c53f4**. The prompt's “all previous PRs unmerged” state was stale: owner has merged PRs #1/#3/#4, and current main also integrates PR #2 functionality while PR #2 remains open. This work copied no unmerged implementation, modified no existing PR branch and merges nothing. Codex assisted implementation/tests/documentation; human scientific review remains necessary.

## 2. Previous Behavior

Exports supported all-corpus/investigation CSV/JSON and audit artifacts. Compare and Gap Planner had local selections but no reusable research collection. There was no persistent basket, version-aware saved ID validation or deterministic selected-evidence brief. Existing CSV quoting escaped delimiters but did not protect spreadsheet formula-like text; download object URLs were revoked immediately.

## 3. New Features

- **Evidence Basket:** genuine IDs only, deduplication, ordered review, remove/reorder, explicit clear/cancel, global count and provenance/source access.
- **Cross-page selection:** Atlas row buttons preserve filters and stop row-opening keyboard/click propagation; Compare source cards and current-main Gap Planner candidates reuse the same controls.
- **Workspace:** within existing Exports route, empty state/Atlas action, up-to4 explicit choices sent to existing Compare, return link and source/detail review. Whole-corpus downloads remain separately labelled.
- **Scientific summaries:** selected-scope investigation/coverage/status/correction/approximation counts, supporting IDs and existing comparabilityAudit. No averaging unlike quantities, AI inference, ranking or safety claims.
- **Research briefs:** title/question identified as user purpose, fixed-input reproducibility, dataset SHA/time/scope, selected values/statuses, observations, comparison limitations, gaps, citations and mandatory disclaimer. Detail/missing/source-note presentation options.
- **Exports:** real CSV/JSON/Markdown and self-contained print-friendly HTML. CSV text injection protection also hardens legacy exporters; delayed Blob URL cleanup improves download reliability.
- **UX:** persistence/error notices, dataset-review gate, stale preview invalidation after selection/settings change, keyboard controls and responsive header/basket/report layout.

## 4. Architecture

```text
current bundled corpus + SHA-256 identity + source manifest
  -> ResearchSource snapshot adapter
  -> ID-only basket snapshot / validation / React Context / localStorage
  -> selected records + explicit metadata/options/timestamp
  -> deterministic brief / coverage / existing comparabilityAudit / citations
  -> React preview and CSV / JSON / Markdown / printable HTML
```

researchData.ts is the small all/resolve/artifacts/version/limitations adapter. basket.ts contains pure actions/hydration/persistence; basketContext.tsx supplies shared controls. researchBrief.ts generates facts and verified references; researchFormats.ts formats/escapes; existing drawer/download/export/audit helpers are reused. No runtime dependency/backend/schema/AI service added.

Storage saves ordered IDs, corpus version, small noncryptographic record fingerprints and reviewRequired, never copied measurements or credentials. IDs resolve freshly on reload; stale IDs are removed with notice; corrupt/unsupported storage resets safely; denial/quota failure leaves in-memory operation. Dataset version changes always require review, persisted across reloads. Fingerprints are conservative change indicators, not authenticity proof. Same-origin tabs synchronize; concurrent edits are last-writer-wins. Report metadata/previews are not persisted automatically.

## 5. Scientific Integrity

JSON retains exact original record/measurement objects, nulls, original/normalized units, corrections, flags, notes and source artifacts. Coverage separates measured/corrected, derived, qualitative/approximate and investigation context. Qualitative annotations/burn times do not become standardized outcomes. No unknown pressure is filled and no per-test gravity is inferred.

Citation title/DOI/URL/locator come from existing source metadata, not ID templates or model prose. Missing metadata is flagged; only safe credential-free HTTPS citation URLs are linked. User title/question are unverified purpose metadata and escaped in document formats. Mandatory disclaimer excludes comprehensive NASA review, fire prediction, material certification, spacecraft compliance and endorsement. Research selection does not establish experimental equivalence.

## 6. Export Formats

| Format | Implemented | Contents | Limitations |
|---|---|---|---|
| CSV |Yes|26-column long-form normalized fields + original measurement ledger; stable IDs, statuses/units/raw, source table version/hash, dataset SHA/time|row_kind distinguishes repeated representations, not independent experiments; null→empty; dangerous spreadsheet text prefixed with apostrophe|
| JSON |Yes|firetrace.research-brief/1 envelope, full original records, metadata, summaries, citations/artifacts, limitations|Null/raw strings preserved; no UI/credential state; presentation options do not remove original science data|
| Markdown |Yes|Structured evidence brief, optional tables/gaps/notes and genuine citations|Escaped text; purpose metadata is not evidence|
| Printable HTML |Yes|Self-contained report/tables/citations/print CSS, no scripts or external assets|Open downloaded file and browser Print/Save as PDF; native PDF-save dialog not verified|
| Direct PDF binary |No|Not implemented or claimed|No new PDF dependency|

Filenames derive from the actual generation instant in Asia/Kolkata; metadata uses UTC. Formats are FIRETRACE-derived products, not original NASA artifacts. Existing whole-corpus CSV columns remain unchanged, with spreadsheet text sanitization added. Full schema/columns: [research export guide](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/evidence-basket-research-exports/docs/research-exports.md).

## 7. GitHub Issues

Issues page showed0 open issues. No invented closing references. Hardened CSV formula-like text (including leading controls/formatting marks) and delayed immediate object-URL revocation, with regression tests. No fabricated before/after screenshot for a synthetic malicious text fixture. Real scientific records were not altered to demonstrate these cases.

## 8. Screenshots

Actual ChatGPT in-app browser captures and actual UI-downloaded examples; no generated screenshots.

![Atlas basket controls](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/evidence-basket-research-exports/docs/evidence/pr5/atlas-basket.png)
![Collected evidence](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/evidence-basket-research-exports/docs/evidence/pr5/basket-workspace.png)
![Deterministic brief](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/evidence-basket-research-exports/docs/evidence/pr5/research-brief-preview.png)
![Downloaded printable HTML](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/evidence-basket-research-exports/docs/evidence/pr5/printable-html-report.png)

[Mobile basket](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/evidence-basket-research-exports/docs/evidence/pr5/mobile-basket.png), [mobile brief](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/evidence-basket-research-exports/docs/evidence/pr5/mobile-brief.png), [provenance/empty/updated scope and test evidence](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/tree/feat/evidence-basket-research-exports/docs/evidence/pr5).

Real downloaded outputs: [CSV](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/evidence-basket-research-exports/docs/evidence/pr5/generated/selected-evidence.csv), [JSON](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/evidence-basket-research-exports/docs/evidence/pr5/generated/selected-evidence.json), [Markdown](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/evidence-basket-research-exports/docs/evidence/pr5/generated/selected-evidence.md), [HTML](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/evidence-basket-research-exports/docs/evidence/pr5/generated/selected-evidence.html).

## 9. Testing

| Test / Check | Command | Result | Notes |
|---|---|---|---|
| Main frontend baseline |npm test; npm run build|137 tests +build pass|Before changes|
| Main backend baseline |pytest backend/tests|195 pass after temp setup fix|Initial2 missing-tmp-parent setup errors; no backend changes|
| Final frontend |npm test|186 pass|44 new domain/security/format/download and5 rendering tests|
| TypeScript/build |npm run build|Pass|Existing large-bundle warning|
| Downloaded artifact validation |python scripts/validate-research-artifacts.py|Pass|Independent csv/json parsers; exact source equality;62 rows/26 columns|
| Isolated E2E |npm run e2e:research|Blocked before browser launch|Missing Chromium headless-shell1254;2 workflows included, no pass claimed|
| ChatGPT browser |Full requested collection/report/download journey|Verified|Actual4 downloaded files, reload/removal/regeneration, clear/cancel, keyboard controls|
| Responsive |390px basket and generated brief|Zero page overflow|Fixed long hash wrapping/header; temporary viewport restored|
| Diff/lint |git diff --check|Pass; lint not configured|Backend/source-data diff empty|

Storage tests cover duplicate/unknown/stale/corrupt IDs, version and fingerprint changes, review persistence, quota failure and ordering. Reports cover empty/mixed/single/full-corpus scope, raw/status/unit/source fidelity, missing metadata, reproducibility and metadata escaping. CSV tests include quoted multiline cells, formula injection, legitimate0/negative numbers and original units; Blob/download behavior is mocked separately. Existing Starlette/httpx warning remains.

## 10. Scientific Validation

The actual downloaded2-record JSON roundtrips BASS2-B1 and SAFFIRE1-S1 exactly against src/data/corpus.json. Its SHA matches the corpus bytes. B1 oxygen22.2% retains corrected status and PSI-25 CSV row2/DOI10.60555/4qc4-de67. Both pressures remain null/empty, gravity is2 context-only labels and0 per-test measured. Saffire ledger thickness retains original0.37cm and normalized3.7mm; approximate oxygen preserves raw21.5–21.7. No standardized outcomes are inferred. Removing B1 and regenerating updates the scope to1 record; stale2-record downloads are disabled.

## 11. PR Compatibility

Base is actual default main, not a feature branch. Owner merged PRs #1/#3/#4 before this task; main also contains PR #2 foundation code although that PR remains open. Those existing integrations are used as base code, not copied/cherry-picked into this feature. No earlier PR was modified/merged here.

Provenance mapping reuses PR #1 fields; future source fields extend the centralized mapper. Backend integration should supply a complete version-verified ResearchSource snapshot; do not mix API pages/versions. Current basket always resolves the bundled snapshot. PR #3 model prose is not verified brief evidence. PR #4 candidate buttons/IDs integrate directly because that UI is now on main; ranking points are not exported as scientific confidence. Shared AppShell/main/Atlas/Compare/GapPlanner/Exports/export.ts changes may overlap concurrent edits; preserve provider wrapping and original source/column contracts.

## 12. Breaking Changes

No backend API, database, scientific data or existing CSV column changes. Legacy CSV formula-like textual values are now prefixed for spreadsheet safety; this is an intentional serialization security change. JSON retains raw originals. New basket/report JSON has its own documented schema. Download cleanup is delayed; whole-corpus downloads retain their scope. New localStorage is origin-specific; report previews/settings reset on reload while IDs persist.

## 13. Known Limitations

No direct PDF generation or tested native PDF-save dialog. Automated E2E blocked by missing executable despite complete ChatGPT-browser verification. Browser storage may be unavailable/cleared; concurrent edits are last-writer-wins. Fingerprints are noncryptographic, with dataset SHA/version review authoritative. Corpus scientific limitations remain: incomplete pressure/dimensions/method/outcome fields, context gravity, approximate/corrected values and two investigations. No safety/compliance conclusions. Existing bundle/deprecation warnings; no new auth/cloud/model/deployment.

For PR #6, run combined integration/browser checks with the expected executable, audit focus/keyboard flow and native print/PDF across browsers, complete submission/AI-use attribution, and retain dataset/source/status/disclaimer distinctions when polishing the demo.

## 14. Manual Review Instructions

```powershell
cd C:\Users\novaz\OneDrive\Documents\ChatGPT\NASA\FIRETRACE-research-exports
npm.cmd ci
$env:VITE_EVIDENCE_API='off'
npm.cmd run dev -- --host 127.0.0.1 --port 5188
```

1. Open http://127.0.0.1:5188/#/atlas; search BASS2-B1, add with keyboard or button; add SAFFIRE1-S1. Filters remain and basket count becomes2.
2. Navigate elsewhere; return via Basket(2), reload and verify both IDs. Inspect sources/drawer and reorder.
3. Choose up to4 records for existing Compare and use its return link. Gap Planner candidates/Compare source cards also add/remove basket records.
4. Set report title/question/options; generate. Check corrected22.2%, unknown pressure, context gravity, statuses and row2 citations. User metadata is not science evidence.
5. Download CSV/JSON/Markdown/HTML. Validate JSON/nulls and CSV original/normalized units; open HTML for print. Examples/validator are committed.
6. Remove a record: previous brief downloads disable until regeneration. Clear→Cancel retains records; Confirm clear removes IDs only.
7. Run npm test, npm run build, python scripts/validate-research-artifacts.py; optional npm run e2e:research after installing the expected browser. Review schema and limitations; leave PR unmerged.
