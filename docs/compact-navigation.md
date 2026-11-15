# Compact navigation review

Updated 2026-11-15. The 17-tab header was crowded and the full-page Menu had large rows.

The new header keeps Overview, Atlas, Compare and Assistant visible. Research groups the
atmosphere, gap planner, coverage, verification, analysis, graph, evaluation and integrity tools.
Workspace groups Notebook, reports, exports, methodology/sources and system health. Desktop
uses one header row; tablet/phone layouts keep the same controls in a compact grid without
horizontal page scrolling or clipped dropdowns. Active secondary pages highlight their group.

Dropdowns support click/touch, ordinary Tab navigation, ArrowDown entry, Escape with focus
return, outside-click/focus dismissal and route-change dismissal. Menu is a bounded modal
with four accordion groups, one expanded at a time, opening to the current section. Close,
Escape and backdrop dismissal work; keyboard focus remains inside the modal. The command
palette, basket and footer links remain available. No route, evidence or calculation is removed.

## Git reconciliation

Remote main was force-reset from the prior release/submission history to `b79fbfb` (based on
`8a73040`) before this work. Its only new changes were Vercel settings, .vercelignore, package
engine metadata and deployment notes. An ordinary merge preserves those five files/changes
alongside the already-tested cinematic, navbar and submission work. No remote force push,
public deployment, data rewrite or credentials change is performed here.

## Validation

The focused navigation suite covers seven viewport widths (320, 390, 714, 768, 1024, 1440,
1920), all 17 destinations, dropdown bounds, active state, ArrowDown, Escape, outside click,
menu sizing and accordion expansion. The full default suite, existing modal accessibility/focus
checks and cross-browser review are recorded in [evidence](evidence/compact-navigation/).
Historical evidence directories remain unchanged. Scientific data and backend code are unchanged.
The raw corpus remains version `89446315d96a01158774ece0b4f509099e72109a642ce1f99b50de720e599cd9`.

The production TypeScript/Vite build, 316 frontend unit tests and all 88 default browser tests
pass. Final CSS alignment changes were additionally checked in Chromium/Firefox/WebKit at
320, 390, 1024 and 1440px (12 passes). Chromium axe checks for the desktop Research dropdown
and desktop/mobile Menu report no WCAG A/AA violations. Genuine screenshots include the
closed desktop/mobile header, desktop dropdown and compact desktop/mobile Menu. Existing
large-bundle warnings remain; no runtime dependency was added.

Both focused modal regressions (QA02 and QA20) pass: focus containment, all Menu destinations,
Escape/return focus, and automated accessibility with the record drawer. The accordion test
uses the explicit aria-expanded state rather than inferring expansion during the opening transition.
