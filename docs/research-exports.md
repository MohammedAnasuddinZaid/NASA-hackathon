# Evidence basket and reproducible research products

PR #5 is based directly on current main d7c53f4. Main now contains integrations of
PRs #1–4, despite the supplied prompt's stale “all unmerged” statement. PR #2 remains
open; GitHub confirms PRs #3/#4 were merged by the repository owner. This work does
not merge or modify those PRs. Only the new branch feat/evidence-basket-research-exports
contains these changes.

## Collection workflow

Use **+ Basket** in Atlas, Compare source cards, or Gap Planner candidate cards.
The pressed state and global basket count reflect a single React Context above routing.
Atlas filters remain unchanged, duplicates are prevented and keyboard activation of
a basket button does not accidentally open its enclosing record row. The existing
Exports route contains the workspace; there is no ninth top-level route.

The workspace shows actual selected records, statuses, flags and source locators.
Open the existing provenance drawer, remove records, reorder with Up/Down, or choose
up to4 records for the existing Compare view. There is no second comparison engine.
More than4 basket records are supported; only the comparison chooser is limited.
Clear is a two-step inline confirmation; Cancel leaves selections intact.

Existing whole-corpus/claims/source-manifest downloads remain below an explicit
“Whole-corpus downloads — separate from your evidence basket” separator. They retain
their existing scopes and contracts; new basket outputs have distinct buttons/schema.

## Persistence, identity and dataset changes

localStorage key firetrace-evidence-basket-v1 stores schema1, ordered deduplicated IDs,
current corpus version, small per-record change fingerprints and a review-required flag.
It stores no copies of measurements, model keys, report title or research question.
Each reload resolves IDs against the current complete bundled corpus snapshot. Missing
IDs are removed with a notice; corrupt/unsupported/oversized storage starts empty with
a notice. Storage denial or quota failure leaves a working in-memory basket with a warning.
Tabs on the same origin receive storage updates; concurrent edits use last-writer-wins.
Different localhost ports have separate browser storage. No cloud synchronization.

Dataset identity is SHA-256 of the exact bundled corpus bytes, supplied by the existing
Vite configuration and included in every brief/export. FNV-1a-style32-bit fingerprints
are only inexpensive conservative change indicators, not security/authenticity proofs.
Dataset version changes always require explicit review, even if fingerprints match.
Changed or previously unverified fingerprints also require review. Current records are
always re-resolved, so saved measurements cannot silently survive a dataset change.
The review-required flag persists across reloads until acknowledged. Hash collisions
are possible in the small record indicator; corpus SHA/version review is authoritative.

Report settings and generated previews are intentionally ephemeral. Selection/settings
changes invalidate the preview and disable its downloads until a fresh brief is generated.
Reload keeps the basket but requires regeneration. No private research text is persisted
automatically. Displayed download feedback says a download was requested, not that a
file was saved; browser confirmation is outside the application's control.

## Deterministic summary and brief

researchBrief.ts takes ordered IDs, a ResearchSource adapter, explicit metadata/options
and a generation timestamp. Equal inputs and timestamp produce identical output.
Regeneration naturally changes its timestamp. No LLM, retrieval ranking, imputation,
averaging across investigations, risk estimate or scientific interpretation is added.

Required sections: FIRETRACE identity/title/timestamp/record count/dataset SHA; scope;
selected experiments with conditions/statuses; descriptive observations; comparison
limitations; optional missing-record detail; genuine source references; limitations
and a mandatory scientific disclaimer. Title (1–120 chars) and question (≤1000 chars)
are explicitly user-supplied purpose metadata, never verified findings.

Coverage is calculated only from the selected records. Available counts distinguish
measured/corrected, derived, approximate/qualitative and investigation context. Nulls,
unverified flags and over-range markers are not zero-filled or counted as usable
measurements. Lists of supporting IDs make counts reproducible. Qualitative outcomes
and burn durations are not promoted to standardized measured outcomes. Existing
comparabilityAudit supplies selection-specific method/material/configuration/gap findings.

