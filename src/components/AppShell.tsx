import type { ReactNode } from 'react';
import { routes, useRoute } from '../lib/router';
import { corpus } from '../lib/corpus';

export function FlameMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="flame-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 2.5c1.2 5.8-4.6 7.2-4.6 12.2 0 1.5.6 2.7 1.6 3.5-.2-3.1 1.7-5.2 3.5-6.9.1 3.7 4.9 5.3 4.9 10.1 0 4.1-2.9 7.1-6.7 7.1-4 0-6.9-3-6.9-7.2C7.8 14 12.6 11.7 16 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="14.2" cy="20.1" r="1.15" fill="currentColor" />
      <circle cx="19.6" cy="22.8" r="1.15" fill="currentColor" />
      <path d="M14.2 20.1 19.6 22.8" stroke="currentColor" strokeWidth="0.9" strokeDasharray="1.6 1.6" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const route = useRoute();
  const active = route.segment;

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="topbar topbar--primary" aria-label="Primary">
        <a className="brand brand--wordmark" href="#/overview" aria-label="FIRETRACE home">
          <FlameMark size={22} />
          <span className="brand__text">
            <span className="brand__name">FIRETRACE</span>
            <span className="brand__sub">Evidence intelligence</span>
          </span>
        </a>

        <nav className="nav nav--horizontal" aria-label="Primary">
          {routes.map((item) => (
            <a
              key={item.path}
              href={`#/${item.path}`}
              className={`nav__item ${active === item.path ? 'is-active' : ''}`}
              aria-current={active === item.path ? 'page' : undefined}
            >
              <span className="nav__index">{item.index}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="topbar__status">
          <span className="status-dot" aria-hidden="true" />
          <span>{corpus.meta.record_count} records · offline</span>
        </div>
      </header>

      <div className="mobile-nav" aria-label="Primary mobile">
        {routes.map((item) => (
          <a
            key={item.path}
            href={`#/${item.path}`}
            className={`mobile-nav__item ${active === item.path ? 'is-active' : ''}`}
          >
            <span>{item.index}</span>
            {item.label}
          </a>
        ))}
      </div>

      <div className="ticker" aria-hidden="true">
        <div className="ticker__track">
          <span>FIRETRACE · 131 RECORDS · 0 PRESSURE VALUES · 0 PER-TEST GRAVITY · 4 SUSPECT RECORDS · DETERMINISTIC RETRIEVAL · OFFLINE</span>
          <span>FIRETRACE · 131 RECORDS · 0 PRESSURE VALUES · 0 PER-TEST GRAVITY · 4 SUSPECT RECORDS · DETERMINISTIC RETRIEVAL · OFFLINE</span>
        </div>
      </div>

      <main id="main" className="main">
        {children}
        <footer className="footer">
          <FlameMark size={18} />
          <span>
            FIRETRACE is an evidence-retrieval workspace, not a fire-risk model, material
            certification, or NASA product.
          </span>
          <a href="#/methodology">Method & sources →</a>
        </footer>
      </main>
    </div>
  );
}
