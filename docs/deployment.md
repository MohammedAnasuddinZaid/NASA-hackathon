# Deployment

FIRETRACE has two deployable pieces with different requirements.

| Piece | Artifact | Runtime needed |
|---|---|---|
| Web application | `dist/` static bundle | Any static file host |
| Evidence API | `backend/` Python service | Python 3.10+ with the core requirements |

The static app does not need the API and the API does not need the static app. The web app calls
the API when it is reachable and falls back to its bundled deterministic engine when it is not.

## Web application

### Build

```bash
npm install
npm run build
```

The output is written to `dist/`:

```text
dist/
  index.html
  assets/
  data/
```

### Preview locally

```bash
npm run preview
```

Opens `http://localhost:4173`.

### Static hosting

Deploy the contents of `dist/` to any static host (GitHub Pages, Netlify, Vercel static output,
Cloudflare Pages, S3/CloudFront, or an institutional web server). No environment variables are
required and no secrets are involved.

### Offline use

After the first load, the application works offline because the corpus, claims, presets and source
manifest are bundled. The Playwright suite includes an offline-navigation test; it is present in
`e2e/` but cannot be executed in this development environment because the OS application-control
policy blocks the Playwright Chromium binary.

## Evidence API

### Local run

```bash
cd backend
pip install -r requirements.txt
uvicorn api:app --host 127.0.0.1 --port 8000
```

`api:app` has no AI runtime dependency. It needs no models, no Ollama and no GPU. Health and
contract endpoints:

```text
GET /health/live
GET /health/ready
GET /api/v1/experiments
GET /api/openapi.json
GET /api/docs
```

### If you also want voice

```bash
cd backend
pip install -r requirements-voice.txt
copy .env.example .env
uvicorn main:app --host 127.0.0.1 --port 8000
```

Voice model files are not committed. Without them, the voice routes return
`503 voice_unavailable` and `/api/v1` stays fully functional.

### Binding and exposure

The defaults bind to `127.0.0.1`. CORS and origin checks allow localhost and RFC1918 LAN origins
only. If you expose the service beyond the local machine, review `FIRETRACE_ALLOWED_ORIGINS`,
`FIRETRACE_ALLOWED_ORIGIN_REGEX` and the rate limits in `backend/.env.example` first. The service
is intentionally not a public internet API.

## Verification after deployment

For the static app:

- Open the deployed URL in an incognito window.
- Confirm all eight routes load.
- Open `#/atlas`, search `BASS2-B1`, and open the drawer.
- Confirm `#/assistant` answers "What pressure was BASS-II run at?" with 0 of 131.
- Download the exports and confirm empty pressure cells.
- Disable the network and confirm route navigation still works.

For the API:

```bash
curl -s http://127.0.0.1:8000/health/ready
curl -s http://127.0.0.1:8000/api/v1/coverage
curl -si -X POST http://127.0.0.1:8000/api/v1/ask \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"Is PMMA safe in a lunar cabin?\"}"
```

The last call must return `grade: out-of-scope`, zero claims and no percentage.

## Notes

- The static bundle is a single JavaScript chunk because the corpus JSON is imported directly.
  This is intentional for offline reliability and produces a Vite chunk-size warning.
- No deployment, push or commit has been performed from this workspace.
- No credentials or secrets are stored in the repository.
- The API supports research-evidence reading only. It does not predict fire risk, certify a
  material or atmosphere, or provide operational or emergency guidance, and it is not endorsed by
  NASA.