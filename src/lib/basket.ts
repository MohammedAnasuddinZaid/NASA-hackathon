import { recordFingerprint, type ResearchSource } from './researchData';

export const BASKET_KEY = 'firetrace-evidence-basket-v1';
export interface BasketSnapshot {
  schema: 1;
  version: string;
  ids: string[];
  fingerprints: Record<string, string>;
  reviewRequired: boolean;
}
export interface BasketLoad {
  snapshot: BasketSnapshot;
  notices: string[];
}
export function persistBasket(state: BasketSnapshot, storage: Pick<Storage, 'setItem'>): boolean {
  try {
    storage.setItem(BASKET_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export function snapshot(
  ids: string[],
  source: ResearchSource,
  reviewRequired = false,
): BasketSnapshot {
  const valid = [...new Set(ids)].filter((id) => source.resolve(id)).slice(0, source.all().length);
  return {
    schema: 1,
    version: source.version,
    ids: valid,
    fingerprints: Object.fromEntries(
      valid.map((id) => [id, recordFingerprint(source.resolve(id)!)]),
    ),
    reviewRequired,
  };
}
export function loadBasket(raw: string | null, source: ResearchSource): BasketLoad {
  const empty = { snapshot: snapshot([], source), notices: [] };
  if (!raw) return empty;
  try {
    if (raw.length > 100000) throw new Error('oversize');
    const saved = JSON.parse(raw);
    if (
      saved?.schema !== 1 ||
      typeof saved.version !== 'string' ||
      !Array.isArray(saved.ids) ||
      saved.ids.length > 1000
    )
      throw new Error('schema');
    const ids = saved.ids.filter(
      (id: unknown): id is string => typeof id === 'string' && id.length <= 120,
    );
    const missing = ids.filter((id: string) => !source.resolve(id));
    const changed = ids.filter(
      (id: string) =>
        source.resolve(id) && saved.fingerprints?.[id] !== recordFingerprint(source.resolve(id)!),
    );
    const versionChanged = saved.version !== source.version;
    const notices = [
      ...(ids.length !== saved.ids.length
        ? [
            'Invalid saved identifier values were discarded; only existing record IDs were retained.',
          ]
        : []),
      ...(missing.length
        ? [`Removed stale/invalid record references: ${missing.join(', ')}.`]
        : []),
      ...(versionChanged
        ? [
            'Dataset version changed. All saved IDs were resolved against the current corpus; no old measurements were retained.',
          ]
        : []),
      ...(changed.length
        ? [
            `Changed or previously unverified records: ${changed.join(', ')}. Review their current values.`,
          ]
        : []),
      ...(saved.reviewRequired
        ? ['Dataset review is still required before generating a brief.']
        : []),
    ];
    return {
      snapshot: snapshot(
        ids,
        source,
        versionChanged || changed.length > 0 || saved.reviewRequired === true,
      ),
      notices,
    };
  } catch {
    return {
      ...empty,
      notices: [
        'Saved basket was corrupt or unsupported. Started an empty basket; the scientific corpus is unchanged.',
      ],
    };
  }
}
export function editBasket(
  current: BasketSnapshot,
  action:
    | { type: 'add' | 'remove' | 'up' | 'down'; id: string }
    | { type: 'clear' }
    | { type: 'review' },
  source: ResearchSource,
): BasketSnapshot {
  if (action.type === 'clear') return snapshot([], source);
  if (action.type === 'review') return snapshot(current.ids, source);
  const ids = [...current.ids];
  const index = ids.indexOf(action.id);
  if (action.type === 'add' && source.resolve(action.id) && index === -1) ids.push(action.id);
  if (action.type === 'remove' && index !== -1) ids.splice(index, 1);
  if ((action.type === 'up' || action.type === 'down') && index !== -1) {
    const next = index + (action.type === 'up' ? -1 : 1);
    if (next >= 0 && next < ids.length) [ids[index], ids[next]] = [ids[next], ids[index]];
  }
  return snapshot(ids, source, current.reviewRequired);
}
