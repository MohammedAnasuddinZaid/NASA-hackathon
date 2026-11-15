# Ready-to-paste project submission

Team: **The Code Blooded**. Use the sections below in the corresponding event form fields.
This is a prepared submission, not a claim that the event form is already submitted.
No verified per-field character limits were shown in the guide; shorten text if the live form asks.

## Project Name

FIRETRACE

## High-Level Project Summary

FIRETRACE helps researchers explore what NASA combustion evidence can—and cannot—say about
fire safety in space. Our interactive dashboard connects 131 BASS-II and Saffire-I experiment
records with original source rows, plus 16 separately curated BASS-II and FLEX report findings.
Users can search experiments, audit comparisons, explore cabin scenarios, ask cited questions
and export an evidence brief. Missing pressure, gravity and outcomes stay visibly unknown.
A deterministic assistant provides grounded answers and abstains when evidence is absent;
optional backend AI interpretation is supported but not required. We help people investigate
research rather than turn incomplete data into a claim that a material or atmosphere is safe.

## Link to Project Demo

**Team action remaining:** paste the publicly accessible link to your final <=30-second video
or <=7-slide English presentation. Do not paste localhost, a private file, or the internal
45-second explainer. Demo creation/upload is outside this work request.

## Link to Final Project

https://github.com/MohammedAnasuddinZaid/NASA-hackathon

This is the public source repository, with setup instructions and a judge's walkthrough.
A hosted app is optional and has not been deployed by this work.

## Detailed Project Description

### The problem

NASA has studied combustion in microgravity for decades, but experiments differ in material,
geometry, airflow, atmosphere, scale and method. Finding a number is easier than knowing whether
it applies to a new question. Lunar and Mars exploration make transparent access to this evidence
valuable; missing conditions must not silently become assumptions.

### Our solution

FIRETRACE is a working research dashboard built around source traceability. Evidence Atlas
searches and filters actual experiments; each detail view exposes original values, units,
transformations, source locators and quality flags. Compare checks consequential condition
differences. Gap Planner ranks scenario correspondence with a disclosed heuristic and lists
missing conditions without calculating a safety probability. The atmosphere tool shows Dalton's
law as a separate calculation, never a replacement for missing test pressure.

Evidence Assistant retrieves cited records, distinguishes absence from zero and abstains on
unsupported questions. Optional model interpretation stays behind the backend with evidence
validation; the default experience does not require a paid model or credential. We have not
verified live external-model or speech quality and do not claim that benchmark passes prove it.

Users can save records to a version-aware basket, build a Research Notebook, inspect an evidence
graph, verify claims, rerun corpus analyses and export concise briefs/reports. Source rows and
report pages stay reachable throughout. A separate Research Library offers eight BASS-II and
eight FLEX findings; liquid-droplet findings are not treated as equivalent solid-fuel tests or
included in numeric experiment ranking.

### NASA data and validation

The structured corpus contains 129 BASS-II table records and two Saffire-I sample records.
Original artifacts are preserved with hashes, versions and provenance. Unknown fields stay null.
The imported tables have no total pressure, measured per-test gravity, ignition method or
standardized outcome; the reports contain additional subset context that is not silently mapped
to every row. Four suspect records are retained with flags.

The merged release passed 316 frontend tests, 211 backend tests, 19 pipeline tests, exact-byte
checks for 24 scientific artifacts, a 36-case deterministic benchmark and browser regressions
covering the research workflows. These checks establish tested behavior, not engineering certification.

### Tools, impact and next steps

We use React, TypeScript, Vite, CSS/SVG, Python, FastAPI, Pydantic and SQLite/FTS. The core works
with bundled data; a matching local API adds query services. Cached core workflows can operate
offline after loading, but original PDFs/lazy assets and a cold cache can require a network.

Our intended impact is more efficient evidence review, clearer reporting gaps and more informed
research questions for human space exploration. Future work would normalize additional FLEX
records separately, expand verified source coverage and evaluate live interpretation with labelled
questions and expert review. No risk prediction, NASA endorsement or material certification is claimed.

## Use of Super Intelligence (SI)

Our team used ChatGPT, Codex, Claude Code, OpenCode, Cursor and DeepSeek as development assistants.
Codex assisted implementation, debugging, ingestion code, source review, tests, documentation
and submission preparation. We have not recorded exact per-tool task/model attribution for the
other tools, so we do not invent it. The team reviews the results and owns the final decisions.
Code and text include AI assistance; NASA measurements remain original-source data. Screenshots
are genuine browser captures, and SVG/CSS illustrations are conceptual code-based visuals.
The origin/rights of legacy narration were unverified, so those clips are excluded and captions
remain. Runtime answers default to deterministic cited retrieval; optional external-model
interpretation is implemented but live provider/speech quality is not claimed.

Full disclosure and metadata: https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/main/AI_DISCLOSURE.md

## NASA Data

- NASA PSI BASS-II / PSI-25: 129 structured experimental-table records; ReadMe, test matrix,
  calibration and metadata provide provenance/caveats. DOI: https://doi.org/10.60555/4qc4-de67
  Portal: https://psi.nasa.gov/physci/repo/data/investigations/PSI-25
- NASA PSI Saffire-I / PSI-98: two instrumented SIBAL sample records; image-set descriptor rows
  are excluded. DOI: https://doi.org/10.60555/0t15-1z43
  Portal: https://psi.nasa.gov/physci/repo/data/investigations/PSI-98
- Burning and Suppression of Solids-II (BASS-II) Summary Report, NASA/TM-20210011385:
  eight curated, page-cited findings. https://ntrs.nasa.gov/citations/20210011385
- Detailed Results From the Flame Extinguishment Experiment (FLEX) March 2009 to December 2011,
  NASA/TP-2015-216046: eight page-cited liquid-droplet findings.
  https://ntrs.nasa.gov/citations/20150023456
- FLEX / PSI-69: metadata and preserved original table; zero normalized test records in the app.
  https://psi.nasa.gov/physci/repo/data/investigations/PSI-69
- Lunar Combustion Investigation (LUCI): context only, not normalized or ranked as test records.
  https://ntrs.nasa.gov/citations/20250010653
- Official challenge framing: https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/

Full source hashes, locators, transformations and source-specific rights:
https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/main/docs/data_sources.md
https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/main/docs/research-expansion.md

## Space Agency Partner Data and Other References

No separate Space Agency Partner dataset is established in this implementation. We use the NASA
sources listed above, React/React DOM, TypeScript, Vite, Python, FastAPI, Pydantic, Uvicorn,
SQLite, the optional OpenAI SDK, and development/evaluation tools including Vitest, pytest,
Playwright and axe. Python ingestion uses openpyxl; PDF audits use pypdf. The optional legacy
voice stack has separate requirements and unverified model quality. Inter and Manrope fonts
are served through Google Fonts under the SIL Open Font License. The project repository
includes tool/software credits, dependency inventory and AI disclosure:
https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/main/THIRD_PARTY_NOTICES.md

## Team roster (if requested elsewhere in the platform)

The Code Blooded: Abhishek Kumar Gupta (Team Owner, @abhi298), Shiv Narain (@shivnarain99),
Mohammed Anasuddin Zaid (@mohd_anas176), Ansh Devkate (@insanhii), Om Rupesh Kodilkar (@xomyux).
No individual development-role allocation is asserted.
