# Combined PR #1–6 compatibility review

Inspected2026-11-15 IST. Default branch main at d7c53f4. This is a review report, not an
integration branch. No merges, cherry-picks or edits to other PR branches were performed.

## Actual state, rather than the stale prompt premise

| PR | Head | GitHub state | Relationship to current main |
|---|---|---|---|
|#1|feat/scientific-traceability|Merged by owner|Provenance/correction/missingness contracts already present|
|#2|feat/backend-evidence-api-current|Open|main separately integrates its foundation functionality; reconcile before attempting another merge|
|#3|feat/evidence-grounded-ai-assistant|Merged by owner|Optional TRACE alongside deterministic evidence already present|
|#4|feat/scenario-comparison-ranking|Merged by owner|Scenario/candidate/comparison policy already present|
|#5|feat/evidence-basket-research-exports|Open|ID-only baskets and deterministic briefs not assumed in PR #6|
|#6|feat/nasa-research-dataset-expansion|This independent PR|Direct main base; separate research collection only|

Evidence inspected: signed-in ChatGPT-browser PR descriptions/statuses, PR #5 Files changed
view, open-head Git three-dot diffs against origin/main, current-main code and each feature's
contract documentation. Existing PR #1/#3/#4 merges are not undone or misrepresented as open.
The issues page showed0 open issues; no invented issue references or automatic closures.

## Confirmed schema and source relationships

- **Original corpus:** src/data/corpus.json and public mirror unchanged byte-for-byte;
  SHA89446315d96a01158774ece0b4f509099e72109a642ce1f99b50de720e599cd9.
  ExperimentRecord, measurements, raw values, statuses, nulls, IDs, source locators, old
  source_manifest and pipeline/ingest.py are unchanged. Existing129/2 records preserved.
- **New research:** firetrace.research/1 in a separate public/data/research.json, authored
  curation, source inventory, generated coverage and validation.16 findings,3 investigations,
  2 report documents,8 selected linked artifacts,0 new normalized records. Stable report IDs
  have no experiment_id field and experiment_ids is empty. Sources reference investigation
  IDs separately from artifact IDs, preventing an implicit many-to-one row merge.
- **Provenance:** PR #1's existing table hashes/versions and metadata originals are reused as
  references. New source acquisitions/page hashes/locators/rights remain explicit. Legacy
  source manifest is not inflated, rewritten or declared to contain the new findings.
- **Versions:** legacy API X-Corpus-Version stays the exact unchanged experiment-corpus SHA.
  Research dataset_version is independently fingerprinted and always accompanied by the
  base_corpus_sha256. Keep both; a matching experiment SHA alone does not version reports.

## Confirmed shared files and possible textual conflicts

These are file overlaps, not claims of merge-conflict results. No trial merge was run.

| Pair | Confirmed overlap / interface | Resolution during later integration |
|---|---|---|
|#2 / #6|README.md, package.json, src/main.tsx, Atlas.tsx, Methodology.tsx (open-head diff)|Retain existing EvidenceSession/API fallback; add research view/coverage without replacing API-backed test browsing. Much #2 functionality is already on main; compare against current main before applying again|
|#5 / #6|README.md, package.json, src/main.tsx, Atlas.tsx|Combine package scripts and both CSS imports. Preserve BasketProvider inside existing evidence context and basket row buttons while retaining Atlas's lazy research mode. Neither module's new filename collides|
|#1 / #6|Source/measurement semantics|Already on main; no new changes to ExperimentRecord or original measurements. Do not backfill pressure from report subsets|
|#3 / #6|Future retrieval contract|No shared TRACE/backend file changed here. Add a separate report-evidence adapter later; do not pretend current Assistant retrieves this collection|
|#4 / #6|Future relevance/compare inputs|Existing scenario.ts/compare.ts untouched. Research metadata comparison only explains compatibility; no new ranking algorithm or report-statistic injection|

