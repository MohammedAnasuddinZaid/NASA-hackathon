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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EvidenceSession><App /></EvidenceSession>
  </StrictMode>,
);
