/**
 * Atlas view state, URL encoding, and reproducible saved views.
 *
 * A saved view stores only a query definition. It never copies or mutates
 * experiment records. URL state is additive so existing `#/atlas?id=...` links
 * continue to work.
 */

import type { AtlasFilters, SortKey } from './records';
import { emptyFilters } from './records';
import { loadVersioned, saveVersioned, type KeyValueStorage, type LoadResult, type SaveResult } from './storage';

export type AtlasColumnKey =
  | 'experiment_id'
  | 'investigation'
  | 'material'
  | 'geometry'
  | 'oxygen_initial'
  | 'oxygen_final'
  | 'flow'
  | 'flow_derived'
  | 'thickness'
  | 'pressure'
  | 'gravity'
  | 'ignition'
  | 'outcome'
  | 'validation'
  | 'source';

export interface AtlasColumn {
  key: AtlasColumnKey;
  label: string;
  align?: 'num';
  unit?: string;
  note?: string;
}

export const ATLAS_COLUMNS: AtlasColumn[] = [
  { key: 'experiment_id', label: 'Record' },
  { key: 'investigation', label: 'Investigation' },
  { key: 'material', label: 'Material' },
  { key: 'geometry', label: 'Geometry' },
  { key: 'oxygen_initial', label: 'Initial O2', align: 'num', unit: '% by vol' },
  { key: 'oxygen_final', label: 'Final O2', align: 'num', unit: '% by vol' },
  { key: 'flow', label: 'Reported flow', align: 'num', unit: 'cm/s' },
  { key: 'flow_derived', label: 'Derived flow', align: 'num', unit: 'cm/s' },
  { key: 'thickness', label: 'Thickness', align: 'num', unit: 'mm' },
  { key: 'pressure', label: 'Pressure', align: 'num', unit: 'psia' },
  { key: 'gravity', label: 'Gravity', unit: 'regime' },
  { key: 'ignition', label: 'Ignition', align: 'num', unit: 'W' },
  { key: 'outcome', label: 'Outcome' },
  { key: 'validation', label: 'Validation' },
  { key: 'source', label: 'Source' },
];

export const ATLAS_COLUMN_KEYS = ATLAS_COLUMNS.map((column) => column.key);
export const DEFAULT_ATLAS_COLUMNS: AtlasColumnKey[] = [
  'experiment_id',
  'investigation',
  'material',
  'oxygen_initial',
  'flow',
  'thickness',
  'pressure',
  'gravity',
  'validation',
];
export const PAGE_SIZES = [12, 24, 48, 96] as const;
export const SAVED_VIEW_LIMIT = 40;
export const SAVED_VIEW_SCHEMA = 1;
export const SAVED_VIEW_STORAGE_KEY = 'firetrace.savedViews.v1';

export interface AtlasViewState {
  query: string;
  family: string;
  material: string;
  quality: string;
  o2Min: number | null;
  o2Max: number | null;
  flowOnly: boolean;
  hasThickness: boolean;
  hasIgnition: boolean;
  sort: SortKey;
  columns: AtlasColumnKey[];
  pageSize: number;
}

export const defaultAtlasView: AtlasViewState = {
  query: '',
  family: 'all',
  material: 'all',
  quality: 'all',
  o2Min: null,
  o2Max: null,
  flowOnly: false,
  hasThickness: false,
  hasIgnition: false,
  sort: 'id',
  columns: DEFAULT_ATLAS_COLUMNS,
  pageSize: 24,
};

const SORT_KEYS: SortKey[] = [
  'id',
  'o2-asc',
  'o2-desc',
  'date',
  'material',
  'family',
  'thickness-asc',
  'thickness-desc',
  'flow-desc',
  'validation',
];

