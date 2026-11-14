# FIRETRACE build status

Updated 2026-11-14 for scientific-traceability PR #1. This is a review candidate, not a declaration of scientific certification.

- Record explorer: Vite/React/TypeScript, static bundled data.
- Upstream main (2fb1d12) already contains an optional local voice/backend; PR #1 adds no backend code or model integration.
- Corpus: 131 rows (129 BASS-II, 2 Saffire sample rows); 71 pipeline-validated / 56 partial / 4 suspect.
- Pressure and measured per-test gravity: 0 records. These are current CSV coverage gaps; BASS report context exists.
- 10 preserved artifact inventory entries, 8 small PSI originals downloadable unchanged; 3 context sources.
- Pipeline 0.2.0: deterministic output, source locks, byte-identical regeneration tests, original-unit and uncertainty fixes.
- Scientific review and validation evidence: docs/scientific-audit.md and docs/evidence/pr1/.
- Remaining: per-test mapping from reports, broader result ingestion, frontend/backend answer-parity expansion, source licensing review for additional reuse, submission packaging.
- No public deployment performed by this PR.

Run npm run build, npm test, npm run e2e, npm run benchmark, and npm run validate:data (Python dependency setup in README). No lint script is configured. The build includes TypeScript checking. The bundle-size warning is known.
