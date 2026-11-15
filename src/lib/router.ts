import { useEffect, useState } from 'react';

export interface RouteInfo {
  path: string;
  segment: string;
}

export type RouteGroup = 'Explore' | 'Research' | 'Evidence' | 'Workspace';

export interface RouteDefinition {
  path: string;
  label: string;
  index: string;
  group: RouteGroup;
  description: string;
  primary?: boolean;
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

export const routes: RouteDefinition[] = [
  {
    path: 'overview',
    label: 'Overview',
    index: '00',
    group: 'Explore',
    description: 'The thesis, on one screen',
    primary: true,
  },
  {
    path: 'atmosphere',
    label: 'Atmosphere',
    index: '01',
    group: 'Explore',
    description: 'Two numbers, one missing',
  },
  {
    path: 'atlas',
    label: 'Evidence Atlas',
    index: '02',
    group: 'Explore',
    description: 'Every record, raw and flagged',
    primary: true,
  },
  {
    path: 'compare',
    label: 'Compare',
    index: '03',
    group: 'Explore',
    description: 'Blockers before numbers',
  },
  {
    path: 'gap',
    label: 'Gap Planner',
    index: '04',
    group: 'Explore',
    description: 'Design the missing test',
  },
  {
    path: 'assistant',
    label: 'Evidence Assistant',
    index: '05',
    group: 'Workspace',
    description: 'Retrieval with abstention',
    primary: true,
  },
  {
    path: 'notebook',
    label: 'Research Notebook',
    index: '09',
    group: 'Workspace',
    description: 'Questions, observations, calculations',
    primary: true,
  },
  {
    path: 'methodology',
    label: 'Methodology & Sources',
    index: '06',
    group: 'Workspace',
    description: 'Every value, traceable',
  },
  {
    path: 'exports',
    label: 'Exports',
    index: '07',
    group: 'Workspace',
    description: 'Take the record layer',
  },
  {
    path: 'coverage',
    label: 'Coverage & Validation',
    index: '08',
    group: 'Research',
    description: 'What is present, what is absent',
    primary: true,
  },
  {
    path: 'verification',
    label: 'Verification Center',
    index: '11',
    group: 'Research',
    description: 'Check claims against evidence',
  },
  {
    path: 'analysis',
    label: 'Analysis Runs',
    index: '13',
    group: 'Research',
    description: 'Reproducible corpus analyses',
  },
  {
    path: 'graph',
    label: 'Evidence Graph',
    index: '10',
    group: 'Evidence',
    description: 'Typed paths back to sources',
  },
  {
    path: 'evaluation',
    label: 'Evaluation Harness',
    index: '12',
    group: 'Evidence',
    description: 'Deterministic benchmark',
  },
  {
    path: 'integrity',
    label: 'Corpus Integrity',
    index: '14',
    group: 'Evidence',
    description: 'Internal consistency checks',
  },
  {
    path: 'reports',
    label: 'Reports',
    index: '15',
    group: 'Evidence',
    description: 'Hashed research report',
    primary: true,
  },
  {
    path: 'health',
    label: 'System Health',
    index: '16',
    group: 'Evidence',
    description: 'Probed capabilities',
  },
];

export const primaryRoutes = routes.filter((route) => route.primary);

export const routeGroups: RouteGroup[] = ['Explore', 'Workspace', 'Research', 'Evidence'];

export function routesInGroup(group: RouteGroup): RouteDefinition[] {
  return routes.filter((route) => route.group === group);
}

export function routeByPath(path: string): RouteDefinition | undefined {
  return routes.find((route) => route.path === path);
}