function finiteNumber(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function safeText(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function validColumns(value: unknown): AtlasColumnKey[] {
  if (!Array.isArray(value)) return DEFAULT_ATLAS_COLUMNS;
  const columns = value.filter((item): item is AtlasColumnKey =>
    typeof item === 'string' && (ATLAS_COLUMN_KEYS as string[]).includes(item),
  );
  return columns.length ? [...new Set(columns)] : DEFAULT_ATLAS_COLUMNS;
}

export function validateAtlasView(input: unknown): AtlasViewState | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const sort = typeof raw.sort === 'string' && (SORT_KEYS as string[]).includes(raw.sort) ? (raw.sort as SortKey) : 'id';
  const pageSize = PAGE_SIZES.includes(Number(raw.pageSize) as (typeof PAGE_SIZES)[number])
    ? Number(raw.pageSize)
    : defaultAtlasView.pageSize;
  const o2Min = finiteNumber(raw.o2Min, 0, 100);
  const o2Max = finiteNumber(raw.o2Max, 0, 100);
  if (o2Min !== null && o2Max !== null && o2Min > o2Max) return null;
  return {
    query: safeText(raw.query, 200),
    family: safeText(raw.family, 80) || 'all',
    material: safeText(raw.material, 120) || 'all',
    quality: ['all', 'validated', 'partial', 'suspect'].includes(String(raw.quality))
      ? String(raw.quality)
      : 'all',
    o2Min,
    o2Max,
    flowOnly: raw.flowOnly === true,
    hasThickness: raw.hasThickness === true,
    hasIgnition: raw.hasIgnition === true,
    sort,
    columns: validColumns(raw.columns),
    pageSize,
  };
}

export function viewToFilters(view: AtlasViewState): AtlasFilters {
  return {
    query: view.query,
    family: view.family,
    material: view.material,
    quality: view.quality,
    o2Min: view.o2Min,
    o2Max: view.o2Max,
    flowOnly: view.flowOnly,
    hasThickness: view.hasThickness,
    hasIgnition: view.hasIgnition,
    sort: view.sort,
  };
}

export function filtersToView(filters: AtlasFilters, base: AtlasViewState = defaultAtlasView): AtlasViewState {
  return {
    ...base,
    query: filters.query,
    family: filters.family,
    material: filters.material,
    quality: filters.quality,
    o2Min: filters.o2Min,
    o2Max: filters.o2Max,
    flowOnly: filters.flowOnly,
    hasThickness: filters.hasThickness,
    hasIgnition: filters.hasIgnition,
    sort: filters.sort,
  };
}

export function encodeAtlasView(view: AtlasViewState): string {
  const params = new URLSearchParams();
  if (view.query) params.set('q', view.query);
  if (view.family !== 'all') params.set('family', view.family);
  if (view.material !== 'all') params.set('material', view.material);
  if (view.quality !== 'all') params.set('quality', view.quality);
  if (view.o2Min !== null) params.set('o2min', String(view.o2Min));
  if (view.o2Max !== null) params.set('o2max', String(view.o2Max));
  if (view.flowOnly) params.set('flow', '1');
  if (view.hasThickness) params.set('thickness', '1');
  if (view.hasIgnition) params.set('ignition', '1');
  if (view.sort !== 'id') params.set('sort', view.sort);
  if (view.columns.join(',') !== DEFAULT_ATLAS_COLUMNS.join(',')) params.set('cols', view.columns.join(','));
  if (view.pageSize !== defaultAtlasView.pageSize) params.set('size', String(view.pageSize));
  return params.toString();
}

export function decodeAtlasView(query: string): AtlasViewState {
  const params = new URLSearchParams(query);
  const candidate: Record<string, unknown> = {
    query: params.get('q') ?? '',
    family: params.get('family') ?? 'all',
    material: params.get('material') ?? 'all',
    quality: params.get('quality') ?? 'all',
    o2Min: params.has('o2min') ? params.get('o2min') : null,
    o2Max: params.has('o2max') ? params.get('o2max') : null,
    flowOnly: params.get('flow') === '1',
    hasThickness: params.get('thickness') === '1',
    hasIgnition: params.get('ignition') === '1',
    sort: params.get('sort') ?? 'id',
    columns: params.get('cols')?.split(',').filter(Boolean) ?? DEFAULT_ATLAS_COLUMNS,
    pageSize: params.has('size') ? params.get('size') : defaultAtlasView.pageSize,
  };
  return validateAtlasView(candidate) ?? { ...defaultAtlasView };
}

export interface SavedView {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  state: AtlasViewState;
}

export interface SavedViewDocument {
  schema_version: number;
  views: SavedView[];
}

export function emptySavedViewDocument(): SavedViewDocument {
  return { schema_version: SAVED_VIEW_SCHEMA, views: [] };
}

function validIso(value: unknown): string {
  if (typeof value !== 'string') return new Date(0).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

export function validateSavedViewDocument(input: unknown): SavedViewDocument | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.views)) return null;
  const views: SavedView[] = [];
  for (const item of raw.views.slice(0, SAVED_VIEW_LIMIT)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const view = item as Record<string, unknown>;
    if (typeof view.id !== 'string' || !view.id || view.id.length > 100) return null;
    if (typeof view.name !== 'string' || !view.name.trim() || view.name.length > 60) return null;
    const state = validateAtlasView(view.state);
    if (!state) return null;
    views.push({
      id: view.id,
      name: view.name.trim(),
      created_at: validIso(view.created_at),
      updated_at: validIso(view.updated_at),
      state,
    });
  }
  return { schema_version: SAVED_VIEW_SCHEMA, views };
}

