import { useEffect, useState } from 'react';

export interface RouteInfo {
  path: string;
  segment: string;
}

export function readRoute(): RouteInfo {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const path = raw.split('?')[0] || 'overview';
  return { path, segment: path.split('/')[0] || 'overview' };
}

export function navigate(path: string): void {
  const target = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
  if (window.location.hash === target) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  window.location.hash = target;
}

export function useRoute(): RouteInfo {
  const [route, setRoute] = useState<RouteInfo>(readRoute);

  useEffect(() => {
    const onChange = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) window.location.hash = '#/overview';
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

export const routes = [
  { path: 'overview', label: 'Overview', index: '00' },
  { path: 'atmosphere', label: 'Atmosphere', index: '01' },
  { path: 'atlas', label: 'Evidence Atlas', index: '02' },
  { path: 'compare', label: 'Compare', index: '03' },
  { path: 'gap', label: 'Gap Planner', index: '04' },
  { path: 'assistant', label: 'Evidence Assistant', index: '05' },
  { path: 'methodology', label: 'Methodology & Sources', index: '06' },
  { path: 'exports', label: 'Exports', index: '07' },
];
