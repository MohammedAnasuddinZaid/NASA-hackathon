import { records, recordById, artifactsFor, corpus } from './corpus';
import type { ExperimentRecord, SourceArtifact } from './types';

declare const __BUNDLED_CORPUS_VERSION__: string;
export interface ResearchSource {
  version: string;
  all(): readonly ExperimentRecord[];
  resolve(id: string): ExperimentRecord | undefined;
  artifacts(id: string): SourceArtifact[];
  limitations: string[];
}
export const researchSource: ResearchSource = {
  version: __BUNDLED_CORPUS_VERSION__,
  all: () => records,
  resolve: (id) => recordById.get(id),
  artifacts: artifactsFor,
  limitations: corpus.limitations,
};
/** Small non-cryptographic change indicator; corpus SHA-256 is the authoritative identity. */
export function recordFingerprint(record: ExperimentRecord): string {
  let hash = 2166136261;
  for (const char of JSON.stringify(record)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
