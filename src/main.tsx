import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { EvidenceSession } from './lib/evidenceSession';
import { BasketProvider } from './lib/basketContext';
import './css/base.css';
import './css/home.css';
import './css/film.css';
import './css/pages.css';
import './css/modules.css';
import './css/responsive.css';
import './css/startup.css';
import './css/scenario.css';
import './css/research-library.css';
import './css/research.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EvidenceSession><BasketProvider><App /></BasketProvider></EvidenceSession>
  </StrictMode>,
);
