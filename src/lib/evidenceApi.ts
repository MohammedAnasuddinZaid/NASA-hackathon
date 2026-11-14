import type { ExperimentRecord, SourceArtifact } from './types';
import type { AtlasFilters } from './records';

export interface EvidenceCheck { id: string; label: string; state: 'shared' | 'partial' | 'blocked' | 'unknown'; detail: string }
export interface EvidenceCoverage {
  total: number;
  investigations: Record<string, number>;
  fields: Record<string, { available: number; missing: number; per_test_measured: number; context_only: number; statuses: Record<string, number>; units: string[] }>;
  dataset_id: string;
}
export type ApiArtifact = SourceArtifact & { artifact_id: string; download_available: boolean; download_url: string | null };
export interface EvidencePage { items: ExperimentRecord[]; total: number; dataset_id: string }
export interface EvidenceComparison { checks: EvidenceCheck[]; dataset_id: string }
const env = (import.meta as { env?: Record<string, string> }).env;
export const EVIDENCE_BASE = env?.VITE_EVIDENCE_API_BASE ?? '';
export const evidenceEnabled = env?.VITE_EVIDENCE_API !== 'off';
declare const __FIRETRACE_DATASET_ID__: string;
export function bundledDatasetId(): Promise<string> {
  return Promise.resolve(__FIRETRACE_DATASET_ID__);
}

export async function evidenceRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const dataset = await bundledDatasetId();
  const response = await fetch(`${EVIDENCE_BASE}/api/v1${path}`, {
    ...init, signal: init.signal ?? AbortSignal.timeout(4000),
    headers: { 'X-Firetrace-Dataset': dataset, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (!response.ok) throw new Error(response.status === 409 ? 'Dataset mismatch: using the complete bundled dataset.' : `Evidence API unavailable (${response.status}): using bundled data.`);
  if (response.headers.get('X-Firetrace-Dataset') !== dataset) throw new Error('Unverified API dataset: using bundled data.');
  return response.json() as Promise<T>;
}

export function searchEvidence(filters: AtlasFilters, page: number) {
  const params = new URLSearchParams({ q: filters.query, sort: filters.sort, limit: '24', offset: String(page * 24) });
  for (const [key, value] of Object.entries({ investigation: filters.family === 'all' ? null : filters.family, material: filters.material === 'all' ? null : filters.material, quality: filters.quality === 'all' ? null : filters.quality, o2_min: filters.o2Min, o2_max: filters.o2Max, flow_only: filters.flowOnly ? 'true' : null })) {
    if (value !== null) params.set(key, String(value));
  }
  return evidenceRequest<EvidencePage>(`/experiments?${params}`);
}

export function evidenceDetail(id: string) { return evidenceRequest<ExperimentRecord>(`/experiments/${encodeURIComponent(id)}`); }
export function evidenceSources(id: string) { return evidenceRequest<{ items: ApiArtifact[] }>(`/sources/${encodeURIComponent(id)}`); }
export function evidenceCompare(ids: string[]) { return evidenceRequest<EvidenceComparison>('/compare', { method: 'POST', body: JSON.stringify({ experiment_ids: ids }) }); }
