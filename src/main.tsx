import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { EvidenceSession } from './lib/evidenceSession';
import './css/base.css';
import './css/home.css';
import './css/film.css';
import './css/pages.css';
import './css/modules.css';
import './css/responsive.css';
import './css/startup.css';
import './css/scenario.css';
import './css/workbench.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Offline shell is an enhancement. Bundled retrieval works without it.
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EvidenceSession><App /></EvidenceSession>
  </StrictMode>,
);
