import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { routes, useRoute } from '../lib/router';
import { corpus } from '../lib/corpus';
import { BasketIndicator } from '../lib/basketContext';

const subtitles: Record<string, string> = {
  overview: 'The thesis, on one screen',
  atmosphere: 'Two numbers, one missing',
  atlas: `${corpus.records.length} records, raw and flagged`,
  compare: 'Blockers before numbers',
  gap: 'Design the missing test',
  assistant: 'Retrieval with abstention',
  methodology: 'Every value, traceable',
  exports: 'Take the record layer',
};

export function Glyph({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="glyph"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 0.75v14.5M0.75 8h14.5M2.85 2.85l10.3 10.3M13.15 2.85 2.85 13.15"
        stroke="currentColor"
        strokeWidth="0.9"
      />
    </svg>
  );
}

function MenuOverlay({
  open,
  active,
  onClose,
  returnFocus,
}: {
  open: boolean;
  active: string;
  onClose: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        returnFocus.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('menu-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('menu-open');
    };
  }, [open, onClose, returnFocus]);

  return (
    <div className={`menu ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="menu__bar">
        <div className="menu__bar-meta">
          <Glyph size={12} />
          <span>Index / FIRETRACE</span>
        </div>
        <span className="menu__bar-count">08 sections &middot; {corpus.records.length} records</span>
        <button
          type="button"
          className="menu__close"
          onClick={() => {
            onClose();
            returnFocus.current?.focus();
          }}
        >
          <span aria-hidden="true">&times;</span> Close
        </button>
      </div>

      <div className="menu__grid">
        <nav className="menu__links" aria-label="All sections">
          {routes.map((item) => (
            <a
              key={item.path}
              href={`#/${item.path}`}
              className={`menu__link ${active === item.path ? 'is-active' : ''}`}
              aria-current={active === item.path ? 'page' : undefined}
              onClick={onClose}
            >
              <span className="menu__index">{item.index}</span>
              <span className="menu__label">{item.label}</span>
              <span className="menu__meta">{subtitles[item.path]}</span>
              <span className="menu__arrow" aria-hidden="true">
                &#8599;
              </span>
            </a>
          ))}
        </nav>

        <aside className="menu__aside">
          <div className="menu__wordmark">
            fıretrace<sup>&reg;</sup>
          </div>
          <p className="menu__statement">
            A retrieval workspace for public NASA microgravity combustion data. It answers with
            sources, and abstains when the table is silent.
          </p>
          <dl className="menu__facts">
            <div>
              <dt>Records</dt>
              <dd>{corpus.records.length}</dd>
            </div>
            <div>
              <dt>Pressure values</dt>
              <dd>0</dd>
            </div>
            <div>
              <dt>Per-test gravity</dt>
              <dd>0</dd>
            </div>
            <div>
              <dt>External model calls</dt>
              <dd>0</dd>
            </div>
          </dl>
          <span className="hand">[ evidence, not vibes ]</span>
          <span className="menu__edition">Edition 01 / 2026</span>
        </aside>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const route = useRoute();
  const active = route.segment;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const max = root.scrollHeight - root.clientHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, root.scrollTop / max)) : 0;
      root.style.setProperty('--scroll-progress', progress.toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [route.path]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="topbar topbar--primary" aria-label="Primary">
        <a className="brand brand--wordmark" href="#/overview" aria-label="FIRETRACE — home">
          <span className="brand__tile">
            <Glyph size={14} />
          </span>
          <span className="brand__word">
            fıretrace<sup>&reg;</sup>
          </span>
        </a>

        <nav className="nav nav--horizontal" aria-label="Sections">
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

        <div className="topbar__right">
          <BasketIndicator />
          <span className="topbar__status">
            <span className="status-dot" aria-hidden="true" />
            {corpus.meta.record_count} records &middot; live demo
          </span>
          <button
            ref={menuButton}
            type="button"
            className="menu-trigger"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen(true)}
          >
            <span aria-hidden="true">+</span> Menu
          </button>
        </div>
      </header>

      <main id="main" className="main">
        {children}
      </main>

      <footer className="footer">
        <div className="footer__top">
          <div className="footer__mark">
            fıretrace<sup>&reg;</sup>
          </div>
          <div className="footer__cols">
            <div>
              <div className="kicker">Workspace</div>
              {routes.slice(0, 4).map((item) => (
                <a key={item.path} href={`#/${item.path}`}>
                  {item.label}
                </a>
              ))}
            </div>
            <div>
              <div className="kicker">Evidence</div>
              {routes.slice(4).map((item) => (
                <a key={item.path} href={`#/${item.path}`}>
                  {item.label}
                </a>
              ))}
            </div>
            <div>
              <div className="kicker">Sources</div>
              <a href="https://psi.nasa.gov/physci/repo/" target="_blank" rel="noreferrer">
                NASA PSI <span aria-hidden="true">&#8599;</span>
              </a>
              <a href="https://ntrs.nasa.gov/" target="_blank" rel="noreferrer">
                NASA NTRS <span aria-hidden="true">&#8599;</span>
              </a>
              <span className="footer__hand hand">[ read the table, not the summary ]</span>
            </div>
          </div>
        </div>
        <div className="footer__bottom">
          <span>
            FIRETRACE is an independent project for NASA Space Apps 2026. Not affiliated with,
            endorsed by, or certified by NASA. Not a fire-risk model.
          </span>
          <span className="footer__stamp">{corpus.records.length} records / {corpus.meta.coverage.pressure_reported} record pressure values / static explorer</span>
        </div>
      </footer>

      <div id="site-menu">
        <MenuOverlay
          open={menuOpen}
          active={active}
          onClose={() => setMenuOpen(false)}
          returnFocus={menuButton}
        />
      </div>
    </div>
  );
}
