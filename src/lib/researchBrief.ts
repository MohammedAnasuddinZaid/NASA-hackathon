import type { DataValue, ExperimentRecord, SourceArtifact } from './types';
import type { ResearchSource } from './researchData';
import { comparabilityAudit } from './compare';

export const BRIEF_SCHEMA = 'firetrace.research-brief/1';
export const DISCLAIMER =
  'FIRETRACE-generated research product from selected corpus records, not an untouched NASA original. Not a comprehensive review of NASA combustion research. Does not predict fire behavior, certify material safety, establish spacecraft fire-safety compliance, or imply NASA endorsement.';
export interface BriefOptions {
  title: string;
  question: string;
  detailed: boolean;
  includeMissing: boolean;
  includeSourceNotes: boolean;
}
export const defaultBriefOptions: BriefOptions = {
  title: 'Selected combustion evidence brief',
  question: '',
  detailed: false,
  includeMissing: true,
  includeSourceNotes: true,
};
export const summaryFields = {
  oxygen_initial_pct: 'Initial oxygen',
  flow_initial_cm_s: 'Reported flow',
  total_pressure_psia: 'Total pressure',
  gravity_regime: 'Gravity regime',
  thickness_mm: 'Thickness',
  outcome: 'Outcome annotations',
} as const;
export function valueFields(record: ExperimentRecord): Array<[string, DataValue<number | string>]> {
  return Object.entries(record).filter(
    ([, value]) =>
      value &&
      typeof value === 'object' &&
      'value' in value &&
      'status' in value &&
      'unit' in value,
  ) as Array<[string, DataValue<number | string>]>;
}
export function validateBriefOptions(options: BriefOptions): string[] {
  const errors = [];
  if (!options.title.trim() || options.title.length > 120)
    errors.push('Report title must contain 1–120 characters.');
  if (options.question.length > 1000)
    errors.push('Research question must contain at most 1000 characters.');
  return errors;
}
export function coverageSummary(source: readonly ExperimentRecord[]) {
  return Object.entries(summaryFields).map(([field, label]) => {
    const values = source.map((record) => ({
      id: record.experiment_id,
      data: record[field as keyof typeof summaryFields],
    }));
    const available = values.filter(
      ({ data }) =>
        data.value !== null &&
        [
          'measured',
          'corrected',
          'derived',
          'reported_qualitative',
          'investigation_level',
        ].includes(data.status),
    );
    return {
      field,
      label,
      total: source.length,
      available: available.length,
      reported_ids: available.map(({ id }) => id),
      missing_ids: values
        .filter(({ id }) => !available.some((v) => v.id === id))
        .map(({ id }) => id),
      measured_or_corrected: available.filter(({ data }) =>
        ['measured', 'corrected'].includes(data.status),
      ).length,
      derived: available.filter(({ data }) => data.status === 'derived').length,
      approximate_or_qualitative: available.filter(
        ({ data }) => data.status === 'reported_qualitative',
      ).length,
      context_only: available.filter(({ data }) => data.status === 'investigation_level').length,
      statuses: Object.fromEntries(
        [...new Set(values.map(({ data }) => data.status))]
          .sort()
          .map((status) => [status, values.filter(({ data }) => data.status === status).length]),
      ),
    };
  });
}
export function safeSourceUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export interface BriefCitation {
  experiment_id: string;
  source_id: string;
  title: string | null;
  url: string | null;
  doi: string | null;
  locator: string;
  artifacts: SourceArtifact[];
  limitation: string | null;
}
export function citationFor(record: ExperimentRecord, source: ResearchSource): BriefCitation {
  const artifacts = source.artifacts(record.source_id);
  const table = artifacts.find((a) => a.role === 'experiment_table');
  const url = safeSourceUrl(table?.source_url);
  return {
    experiment_id: record.experiment_id,
    source_id: record.source_id,
    title: table?.source_title ?? null,
    url,
    doi: table?.doi ?? null,
    locator: record.source_locator,
    artifacts,
    limitation:
      !table || !url
        ? 'Verified source title or HTTPS URL unavailable; no citation was invented.'
        : null,
  };
}
export function buildBrief(
  ids: string[],
  source: ResearchSource,
  options: BriefOptions,
  generatedAt: string,
) {
  const errors = validateBriefOptions(options);
  if (errors.length) throw new Error(errors.join(' '));
  if (!ids.length)
    throw new Error('Select at least one experiment before generating a research brief.');
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('Invalid generation timestamp.');
  const unique = [...new Set(ids)];
  const records = unique.map((id) => {
    const record = source.resolve(id);
    if (!record) throw new Error(`Record ${id} is unavailable; review the basket.`);
    return record;
  });
  const investigations = [...new Set(records.map((r) => r.family))]
    .sort()
    .map((family) => ({
      family,
      count: records.filter((r) => r.family === family).length,
      record_ids: records.filter((r) => r.family === family).map((r) => r.experiment_id),
    }));
  const coverage = coverageSummary(records);
  return {
    schema_version: BRIEF_SCHEMA,
    dataset_version: source.version,
    generated_at: generatedAt,
    identity: 'FIRETRACE derived research brief',
    user_metadata: {
      title: options.title.trim(),
      research_question: options.question.trim(),
      verification: 'User-supplied purpose, not verified scientific findings.',
    },
    options: { ...options },
    selected_ids: unique,
    record_count: records.length,
    records,
    summary: {
      investigations,
      coverage,
      standardized_outcome_count: records.filter(
        (r) => r.outcome.value !== null && r.outcome.status === 'measured',
      ).length,
      corrected_record_ids: records
        .filter((r) => valueFields(r).some(([, d]) => d.status === 'corrected'))
        .map((r) => r.experiment_id),
      approximate_record_ids: records
        .filter((r) =>
          valueFields(r).some(([, d]) => d.value !== null && d.status === 'reported_qualitative'),
        )
        .map((r) => r.experiment_id),
    },
    comparisons: comparabilityAudit(records),
    citations: records.map((r) => citationFor(r, source)),
    limitations: [
      ...source.limitations,
      'Collection membership does not establish experimental equivalence. Descriptive coverage counts do not average unlike quantities.',
      'Missing fields refer to the normalized record layer; reports elsewhere may contain context not linked to individual rows. Review original notes and unreported per-value uncertainty.',
    ],
    disclaimer: DISCLAIMER,
  };
}
export type ResearchBrief = ReturnType<typeof buildBrief>;
