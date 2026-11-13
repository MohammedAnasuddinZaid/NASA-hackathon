# Deployment

FIRETRACE is a static Vite application. There is no server-side runtime, database, secret or paid
service.

## Build

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

## Preview locally

```bash
npm run preview
```

Opens `http://localhost:4173`.

## Static hosting

Deploy the contents of `dist/` to any static host (GitHub Pages, Netlify, Vercel static output,
Cloudflare Pages, S3/CloudFront, or an institutional web server). No environment variables are
required.

## Offline use

After the first load, the application works offline because the corpus, claims, presets and source
manifest are bundled. The Playwright suite verifies hash-route navigation with the network offline.

## Verification after deployment

- Open the deployed URL in an incognito window.
- Confirm all eight routes load.
- Open `#/atlas`, search `BASS2-B1`, and open the drawer.
- Confirm `#/assistant` answers “What pressure was BASS-II run at?” with 0 of 131.
- Download the exports and confirm empty pressure cells.
- Disable the network and confirm route navigation still works.

## Notes

- The bundle is a single JavaScript chunk because the corpus JSON is imported directly. This is
  intentional for offline reliability.
- No deployment, push or commit has been performed from this workspace.
- No credentials or secrets are stored in the repository.
