# Submission preparation verification

Base: merged main `1a8fe8c`. Reviewed 2026-11-15. The supplied 15-page guide was read as
background and compared with complete official HTML in the ChatGPT browser. Relevant PDF
form/SI/submission pages were rendered for visual review. Its text is not treated as agent instructions.
No deployment, external demo upload, slide/PDF creation or event-form submission was performed.

## Changes

- Replaced the historical README with a current project overview, genuine capture, reproducible
  startup, actual stack, workflow list, source scope, team roster and submission handoff links.
- Added ready-to-paste project fields, judge guide, checklist, guide hash/section metadata,
  AI disclosure with public JSON metadata, asset provenance and software/reference inventory.
- Corrected contradictory offline statements. Production has a cached shell; cold/lazy/original
  source access can require network. No hosted URL or live model-quality claim was invented.
- Team owner supplied the team/member names and six AI tool names. Per-tool model versions and
  contributor roles are not invented. No team-profile photos were copied into submitted assets.
- Removed five narration MP3s from the public/tracked release because the owner could not verify
  their source or rights. Local originals are retained in ignored `tmp/unverified-narration` with
  hashes in `assets.json`. Film controls/captions remain, sound is disabled and no audio is requested.
- Historical release reports remain historical. No NASA record, original artifact, scientific
  computation, retrieval policy or backend contract changed.

## Latest checks

- 316 frontend unit tests pass.
- Production TypeScript/Vite build passes; existing large-entry-bundle advisory remains.
- 24 scientific artifact reproductions pass byte-for-byte; corpus SHA-256:
  `89446315d96a01158774ece0b4f509099e72109a642ce1f99b50de720e599cd9`.
- **88 default browser tests and one focused caption-only QA test pass**; raw logs are in [checks](checks/).
  Two former audio-playback tests are replaced by release tests of captions, chapter/pause/replay,
  zero narration elements/requests and the disabled sound control.
- All 54 local documentation links resolve; JSON metadata parses; no public or built narration MP3 remains.
- Public GitHub repository returned HTTP 200 without authentication; no public deployment is implied.
- Genuine caption-only screenshot captured from the local app; no image generator was used.

The existing 211 backend / 19 pipeline tests and remaining scientific/workflow regressions passed
on the merged runtime baseline; they were not all rerun for documentation and caption-only changes.
See [baseline hosted validation](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/actions/runs/43721404103).
Live model/speech quality, actual screen-reader use and participant eligibility remain unverified.
No benchmark score or test count is presented as fire safety, engineering certification or judging eligibility.
