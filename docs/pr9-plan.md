# PR #9: cinematic Overview, stable research workspace

Baseline: main `c53b915eac48530803ac01ae55f568edfa974734`; branch
`codex/cinematic-overview` in its own worktree. PR #8's branch is preserved, not merged here.
Main already includes the new 17-route workstation. Its latest CI fails on the visible logo /
accessible-name mismatch on all 17 routes. Address that shared label first.

## Milestones and acceptance

1. Reproduce main's unit/build/browser results and repair the observed CI blocker. Retain axe's
   WCAG checks rather than disabling them. Run the full existing suite after additions.
2. Add isolated original SVG/CSS starfield and rocket metaphor, six-scene Overview narrative,
   reusable reveal/motion utilities and a user pause control. Keep original hero, demo, charts,
   tools, navigation, source links and calculations. Read counts from the actual corpus.
3. Verify desktop/mobile, slow/fast/reverse scrolling, Back/hash routing, keyboard, user pause,
   reduced motion, disabled observers, hidden/offscreen lifecycle and genuine screenshot/video.
4. Compare the production bundle and local browser timings to the same baseline/method; add
   no runtime dependencies, per-scroll React updates, Canvas/WebGL or external visual assets.
5. Run all available unit/backend/scientific/browser suites, document scope/limitations and PR8
   integration overlap, and open one review PR. No merge or deployment.

## Scientific and accessibility boundaries

- Original rocket/orbits/stars are labelled as conceptual decoration, not NASA imagery,
  experiment hardware, observed trajectories, a flame simulation or evidence relationships.
- Counts reveal as final values; no count-up from fabricated intermediate values. Nulls are
  unknown; only actual zero *coverage counts* display zero, never unknown measurements.
- New content remains visible if observers/effects are disabled; no scroll snapping or hijack.
- Continuous decoration pauses offscreen/hidden, for reduced motion and on explicit user pause.
  Mobile uses static/simplified decoration. No automatic sound, flashing or mandatory motion.
- Dense research pages receive no animated backdrops. Changes are namespaced and removable.

Only the supplied additional PR9 prompt is available for this task; no separate earlier release
brief was attached. Existing submission/scientific documentation remains the reference. Final
verification and outstanding optional capabilities will be recorded in `docs/pr9-review.md`.