PR #5 uses researchData.ts, researchBrief.ts and researchFormats.ts; PR #6 uses
researchLibrary.ts, ResearchCoverage.tsx and ResearchLibrary.tsx. Similar names do not mean
the same schema. PR #5's brief JSON is a selection/report envelope over experiment records;
PR #6's JSON is a source-linked research collection. Preserve both schema identifiers.

## Backend/API and AI integration boundary

PR #6 adds no database, router or API response change. A later integration can add research
sources/findings in a separately versioned store/index, preserving NASA IDs, report pages,
evidence level and qualifications. Do not flatten report quantities into ExperimentRecord
numeric columns, or index them as if they were test measurements. Import in one validated
snapshot; verify both research and base identities. An API-only deploy will not acquire
these passages automatically. No external model calls or embeddings are required here.

TRACE should retrieve and cite verified finding IDs and resolve URLs from registered sources.
FIRETRACE paraphrases must remain attributed paraphrases; generated explanations must not be
stored as NASA original passages. Existing claim validators assume record-derived evidence;
they need an explicit report-evidence path, not broad relaxation of numeric checks.

## Comparison, ranking and basket compatibility

Solid-fuel spread and droplet burning/extinction may share a topic without supporting
interchangeable numeric comparison. Keep category/method/support/geometry/pressure/flow
and evidence level checks. Report pressure, method uncertainty or heat aggregates must not
become a shared per-record condition or a safety-relevance point. Neither report describes
a verified partial-gravity normalized dataset in this PR.

PR #5 baskets resolve existing experiment IDs against the unchanged base corpus; those IDs
remain valid and this research-only addition need not invalidate them. No finding becomes
a test basket item. A future research collection basket needs an explicit discriminated
item type and separate version identity. Briefs must separate selected test records from
report-level context and retain source/version/locator/status/limitations. Until then,
research JSON is independently downloadable and current briefs retain experiment scope.

## Recommended review and integration order

1. Review current main and already-merged #1/#3/#4 as the actual baseline; do not apply them
   again or reset owner merges. Confirm latest default before starting a review branch.
2. Reconcile open #2's remaining diff against the foundation already integrated on main.
   Decide whether any additional delta is still needed; PR #6 does not decide its disposition.
3. Review #6's source/page/rights/CSV discrepancy decisions and schema independently.
4. Review #5's persistent selection and selected-export workflows; combine the four confirmed
   shared files with #6 and keep report findings distinct from experiments. Reversing #5/#6
   is feasible because their experiment data contract is unchanged.
5. Review later API/report retrieval integration as explicit new work. Do not silently add
   report evidence to matching, model citations or scientific brief measurements.

No PR is merged by these recommendations. Actual conflicts and post-integration behavior
must be checked on a later authorized integration branch, not inferred from filenames.

## Checks to rerun on the combined result

- Full frontend tests/build; all eight routes, no-data/retry, keyboard navigation and responsive layout.
- Legacy ingestion9 checks + research10 checks, repeat-byte identity, source locks, both corpus
  identities, all16 PDF anchors, original131 record equality and download roundtrip.
- Full backend195 tests and API/bundle version mismatch/fallback, source and detail downloads.
- TRACE citation/abstention/provider-failure/follow-up tests; explicitly distinguish live vs mocked.
- Scenario validation/ranking/null-status/comparison policy fixtures, no droplet aggregate leakage.
- Basket add/reload/version review/remove/reorder/clear/Compare; regenerate stale briefs and all4formats.
- Research filters/results/source page fragments, metadata-source associations and source-specific rights.
- Browser suites with expected executable installed; native PDF/print is a PR #5 limitation, not
  covered by PR #6. No browser pass or live AI quality is implied by unit/API tests.

Known pre-existing documentation drift: data_dictionary.md quotes an older corpus hash and some
old README test totals; current code/data/results determine actual contracts. These broad historical
docs were not rewritten as part of dataset expansion. The new guide records this PR's actual counts.
