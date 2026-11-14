# Genuine PR #5 evidence

All images are actual ChatGPT in-app browser captures. All generated/selected-evidence.* files
were downloaded using the application's real buttons and copied unchanged for review.
The report question is QA purpose metadata, not a scientific finding. Source PSI attribution
and licenses are retained in JSON citation artifacts. Nothing is an untouched NASA original.

- empty-basket.png, atlas-basket.png: empty state and real cross-page controls/counts.
- basket-workspace.png, basket-provenance.png: actual selections and existing record drawer.
- research-brief-preview.png: generated sections/measurements/identity.
- printable-html-report.png: actual downloaded HTML opened locally for inspection.
- selection-updated.png: one-record scope after removal/regeneration.
- mobile-basket.png/mobile-brief.png: actual390px layouts, zero page-level overflow.
- download-checks.json: confirmed formats; original download filenames use the real local date.
- artifact-validation.json: independent parser results for exact source record/corpus identity.
- frontend-tests.txt/build.txt: actual command output; existing build-size warning remains.

Baseline137 frontend +195 backend pass. Final186 frontend pass (44 domain +5 UI additions).
The first backend baseline run had2 setup errors because tmp's parent was absent; after creating
it, all195 passed. No backend/data changes. No lint script is configured.

npm run e2e:research attempted2 tests; both blocked before launch by absent Playwright
Chromium headless-shell1254. The full journey was instead executed in ChatGPT browser:
add/search→navigate→basket→detail→Compare→brief→download4 formats→reload→remove/regenerate
and clear/cancel. No automated end-to-end pass, PDF-save dialog or direct PDF binary is claimed.

Run python scripts/validate-research-artifacts.py to independently verify the actual downloaded
examples:2 records,62 CSV rows,26 columns, exact JSON record equality, source SHA, unknown
pressure, corrected22.2% oxygen, original0.37cm/normalized3.7mm thickness and citations.
`nCommitted text evidence has trailing whitespace normalized; report content is unchanged.