The original per-field objects, raw strings, measurements, original/normalized units,
correction flags, provenance notes and null uncertainties remain unchanged in JSON.
Source references resolve from the existing manifest; no URL is constructed from an ID.
Only credential-free HTTPS citation URLs are linked. Missing title/URL metadata is
flagged. Source artifacts retain their versions, hashes, licenses and retrieval metadata.

Unknown pressure is scoped to imported records. BASS report pressure context elsewhere
is not assigned to rows. Orbital investigation labels are not per-test g measurements,
partial-gravity equivalence or transferable safety evidence. The reviewed corpus is not
all NASA combustion research; selection does not establish experimental equivalence.

## Supported output formats

| Format | Contents | Missing values / limitations |
|---|---|---|
| Basket CSV | Spreadsheet-safe long-form field and measurement-ledger rows, IDs, units/status/raw/source addresses, source table version/hash, dataset identity/time | Empty cells for null; row_kind separates repeated representations, not extra experiments |
| Basket JSON | Schema envelope, metadata/options, selected IDs/full original records, summaries, audit, citations/artifacts, limitations/disclaimer | Actual null retained; faithful original record/measurement objects |
| Markdown | Readable scientific brief and citations; optional detail tables/missing summary/source notes | Unknown shown explicitly; metadata/source text escaped |
| Printable HTML | Self-contained escaped report, tables, citation links and print stylesheet; no scripts or external assets | Open the downloaded file and use browser Print / Save as PDF. No direct PDF binary generation or tested PDF-save dialog is claimed |

All are FIRETRACE-derived research products, not untouched NASA originals. Existing
original-file downloads remain in provenance views. Source PSI data attribution/CC0
metadata are preserved. Research generation is deterministic; Codex assisted project
implementation/tests/docs, not scientific inference inside the generated brief.

### JSON schema firetrace.research-brief/1

Top-level: schema_version, dataset_version (corpus SHA-256), generated_at (UTC ISO),
identity, user_metadata, options, selected_ids, record_count, records, summary,
comparisons, citations, limitations, disclaimer. summary contains investigation
counts/record IDs, coverage/status counts with contributing/missing IDs, standardized
measured outcome count, corrected IDs and approximate/qualitative IDs. citations
contain experiment/source IDs, title, locator, DOI, verified HTTPS URL or null,
source artifacts and an explicit metadata limitation where necessary.

Options detailed/includeMissing/includeSourceNotes control preview/Markdown/HTML
presentation only; JSON always retains the full record layer. A concise presentation
cannot remove source statuses, the core unknown values or the disclaimer.

### Basket CSV columns (26)

row_kind; experiment_id; investigation_id; investigation; material; quantity;
normalized_value; normalized_unit; status; original_value; original_unit; note; basis;
source_file; source_locator; source_url; doi; quality_flags; dataset_version; generated_at;
measurement_id; measurement_phase; uncertainty; investigation_table_title;
investigation_table_version; investigation_table_sha256.

record_field rows serialize normalized per-field objects, including missing fields.
measurement_ledger rows preserve the independent original/normalized measurement
ledger and its IDs/phase/uncertainty. Do not sum these rows as independent tests.
Original unit is blank for a normalized field without that attribute; the ledger retains
known original units. Table version/hash identify the investigation's original table;
source_file/locator retain field/measurement-specific addresses.

CSV uses quoted fields with doubled quotes and CRLF records. Spreadsheet formula-like
text starting with =,+,-,@ after whitespace/control/format characters is prefixed with
an apostrophe. Actual numeric zero/negative values remain numeric. This intentionally
changes dangerous textual spreadsheet representations; JSON preserves exact raw strings.
The same protection now applies to legacy record/claim CSV exports. Existing column
contracts remain unchanged. Download object URLs are cleaned up after a delay rather
than being revoked before the browser has consumed them.

