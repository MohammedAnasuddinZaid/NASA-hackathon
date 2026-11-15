import corpusJson from '../data/corpus.json';
import manifestJson from '../data/source_manifest.json';
import validationJson from '../data/validation_report.json';
import type {
  Claim,
  Corpus,
  ExperimentRecord,
  SourceArtifact,
  SourceManifest,
  ValidationReport,
} from './types';

declare const __BUNDLED_CORPUS_VERSION__: string;

export const corpus = corpusJson as unknown as Corpus;
export const sourceManifest = manifestJson as unknown as SourceManifest;
export const validation = validationJson as unknown as ValidationReport;

/** SHA-256 of the bundled corpus file, injected at build time. */
const injectedVersion =
  typeof __BUNDLED_CORPUS_VERSION__ === 'string' ? __BUNDLED_CORPUS_VERSION__ : null;
const globalVersion = (globalThis as { __BUNDLED_CORPUS_VERSION__?: unknown })
  .__BUNDLED_CORPUS_VERSION__;
export const corpusVersion =
  injectedVersion ?? (typeof globalVersion === 'string' ? globalVersion : 'unversioned-dev-build');

export const records: ExperimentRecord[] = corpus.records;
export const claims: Claim[] = corpus.claims;
export const presets = corpus.presets;

export const recordById = new Map(records.map((record) => [record.experiment_id, record]));
export const claimById = new Map(claims.map((claim) => [claim.claim_id, claim]));
export const sourceArtifacts = sourceManifest.sources;

export const sourceArtifactsById = new Map<string, SourceArtifact[]>();
for (const artifact of sourceArtifacts) {
  const list = sourceArtifactsById.get(artifact.source_id) ?? [];
  list.push(artifact);
  sourceArtifactsById.set(artifact.source_id, list);
}

export function artifactsFor(sourceId: string): SourceArtifact[] {
  return sourceArtifactsById.get(sourceId) ?? [];
}

export function claimsFor(sourceId: string): Claim[] {
  return claims.filter((claim) => claim.supporting_source_ids.includes(sourceId));
}

export function recordCitation(record: ExperimentRecord) {
  const artifact = artifactsFor(record.source_id).find((item) => item.role === 'experiment_table');
  return {
    sourceId: record.source_id,
    title: artifact?.source_title ?? `${record.investigation_acronym} experimental table`,
    locator: record.source_locator,
    url: artifact?.source_url ?? 'https://psi.nasa.gov/',
    doi: artifact?.doi ?? null,
  };
}

export const qualityCounts = corpus.meta.quality_counts;
export const coverage = corpus.meta.coverage;
