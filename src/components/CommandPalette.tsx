import { useEffect, useMemo, useRef, useState } from 'react';
import { routes } from '../lib/router';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return routes;
    return routes.filter((route) =>
      [route.label, route.path, route.group, route.description]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [query]);

  useEffect(() => {
    setActiveIndex((current) => (filtered.length === 0 ? 0 : Math.min(current, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('.command-palette__option.is-active');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) return null;

  const activeId = filtered[activeIndex] ? `command-${filtered[activeIndex].path}` : undefined;

  function move(delta: number) {
    if (!filtered.length) return;
    setActiveIndex((current) => {
      const next = current + delta;
      if (next < 0) return filtered.length - 1;
      if (next >= filtered.length) return 0;
      return next;
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, filtered.length - 1));
    } else if (event.key === 'Enter') {
      const target = filtered[activeIndex];
      if (target) {
        event.preventDefault();
        window.location.hash = `#/${target.path}`;
        onClose();
      }
    }
  }

  return (
    <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="command-palette__backdrop" onClick={onClose} />
      <div className="command-palette__panel">
        <label className="command-palette__field">
          <span className="kicker">Jump to</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search sections, groups, and actions…"
            aria-label="Command search"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
          />
        </label>
        <ul className="command-palette__list" role="listbox" id="command-list" ref={listRef}>
          {filtered.map((route, index) => (
            <li key={route.path}>
              <a
                id={`command-${route.path}`}
                href={`#/${route.path}`}
                className={`command-palette__option ${index === activeIndex ? 'is-active' : ''}`}
                onClick={onClose}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                aria-selected={index === activeIndex}
                tabIndex={-1}
              >
                <span className="command-palette__meta">
                  <span className="mono">{route.index}</span>
                  <span className="command-palette__group">{route.group}</span>
                </span>
                <span className="command-palette__label">
                  {route.label}
                  <span className="command-palette__description">{route.description}</span>
                </span>
                <span className="command-palette__arrow" aria-hidden="true">
                  &#8594;
                </span>
              </a>
            </li>
          ))}
          {filtered.length === 0 && <li className="muted command-palette__empty">No matching section or action.</li>}
        </ul>
        <div className="command-palette__footer">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