Filenames firetrace-evidence-brief-YYYY-MM-DD.ext derive from the actual generation
instant in Asia/Kolkata, matching the team's date; metadata timestamps remain UTC.
Different regenerated reports on the same date can share filenames; browsers may append
a duplicate suffix. The application does not overwrite existing local files.

## Architecture and integration

- researchData.ts: small complete snapshot adapter (all/resolve/artifacts/version/limitations).
- basket.ts: pure validation, persistence serialization and ordered-ID actions.
- basketContext.tsx: lightweight provider, notices, storage synchronization and shared controls.
- researchBrief.ts: deterministic facts/coverage/citations/metadata validation.
- researchFormats.ts: CSV/JSON/Markdown/HTML formatting and escaping.
- ResearchWorkspace/ResearchBriefPreview: collection, generation controls and accessible preview.
- Existing RecordDrawer, comparabilityAudit, SourceLink, data corpus and download utilities reused.

No new runtime library/backend/schema/AI service. Future API adapters must prefetch a complete,
version-verified snapshot before exposing synchronous resolution; do not mix partial pages or
different corpus versions. Existing backend endpoints are not required for basket operation.
The basket explicitly exports bundled snapshot evidence, even when API browsing is connected.

PR #1 traceability is already available on main; no provenance schema rewrite. Main already
contains PR #2/#3/#4 functionality, so this branch uses it directly without copying feature
branches. Shared review files include main/AppShell, Atlas, Compare, GapPlanner, Exports and
export.ts. Combine provider wrapping and record actions if integrating concurrent work.
PR #3 model prose is not included as verified report findings. PR #4 contributes its existing
candidate UI/record IDs and shared audit; heuristic points are not scientific export facts.

For PR #6: complete submission/AI-use attribution, native print/PDF cross-browser review,
keyboard/focus audit and missing Playwright browser installation, then run combined regression
flows on the final integration branch. Do not remove corpus identity, status/notes or disclaimers
for presentation polish. No PR was merged or publicly deployed by this work.

## Verification and local use

Baseline main:137 frontend tests/build passed. Backend initially had2 temporary-directory
setup errors (missing tmp parent); after creating it all195 backend tests passed. Backend
and scientific data are unchanged by PR #5. Final frontend:186 tests, including44 new domain,
format/security/download checks and5 rendering tests; production build passes. Existing
large-bundle and Starlette/httpx deprecation warnings remain. No lint script exists.

Two isolated Playwright workflows are included but were blocked before page launch by missing
Chromium headless-shell1254. No automated browser pass is claimed. ChatGPT browser verified
the full collection→cross-page→detail→Compare→brief→four downloads→reload→remove→regenerate
journey and clear/cancel. Basket and generated brief at390px have zero page-level overflow.

Actual browser-downloaded examples are in docs/evidence/pr5/generated. The independent
Python csv/json parser checks exact source-record equality, corpus SHA,62 CSV rows/26 columns,
null pressure, corrected B1 oxygen22.2%, Saffire thickness0.37cm→3.7mm, source locators and
real Markdown/HTML sections. No generated image or test result was fabricated.

```powershell
cd C:\Users\novaz\OneDrive\Documents\ChatGPT\NASA\FIRETRACE-research-exports
npm.cmd ci
$env:VITE_EVIDENCE_API='off' # optional: explicitly review bundled data without a backend
npm.cmd run dev -- --host 127.0.0.1 --port 5188
# In another terminal:
npm.cmd test
npm.cmd run build
npm.cmd run e2e:research # requires the expected Playwright browser
python scripts/validate-research-artifacts.py
```

Open http://127.0.0.1:5188/#/atlas. Search BASS2-B1; use + Basket; add SAFFIRE1-S1.
Navigate elsewhere and use Basket(2) to return. Inspect provenance, select both for Compare,
return, set report metadata and generate. Check corrected22.2%, unknown pressure,2 context-only
gravity labels and each CSV row2 source. Download all4 formats. Open HTML and print manually
if desired. Reload retains IDs; remove a record and regenerate to update scope. Clear requires
confirmation. Whole-corpus exports below remain separate. No backend/key/account is needed.
