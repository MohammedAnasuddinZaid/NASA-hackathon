# FIRETRACE build status

Updated 2026-11-14. This is a review candidate, not a declaration of scientific certification.

- Record explorer: Vite/React/TypeScript, static bundled data.
- Corpus: 131 rows (129 BASS-II, 2 Saffire sample rows); 71 pipeline-validated / 56 partial / 4 suspect.
- Pressure and measured per-test gravity: 0 records. These are current CSV coverage gaps; BASS report context exists.
- 10 preserved artifact inventory entries, 8 small PSI originals downloadable unchanged; 3 context sources.
- Pipeline 0.2.0: deterministic output, source locks, byte-identical regeneration tests, original-unit and uncertainty fixes.
- Scientific review and validation evidence: docs/scientific-audit.md and docs/evidence/pr1/.
- Evidence API: complete at `/api/v1` with experiments, sources, coverage, compare, scenario evaluation,
  grounded answers, exports and health probes. It boots with no AI runtime.
- Assistant UI: calls the evidence API first, shows the corpus hash, validated-claim count and the
  validated claim text with its source locator, and falls back to the bundled deterministic engine
  when the API is unreachable.
- Unit suite: 80 Vitest tests passing.
- Backend suite: 155 pytest tests passing.
- Evaluation: `eval/run_eval.py` exits 0 with 0 integrity problems over 30 questions.
- Static build: passing (`npm run build`).
- End-to-end suite: 18 Playwright tests exist in `e2e/`, but they do not run on this machine
  because the OS application-control policy blocks the Playwright Chromium binary. No pass
  result is claimed here.
- Remaining: per-test mapping from reports, broader result ingestion, frontend/backend answer-parity
  expansion, source licensing review for additional reuse, submission packaging.
- No public deployment performed.

## Key counts

- Records: 131 (129 BASS-II, 2 Saffire-I)
- Quality: 71 validated, 56 partial, 4 suspect
- Total pressure reported: 0 / 131
- Measured per-test gravity: 0 / 131
- Standardized outcome: 0 / 131
- Initial O2 reported: 131 / 131 (range 13.6–22.2 %)
- Final O2 reported: 127 / 131
- Flow reported: 123 / 131
- Thickness parsed: 44 / 131
- Source artifacts: 8 PSI/NTRS artifacts plus 2 context sources
- Verified claims: 12
- Matrix cross-check: 129/129 test IDs, 129/129 initial O2 matches, 0 substantive conflicts
- `corpus_version`: recorded by `GET /health/live` and attached to every export.

Field-by-field counts and semantics are in `docs/data-dictionary.md` and `docs/data_dictionary.md`.

## Verification commands

Run npm run build, npm test, npm run e2e, npm run benchmark, and npm run validate:data (Python
dependency setup in README). No lint script is configured. The build includes TypeScript checking.
The bundle-size warning is known.

Web app:

```bash
npm install
npm run build
npm test
npm run benchmark
```

Evidence API:

```bash
cd backend
pip install -r requirements.txt
python -m pytest -q
python scripts/build_index.py
uvicorn api:app --host 127.0.0.1 --port 8000
```

Evaluation:

```bash
python eval/run_eval.py
```

End-to-end (requires an unblocked Chromium binary):

```bash
npm run e2e
```

## Known limitations

- The static bundle is a single large JavaScript chunk (about 1.73 MB raw, 172 KB gzip) because
  the corpus JSON is imported directly for offline use.
- Mobile Atlas hides some secondary columns to keep the table readable; the full record is
  available in the drawer.
- LUCI findings are context only and are not structured per-test records.
- The Gap Planner produces a checklist, not a protocol, prediction or certification.
- No external LLM or API is used; both assistants are deterministic retrieval.
- The overview narration is pre-recorded; it does not read live model output.
- The optional voice stack is not installed in this environment, so the voice routes were only
  tested for their structured `503 voice_unavailable` behaviour.
- `eval/run_eval.py` reports retrieval hit@5 and abstention accuracy as `null` with `0/30`
  labelled items. The shipped question set has no gold answers, so no metric is estimated.

## Not yet done

- Authorized deployment and domain configuration.
- Optional code-splitting of the corpus chunk.
- Gold answers for the 30 evaluation questions, which would enable hit@5 and abstention metrics.
- Additional accessibility audit beyond the Playwright smoke checks.
