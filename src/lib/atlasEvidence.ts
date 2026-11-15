import { useEffect, useState } from 'react';
import { ApiError, evidenceApi, ServiceUnavailable, type ExperimentQuery } from './apiClient';
import { records, recordById } from './corpus';
import type { AtlasFilters } from './records';
import { useEvidenceSession } from './evidenceSession';
import type { ExperimentRecord } from './types';

// The workbench's extra columns, sort options and presence filters stay local.
// Fetch the matching IDs, then resolve only against the same verified bundled corpus.
export async function fetchAtlasEvidence(query: ExperimentQuery): Promise<ExperimentRecord[]> {
  const result: ExperimentRecord[] = [];
  const seen = new Set<string>();
  let total = 0;
  do {
    const page = await evidenceApi.experiments({ ...query, limit: 200, offset: result.length });
    total = page.total;
    if (total > records.length || (page.items.length === 0 && result.length < total)) {
      throw new ServiceUnavailable('API record coverage is incompatible; using bundled evidence.');
    }
    for (const item of page.items) {
      const record = recordById.get(item.experiment_id);
      if (!record || seen.has(item.experiment_id)) throw new ServiceUnavailable('API record identifiers are incompatible; using bundled evidence.');
      seen.add(item.experiment_id); result.push(record);
    }
  } while (result.length < total);
  return result;
}

export function atlasServerQuery(filters: AtlasFilters): ExperimentQuery {
  const text = filters.query.trim();
  const exact = records.some(record => record.experiment_id.toLowerCase() === text.toLowerCase() || record.test_number.toLowerCase() === text.toLowerCase());
  return {
    // The new workbench searches measurement notes/methods absent from the legacy API search.
    // For extended text, retrieve the complete filtered candidate pool and search it locally.
    // Exact record/test IDs still use the existing server lookup semantics.
    q: exact ? text : '', family: filters.family === 'all' ? undefined : filters.family,
    material: filters.material === 'all' ? undefined : filters.material,
    material_exact: true, atlas_search: true,
    validation_status: filters.quality === 'all' ? undefined : filters.quality,
    min_o2: filters.o2Min ?? undefined, max_o2: filters.o2Max ?? undefined,
    flow_only: filters.flowOnly, sort: 'id',
  };
}

export function useAtlasEvidence(filters: AtlasFilters, research: boolean) {
  const session = useEvidenceSession();
  const [remote, setRemote] = useState<{ key: string; records: ExperimentRecord[] } | null>(null);
  const [rejected, setRejected] = useState<{ key: string; message: string } | null>(null);
  const query = atlasServerQuery(filters);
  const key = JSON.stringify(query);
  const invalid = filters.query.trim().length > 200 ? 'Search must contain at most 200 characters.'
    : [filters.o2Min, filters.o2Max].some(value => value !== null && (!Number.isFinite(value) || value < 0 || value > 100))
      ? 'Oxygen bounds must be between 0 and 100%.'
      : filters.o2Min !== null && filters.o2Max !== null && filters.o2Min > filters.o2Max ? 'Minimum oxygen cannot exceed maximum oxygen.' : null;
  useEffect(() => {
    if (research || session.mode !== 'api' || invalid) return;
    let active = true;
    const timer = window.setTimeout(() => {
      fetchAtlasEvidence(query).then(result => {
        if (active) { setRemote({ key, records: result }); setRejected(null); }
      }).catch(error => {
        if (!active) return;
        if (error instanceof ApiError && !(error instanceof ServiceUnavailable) && error.status < 500) setRejected({ key, message: error.message });
        else session.fallback(error instanceof ServiceUnavailable ? error.message : 'Evidence service unavailable; using bundled evidence.');
      });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
    // key encodes only supported server filters, avoiding requests for column/layout changes.
  }, [key, invalid, research, session.mode]);
  const error = invalid ?? (rejected?.key === key ? rejected.message : null);
  return {
    source: error ? [] : session.mode === 'api' && remote?.key === key ? remote.records : records,
    error,
    loading: !research && !error && session.mode === 'api' && remote?.key !== key,
  };
}
