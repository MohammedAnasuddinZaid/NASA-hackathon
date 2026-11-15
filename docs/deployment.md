# Deployment and local release validation

This branch is a review candidate. No public deployment or GitHub release was performed.
The frontend is Vite/React/TypeScript, with a local FastAPI/SQLite evidence API. No Next.js,
new cloud service or predictive model is required. Use Node 24 LTS and Python 3.12 in CI.

## Windows PowerShell

From the repository root:

```powershell
npm.cmd ci
py -3.12 -m venv backend/.venv
& backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
npm.cmd run dev:full
```

Open http://127.0.0.1:5173/#/overview and http://127.0.0.1:8000/api/docs.
Using `.cmd` avoids the PowerShell npm.ps1 execution-policy problem without changing policy.
The launcher requires the virtual environment, validates/builds the index, then starts both
servers; Ctrl+C stops its children. Set `FIRETRACE_FRONTEND_PORT` if 5173 is occupied.
For this isolated review worktree, the existing tested interpreter can be used without modifying
other worktrees: `$env:FIRETRACE_PYTHON=(Resolve-Path ../FIRETRACE-ai-assistant/backend/.venv/Scripts/python.exe).Path`.

## Linux/macOS

```bash
npm ci
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
npm run dev:full
```

## Production artifacts and API configuration

`npm run build` produces `dist/`; `npm run preview` serves http://127.0.0.1:4173.
Deploying it is a separate human-approved step. Hash routes preserve refresh behavior on static
hosts. Vite base `./` and relative data/original URLs support a subdirectory mount.
Research Library is a lazy chunk and fetches `data/research.json` relative to that mount.
Preserve the entire `dist/data` directory and attribution/license files.

Default browser API base is same-origin `/api/v1`; Vite development and preview proxy it to
`http://127.0.0.1:8000`. `FIRETRACE_API_TARGET` changes that local proxy target. Production static
hosts do not implement the Vite proxy: provide a reverse proxy to the backend, or build with
public `VITE_EVIDENCE_API_BASE=https://your-api-host`. `VITE_FIRETRACE_API_BASE` is a legacy
alias only when the primary variable is absent. `VITE_EVIDENCE_API=off` builds a static-only app.
Rebuild when changing Vite settings. A failed or different-corpus API switches the whole session
to bundled evidence; reload retries. TRACE uses the same base and dataset identity checks.

Run the backend separately with:

```bash
cd backend
python scripts/build_index.py
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Ship backend code, `src/data/{corpus,source_manifest,validation_report}.json` and `data/raw/`
together. Paths resolve relative to this project, not the caller's home directory. The SQLite
index is local, regenerated atomically and not committed. Original artifact hashes and the
corpus identity are validated. The Git attributes preserve verified bytes on Windows and Linux;
do not run a line-ending formatter over scientific snapshots or NASA originals.

This is a local research API with input bounds/rate limits, not an authenticated public service.
Before external exposure configure `FIRETRACE_ALLOWED_ORIGINS` and
`FIRETRACE_ALLOWED_ORIGIN_REGEX` precisely, use HTTPS/reverse proxy, and review abuse limits.
Default origin policy permits local/LAN use. No production host or DNS was changed.

## Optional TRACE

Install `backend/requirements-ai.txt` instead of only core requirements. Copy `.env.example`
to an ignored `.env`, set `AI_ENABLED=true`, `OPENAI_API_KEY` and an accessible `OPENAI_MODEL`
on the server only. Default is disabled, with no paid calls. Never put keys in `VITE_` variables.
The configured SDK is OpenAI 2.54.0; deterministic answers do not depend on it. Provider timeout,
validation and citation failures fall back to deterministic evidence. Authenticated live model
verification is pending because this review environment has no key. Voice is a separate optional,
untested runtime; see `backend/requirements-voice.txt`, not required for evidence workflows.

## Verification

```bash
npm ci
npm test
npm run build
python -m pip install -r pipeline/requirements.txt
npm run validate:data
npm run validate:research
python scripts/verify-release-data.py
python -m pytest backend/tests -q
npx playwright install chromium
npm run e2e
npm run e2e:evidence
npm run e2e:trace
npm run e2e:integration
npm run e2e:research
npm run e2e:research-library
```

Use the backend virtual environment for pytest and set `FIRETRACE_PYTHON` to its absolute
interpreter for API browser suites; install pipeline requirements in the interpreter used by npm.
On Linux browser CI uses `npx playwright install --with-deps chromium`. Swagger's optional visual
capture requires internet CDN access and `FIRETRACE_CAPTURE_SWAGGER=1`; OpenAPI JSON is always
tested locally. See the integration report for actual counts, screenshots and remaining limits.

## Offline limits and performance

Already-loaded core routes work without a backend. There is no service worker or promised cold
cache/offline reload. First access to a lazy research chunk/JSON and linked NASA PDFs needs a
network connection; errors are visible. Core JS is about 2.23 MB / 214 kB gzip because the
verified corpus is bundled; research UI is separately lazy-loaded (~9.3 kB / 3.2 kB gzip).
This tradeoff preserves deterministic evidence access without adding infrastructure.

FIRETRACE supports research interpretation, not fire prediction, certification, operating
procedures, or NASA endorsement. Review the manual checklist before any public release.
