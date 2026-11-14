# FIRETRACE build status

Last updated: 2026-11-14

## Status

- Application: complete and buildable.
- Design: startup product system with a strict three-color palette — black `#0B0B0C`,
  white `#FFFFFF`, lime `#C6F432` — and Manrope/Inter typography.
- Explainer: 45-second voiced walkthrough with five recorded narration clips and a
  browser-safe **Sound on** fallback.
- Data pipeline: complete; 131 normalized experiment records.
- Test suite: 80 Vitest unit tests passing.
- End-to-end suite: 18 Playwright tests passing, including narration playback and the
  blocked-autoplay prompt.
- Assistant benchmark: 30/30 questions passing.
- Static build: passing (`npm run build`).
- Screenshots: refreshed in `presentation/screenshots/`.
- Pitch deck: `presentation/pitch_deck.pptx` and `presentation/pitch_deck.md`.

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

## Verification commands

```bash
npm run build
npm test
npm run e2e
npm run benchmark
npm run shots
```

## Known limitations

- The bundle is a single large JavaScript chunk (1.70 MB raw, 163.5 KB gzip) because the
  1.86 MB corpus JSON is imported directly for offline use.
- Mobile Atlas hides some secondary columns to keep the table readable; the full record is
  available in the drawer.
- LUCI findings are context only and are not structured per-test records.
- The Gap Planner produces a checklist, not a protocol, prediction or certification.
- No external LLM or API is used; the assistant is deterministic retrieval.
- The overview narration is pre-recorded; it does not read live model output.

## Not yet done

- Authorized deployment and domain configuration.
- Optional code-splitting of the corpus chunk.
- Additional accessibility audit beyond the Playwright smoke checks.
