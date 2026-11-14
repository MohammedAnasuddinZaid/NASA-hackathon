import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './css/base.css';
import './css/home.css';
import './css/film.css';
import './css/pages.css';
import './css/modules.css';
import './css/responsive.css';
import './css/startup.css';
import './css/scenario.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
