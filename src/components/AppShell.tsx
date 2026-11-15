import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { primaryRoutes, routeGroups, routes, routesInGroup, useRoute } from '../lib/router';
import { CommandPalette } from './CommandPalette';
import { corpus } from '../lib/corpus';
import { BasketIndicator } from '../lib/basketContext';

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

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
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
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        returnFocus.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter(
        (element) => element.offsetParent !== null,
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('menu-open');
    const firstLink = panelRef.current?.querySelector<HTMLElement>('.menu__link');
    firstLink?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('menu-open');
      previousFocus?.focus?.();
    };
  }, [open, onClose, returnFocus]);

  return (
    <div className={`menu ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="menu__bar">
        <div className="menu__bar-meta">
          <Glyph size={12} />
          <span>Index / FIRETRACE</span>
        </div>
        <span className="menu__bar-count">
          {routes.length} sections &middot; {corpus.records.length} records
        </span>
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

      <div className="menu__grid" ref={panelRef}>
        <nav className="menu__links" aria-label="All sections">
          {routeGroups.map((group) => (
            <div className="menu__group" key={group}>
              <div className="menu__group-title kicker">{group}</div>
              {routesInGroup(group).map((item) => (
                <a
                  key={item.path}
                  href={`#/${item.path}`}
                  className={`menu__link ${active === item.path ? 'is-active' : ''}`}
                  aria-current={active === item.path ? 'page' : undefined}
                  onClick={onClose}
                >
                  <span className="menu__index">{item.index}</span>
                  <span className="menu__label">{item.label}</span>
                  <span className="menu__meta">{item.description}</span>
                  <span className="menu__arrow" aria-hidden="true">
                    &#8599;
                  </span>
                </a>
              ))}
            </div>
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
  const online = useOnline();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
      <a className="skip-link" href="#main" onClick={(event) => { event.preventDefault(); document.getElementById('main')?.focus(); }}>
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

        <nav className="nav nav--horizontal" aria-label="Primary sections">
          {primaryRoutes.map((item) => (
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
          <span
            className={`topbar__status ${online ? '' : 'is-offline'}`}
            title={online ? 'Network available. Bundled retrieval still runs locally.' : 'Offline: bundled retrieval is fully local.'}
          >
            <span className="status-dot" aria-hidden="true" />
            {corpus.records.length} records &middot; {online ? 'bundled + local' : 'offline'}
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

      <main id="main" className="main" tabIndex={-1}>
        {children}
      </main>

      <footer className="footer">
        <div className="footer__top">
          <div className="footer__mark">
            fıretrace<sup>&reg;</sup>
          </div>
          <div className="footer__cols footer__cols--workbench">
            {routeGroups.map((group) => (
              <div key={group}>
                <div className="kicker">{group}</div>
                {routesInGroup(group).map((item) => (
                  <a key={item.path} href={`#/${item.path}`}>
                    {item.label}
                  </a>
                ))}
              </div>
            ))}
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
          <span className="footer__stamp">
            {corpus.records.length} records / {corpus.meta.coverage.pressure_reported} record pressure values / static explorer
          </span>
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
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
