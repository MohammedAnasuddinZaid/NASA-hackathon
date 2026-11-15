import { useEffect, useRef, useState } from 'react';
import { routes } from '../lib/router';

const primary = ['overview', 'atlas', 'compare', 'assistant'];
const groups = [
  { label: 'Research', paths: ['atmosphere', 'gap', 'coverage', 'verification', 'analysis', 'graph', 'evaluation', 'integrity'] },
  { label: 'Workspace', paths: ['notebook', 'reports', 'exports', 'methodology', 'health'] },
];
const shortLabels: Record<string, string> = { atlas: 'Atlas', assistant: 'Assistant' };

function NavigationDropdown({ label, paths, active, closeOn }: { label: string; paths: string[]; active: string; closeOn: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = `nav-${label.toLowerCase()}`;
  const items = paths.map(path => routes.find(route => route.path === path)!);
  useEffect(() => { setOpen(false); }, [active, closeOn]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="nav-disclosure" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <button ref={trigger} type="button" className={`nav__item nav-disclosure__trigger ${paths.includes(active) ? 'is-active' : ''}`}
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}
      onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => root.current?.querySelector<HTMLAnchorElement>('a')?.focus()); } }}>
      {label}<span className="nav-chevron" aria-hidden="true">⌄</span>
    </button>
    <div id={id} className="nav-disclosure__panel" hidden={!open}>
      <div className="nav-disclosure__heading">{label} tools</div>
      {items.map(item => <a key={item.path} href={`#/${item.path}`} className="nav-disclosure__link" aria-current={active === item.path ? 'page' : undefined} onClick={() => setOpen(false)}>
        <span>{item.label}</span><small>{item.description}</small>
      </a>)}
    </div>
  </div>;
}

export function CompactNavigation({ active, closeOn }: { active: string; closeOn: boolean }) {
  return <>
    {primary.map(path => { const item = routes.find(route => route.path === path)!; return <a key={path} href={`#/${path}`} className={`nav__item ${active === path ? 'is-active' : ''}`} aria-current={active === path ? 'page' : undefined}>{shortLabels[path] ?? item.label}</a>; })}
    {groups.map(group => <NavigationDropdown key={group.label} {...group} active={active} closeOn={closeOn} />)}
  </>;
}
