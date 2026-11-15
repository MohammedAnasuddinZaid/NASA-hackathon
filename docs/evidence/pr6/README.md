# PR #6 evidence

Genuine captures from the working PR #6 app in the ChatGPT in-app browser, not generated images.
No external browser UI used. Screenshots show real preserved records or attributed report
findings; no synthetic experiments. Early captures may show an intermediate source inventory;
research-coverage.png and downloaded JSON contain the final8 selected artifact inventory.

- research-coverage.png: separate3 investigations /131 structured records /16 findings /2reports,
  combustion types, intent/platform metadata and source-scoped coverage.
- unchanged-bass-record.png: existing B1 corrected oxygen, null pressure and source provenance.
- bass-report-finding.png: oxygen method quantities/qualifications and original report citation.
- report-pressure-scope.png: report pressure remains a report subset, not a CSV measurement.
- flex-report-research.png / flex-investigation.png: droplet research, historical report scope,
  PSI/NTRS references and category distinction.
- flex-contamination-search.png: real query/filter result and qualified contamination finding.
- no-research-results.png: honest empty search state.
- cross-category-limits.png: explanation, not a false numeric comparison.
- methodology-research-sources.png: updated source entry points.

Actual browser-downloaded files: downloaded-research.json, downloaded-coverage.json and
existing-record-export.csv. Independent Python csv/json parsing established exact structured
equality with the final public snapshots and131 unchanged CSV rows with empty pressure cells.
download-validation.json records the final identity/counts; no download event is claimed
for an earlier unsuccessful native-link attempt. Final buttons use the existing Blob helper.

Executed results:169 frontend tests,195 backend,10 research pipeline,9 original ingestion;
production TypeScript/build passes. PDF hashes/page anchors checked with pypdf6.14.2;
pdf-verification.json/ingestion-validation.json contain actual reports. Repeated generation
compares every byte to committed mirrors in the tests. e2e-attempt.txt documents2 blocked
launches due missing Chromium headless-shell1254, not browser test passes. route-checks.json
contains actual eight-route heading/main checks, not a claim of exhaustive route testing.

Review of original PDFs also used local Poppler page renders, retained under ignored tmp;
they are not redistributed due report-specific rights/size. Browser viewport was desktop;
no mobile or cross-browser verification is claimed here. Logs and text artifacts have trailing
whitespace normalized only. Existing large-bundle/Starlette deprecation warnings remain.
