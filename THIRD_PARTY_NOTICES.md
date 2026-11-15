# Sources, software and media credits

FIRETRACE by The Code Blooded. This notice separates source data, project code, tools and media.
It is an attribution record, not a claim of NASA endorsement or a blanket relicensing statement.

## NASA resources

| Resource | Role and attribution | Rights record |
|---|---|---|
| [BASS-II / PSI-25](https://doi.org/10.60555/4qc4-de67) | 129 table records; original CSV, ReadMe, matrix, calibration and metadata | PSI source artifacts list CC0 1.0; retain DOI/provenance |
| [Saffire-I / PSI-98](https://doi.org/10.60555/0t15-1z43) | Two instrumented sample records and documentation | PSI source artifacts list CC0 1.0 |
| [FLEX / PSI-69](https://doi.org/10.60555/mbq8-0451) | Metadata/original CSV preserved; zero normalized FLEX records | PSI CC0 record; keep droplet results separate |
| [BASS-II Summary Report](https://ntrs.nasa.gov/citations/20210011385) | Eight page-cited paraphrased findings | NTRS source-specific notice; not relabelled CC0; PDF linked, not bundled |
| [FLEX Detailed Results](https://ntrs.nasa.gov/citations/20150023456) | Eight page-cited paraphrased findings | NTRS Public Use Permitted record; PDF linked, not bundled |
| [LUCI](https://ntrs.nasa.gov/citations/20250010653) | Context only, not structured tests | NTRS source-specific notice |
| [Official challenge](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/) | Challenge framing and attributed planning context | Linked official text; no NASA logo/artwork reproduced here |

Original hashes, filenames, versions and limitations are in [source manifest](src/data/source_manifest.json),
[data sources](docs/data_sources.md), [research expansion](docs/research-expansion.md) and
[research manifest](public/data/research.json). Contractor/contributed material can carry distinct
rights; no claim that all NASA content is public domain is made. See [NASA STI notices](https://sti.nasa.gov/disclaimers/).

## Software and fonts

| Component | Use | Upstream license / source |
|---|---|---|
| React / React DOM | Interface | MIT; https://github.com/facebook/react |
| TypeScript | Type checking | Apache-2.0; https://github.com/microsoft/TypeScript |
| Vite / Vitest | Build and unit tests | MIT; https://github.com/vitejs/vite ; https://github.com/vitest-dev/vitest |
| FastAPI / Pydantic | Evidence API and validation | MIT; https://github.com/fastapi/fastapi ; https://github.com/pydantic/pydantic |
| Uvicorn | Local ASGI server | BSD-3-Clause; https://github.com/Kludex/uvicorn |
| SQLite | Local query index/history | Public domain; https://www.sqlite.org/copyright.html |
| Playwright / axe-core | Browser and automated accessibility checks | Apache-2.0 / MPL-2.0; https://github.com/microsoft/playwright ; https://github.com/dequelabs/axe-core |
| pytest / HTTPX / python-dotenv | Tests, HTTP and configuration | MIT / BSD-3-Clause / BSD-3-Clause; metadata inventory below |
| openpyxl / pypdf | Source workbook ingestion / PDF auditing | MIT / BSD-3-Clause; upstream package metadata |
| OpenAI Python SDK | Optional server-side interpretation | Apache-2.0; https://github.com/openai/openai-python |
| Inter | Google Fonts stylesheet | Copyright 2020 The Inter Project Authors; SIL Open Font License 1.1; https://github.com/rsms/inter |
| Manrope | Google Fonts stylesheet | Copyright 2018 The Manrope Project Authors; SIL Open Font License 1.1; https://github.com/googlefonts/manrope |

Exact resolved npm versions/declared licenses and Python requirement/distribution metadata are
recorded in [dependency inventory](docs/submission/dependency-inventory.json). Platform-specific
and optional npm packages are included even if not installed here. Python optional voice
requirements are separately labelled by their requirements file; they are not necessary for the
core evidence API. Retain upstream license files when redistributing dependencies. This inventory
is not an exhaustive legal review or a model-weight license grant.

Inter and Manrope are loaded remotely through Google Fonts; local fallback fonts work without
that request. The authoritative [Inter OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt)
and [Manrope OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt) were checked
for this notice. No font binaries are newly vendored by this change.

## Project code, AI assistance and media

The repository owners have not selected a repository-wide code license. Sharing the public source
for judging does not change third-party licenses. No new license or ownership is invented here.

The team reports ChatGPT, Codex, Claude Code, OpenCode, Cursor and DeepSeek assistance.
[AI disclosure](AI_DISCLOSURE.md) and [metadata](public/ai-disclosure.json) state the known uses
and attribution limits. NASA measurements are not AI generated.

QA screenshots/recordings linked from release reports are real browser captures. The original
code-based stars/rocket/interface illustrations are conceptual SVG/CSS, created with AI assistance,
not NASA mission imagery. Team profile images are not copied into the project submission assets.

Legacy narration MP3 authorship/generator/rights are unknown to the team owner. Those clips are
excluded from this release; local originals are preserved for review. Their fingerprints and
exclusion status are in [asset provenance](docs/submission/assets.json). Captions remain available.
Do not claim an unknown voice is a human recording, a licensed AI voice or cleared for reuse.