export function loadSavedViews(
  storage?: KeyValueStorage | null,
): LoadResult<SavedViewDocument> {
  return loadVersioned(
    SAVED_VIEW_STORAGE_KEY,
    SAVED_VIEW_SCHEMA,
    emptySavedViewDocument,
    validateSavedViewDocument,
    storage,
  );
}

export function saveSavedViews(
  document: SavedViewDocument,
  storage?: KeyValueStorage | null,
): SaveResult {
  return saveVersioned(SAVED_VIEW_STORAGE_KEY, document, storage);
}

function viewId(name: string, now: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'view';
  return `view-${now.toString(36)}-${slug}`;
}

export interface ViewMutation {
  document: SavedViewDocument;
  view: SavedView | null;
  error: string | null;
}

export function createSavedView(
  document: SavedViewDocument,
  name: string,
  state: AtlasViewState,
  now = Date.now(),
): ViewMutation {
  const clean = name.trim().slice(0, 60);
  if (!clean) return { document, view: null, error: 'Give the view a name.' };
  if (document.views.length >= SAVED_VIEW_LIMIT) {
    return { document, view: null, error: `Saved-view limit is ${SAVED_VIEW_LIMIT}. Delete one first.` };
  }
  if (document.views.some((view) => view.name.toLowerCase() === clean.toLowerCase())) {
    return { document, view: null, error: 'A saved view with that name already exists.' };
  }
  const stamp = new Date(now).toISOString();
  const view: SavedView = {
    id: viewId(clean, now),
    name: clean,
    created_at: stamp,
    updated_at: stamp,
    state: validateAtlasView(state) ?? { ...defaultAtlasView },
  };
  return { document: { ...document, views: [...document.views, view] }, view, error: null };
}

export function renameSavedView(
  document: SavedViewDocument,
  id: string,
  name: string,
  now = Date.now(),
): ViewMutation {
  const clean = name.trim().slice(0, 60);
  if (!clean) return { document, view: null, error: 'Give the view a name.' };
  if (document.views.some((view) => view.id !== id && view.name.toLowerCase() === clean.toLowerCase())) {
    return { document, view: null, error: 'A saved view with that name already exists.' };
  }
  let updated: SavedView | null = null;
  const views = document.views.map((view) => {
    if (view.id !== id) return view;
    updated = { ...view, name: clean, updated_at: new Date(now).toISOString() };
    return updated;
  });
  return updated
    ? { document: { ...document, views }, view: updated, error: null }
    : { document, view: null, error: 'Saved view not found.' };
}

export function duplicateSavedView(
  document: SavedViewDocument,
  id: string,
  now = Date.now(),
): ViewMutation {
  const source = document.views.find((view) => view.id === id);
  if (!source) return { document, view: null, error: 'Saved view not found.' };
  let name = `${source.name} copy`;
  let counter = 2;
  while (document.views.some((view) => view.name.toLowerCase() === name.toLowerCase())) {
    name = `${source.name} copy ${counter}`;
    counter += 1;
  }
  return createSavedView(document, name, source.state, now);
}

export function deleteSavedView(document: SavedViewDocument, id: string): SavedViewDocument {
  return { ...document, views: document.views.filter((view) => view.id !== id) };
}

export function defaultFiltersFromView(view: AtlasViewState): AtlasFilters {
  return { ...emptyFilters, ...viewToFilters(view) };
}
