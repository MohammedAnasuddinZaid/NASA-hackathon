/**
 * Corpus integrity checks.
 *
 * These checks compare the bundled corpus, validation report, source manifest,
 * and claims against each other. They do not re-download artifacts and they do
 * not certify scientific correctness. A failure is surfaced as a failure.
 */

import { claims, corpus, corpusVersion, records, sourceManifest, validation } from './corpus';
import type { ExperimentRecord } from './types';

export const INTEGRITY_POLICY = 'corpus-integrity-1.0';

export type IntegrityStatus = 'pass' | 'warn' | 'fail';

export interface IntegrityCheck {
  id: string;
  title: string;
  status: IntegrityStatus;
  detail: string;
  evidence: string[];
}

export interface IntegrityReport {
  policy_version: string;
  corpus_version: string;
  generated_at: string;
  status: IntegrityStatus;
  checks: IntegrityCheck[];
  summary: { pass: number; warn: number; fail: number; total: number };
  limitations: string[];
}

function statusOf(checks: IntegrityCheck[]): IntegrityStatus {
  if (checks.some((check) => check.status === 'fail')) return 'fail';
  if (checks.some((check) => check.status === 'warn')) return 'warn';
  return 'pass';
}

function countReported(record: ExperimentRecord, key: keyof ExperimentRecord): number {
  const value = record[key] as unknown as { value?: unknown } | undefined;
  return value && value.value !== null && value.value !== undefined ? 1 : 0;
}

export function buildIntegrityReport(now = new Date()): IntegrityReport {
  const checks: IntegrityCheck[] = [];
  const add = (
    id: string,
    title: string,
    status: IntegrityStatus,
    detail: string,
    evidence: string[] = [],
  ) => checks.push({ id, title, status, detail, evidence });

  const duplicateIds = [...new Set(records.map((record) => record.experiment_id))]
    .filter((id) => records.filter((record) => record.experiment_id === id).length > 1);
  add(
    'record-count',
    'Record count agrees with corpus metadata',
    records.length === corpus.meta.record_count && records.length === corpus.meta.experiment_record_count
      ? 'pass'
      : 'fail',
    `Loaded ${records.length}; metadata declares ${corpus.meta.record_count} records / ${corpus.meta.experiment_record_count} experiment records.`,
  );
  add(
    'unique-record-ids',
    'Experiment identifiers are unique',
    duplicateIds.length === 0 ? 'pass' : 'fail',
    duplicateIds.length ? `Duplicates: ${duplicateIds.join(', ')}.` : `${records.length} unique identifiers.`,
    duplicateIds,
  );

  const duplicateSamples = Object.entries(
    records.reduce<Record<string, number>>((accumulator, record) => {
      accumulator[record.sample_number] = (accumulator[record.sample_number] ?? 0) + 1;
      return accumulator;
    }, {}),
  )
    .filter(([, count]) => count > 1)
    .map(([sample]) => sample);
  add(
    'duplicate-samples',
    'Duplicate sample numbers are declared',
    duplicateSamples.length === validation.duplicate_sample_numbers.length ? 'pass' : 'warn',
    `Computed ${duplicateSamples.length}; validation report declares ${validation.duplicate_sample_numbers.length}.`,
    duplicateSamples.slice(0, 20),
  );

  const missingSources = records
    .filter((record) => !sourceManifest.sources.some((source) => source.source_id === record.source_id))
    .map((record) => record.experiment_id);
  add(
    'record-sources',
    'Every record names a manifest source',
    missingSources.length === 0 ? 'pass' : 'fail',
    missingSources.length ? `Unresolved: ${missingSources.join(', ')}.` : 'All record source IDs resolve.',
    missingSources,
  );

  const pressureValues = records.filter((record) => record.total_pressure_psia.value !== null);
  add(
    'constraint-pressure',
    'Total pressure remains 0 of 131',
    pressureValues.length === 0 ? 'pass' : 'fail',
    pressureValues.length
      ? `${pressureValues.length} record(s) now carry a pressure value: ${pressureValues.map((record) => record.experiment_id).join(', ')}.`
      : 'No record carries a total-pressure value; the field is not imputed.',
    pressureValues.map((record) => record.experiment_id),
  );

  const measuredGravity = records.filter((record) => record.gravity_regime.status === 'measured');
  add(
    'constraint-gravity',
    'Per-test gravity remains 0 of 131',
    measuredGravity.length === 0 ? 'pass' : 'fail',
    measuredGravity.length
      ? `${measuredGravity.length} record(s) claim measured gravity: ${measuredGravity.map((record) => record.experiment_id).join(', ')}.`
      : 'No record claims a measured per-test gravity value.',
    measuredGravity.map((record) => record.experiment_id),
  );

  const measuredOutcome = records.filter((record) => record.outcome.status === 'measured');
  add(
    'constraint-outcome',
    'Standardized outcome remains 0 of 131',
    measuredOutcome.length === 0 ? 'pass' : 'fail',
    measuredOutcome.length
      ? `${measuredOutcome.length} record(s) claim a standardized outcome.`
      : 'No record claims a standardized extinction or burning outcome.',
    measuredOutcome.map((record) => record.experiment_id),
  );

  const measuredIgnitionMethod = records.filter((record) => record.ignition_method.status === 'measured');
  add(
    'constraint-ignition-method',
    'Per-test ignition method remains 0 of 131',
    measuredIgnitionMethod.length === 0 ? 'pass' : 'fail',
    measuredIgnitionMethod.length
      ? `${measuredIgnitionMethod.length} record(s) claim a per-test ignition method.`
      : 'No record claims a per-test ignition method value.',
    measuredIgnitionMethod.map((record) => record.experiment_id),
  );

  const computedQuality = {
    validated: records.filter((record) => record.validation_status === 'validated').length,
    partial: records.filter((record) => record.validation_status === 'partial').length,
    suspect: records.filter((record) => record.validation_status === 'suspect').length,
  };
  const qualityMatches = (['validated', 'partial', 'suspect'] as const).every(
    (status) =>
      computedQuality[status] === validation.quality_counts[status] &&
      computedQuality[status] === corpus.meta.quality_counts[status],
  );
  add(
    'validation-counts',
    'Validation counts agree across corpus and report',
    qualityMatches ? 'pass' : 'fail',
    `Corpus ${JSON.stringify(corpus.meta.quality_counts)}; report ${JSON.stringify(validation.quality_counts)}; computed ${JSON.stringify(computedQuality)}.`,
  );

  const coverageChecks: Array<{ key: string; computed: number; report: number }> = [
    { key: 'pressure_reported', computed: records.filter((record) => record.total_pressure_psia.value !== null).length, report: validation.coverage.pressure_reported },
    { key: 'oxygen_initial_reported', computed: records.filter((record) => record.oxygen_initial_pct.value !== null).length, report: validation.coverage.oxygen_initial_reported },
    { key: 'oxygen_final_reported', computed: records.filter((record) => record.oxygen_final_pct.value !== null).length, report: validation.coverage.oxygen_final_reported },
    { key: 'flow_reported', computed: records.filter((record) => record.flow_initial_cm_s.value !== null).length, report: validation.coverage.flow_reported },
    { key: 'thickness_parsed', computed: records.filter((record) => record.thickness_mm.value !== null).length, report: validation.coverage.thickness_parsed },
  ];
  const coverageMismatches = coverageChecks.filter((check) => check.computed !== check.report);
  add(
    'coverage-counts',
    'Coverage counts reproduce from records',
    coverageMismatches.length === 0 ? 'pass' : 'fail',
    coverageMismatches.length
      ? coverageMismatches.map((check) => `${check.key}: computed ${check.computed}, report ${check.report}`).join('; ')
      : coverageChecks.map((check) => `${check.key}=${check.computed}`).join(', '),
  );

  const duplicateMeasurementIds = (() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const record of records) {
      for (const measurement of record.measurements) {
        if (seen.has(measurement.measurement_id)) duplicates.add(measurement.measurement_id);
        seen.add(measurement.measurement_id);
      }
    }
    return [...duplicates];
  })();
  add(
    'measurement-ids',
    'Measurement identifiers are unique',
    duplicateMeasurementIds.length === 0 ? 'pass' : 'warn',
    duplicateMeasurementIds.length ? `${duplicateMeasurementIds.length} duplicate measurement ID(s).` : 'All measurement IDs are unique.',
    duplicateMeasurementIds.slice(0, 20),
  );

  const unlocatableMeasurements = records.flatMap((record) =>
    record.measurements
      .filter((measurement) => !measurement.source_locator.trim())
      .map((measurement) => `${record.experiment_id}:${measurement.measurement_id}`),
  );
  add(
    'measurement-locators',
    'Every measurement has a source locator',
    unlocatableMeasurements.length === 0 ? 'pass' : 'warn',
    unlocatableMeasurements.length ? `${unlocatableMeasurements.length} measurement(s) lack a locator.` : 'All measurements carry a locator.',
    unlocatableMeasurements.slice(0, 20),
  );

  const badHashes = sourceManifest.sources.filter((source) => !/^[a-f0-9]{64}$/i.test(source.sha256));
  add(
    'manifest-hashes',
    'Every manifest artifact declares a SHA-256',
    badHashes.length === 0 ? 'pass' : 'fail',
    badHashes.length ? `Invalid: ${badHashes.map((source) => source.source_id).join(', ')}.` : `${sourceManifest.sources.length} artifact hashes are well-formed.`,
  );

  const duplicateArtifacts = sourceManifest.sources
    .map((source) => `${source.source_id}|${source.role}|${source.original_filename}`)
    .filter((id, index, all) => all.indexOf(id) !== index);
  add(
    'manifest-source-ids',
    'Manifest artifact identities are unique',
    duplicateArtifacts.length === 0 ? 'pass' : 'fail',
    duplicateArtifacts.length
      ? `Duplicates: ${[...new Set(duplicateArtifacts)].join(', ')}.`
      : `${sourceManifest.sources.length} artifacts across ${new Set(sourceManifest.sources.map((source) => source.source_id)).size} source IDs; each (source, role, filename) is unique.`,
  );

  const unknownClaimSources = claims.flatMap((claim) =>
    claim.supporting_source_ids.filter(
      (sourceId) =>
        !sourceManifest.sources.some((source) => source.source_id === sourceId) &&
        !sourceManifest.context_sources.some((source) => source.source_id === sourceId),
    ),
  );
  add(
    'claim-sources',
    'Every claim source resolves',
    unknownClaimSources.length === 0 ? 'pass' : 'fail',
    unknownClaimSources.length ? `Unknown: ${[...new Set(unknownClaimSources)].join(', ')}.` : `${claims.length} claim(s) resolve to manifest sources.`,
  );

  const missingClaimLocators = claims.filter((claim) => claim.supporting_locators.length === 0 || claim.supporting_locators.every((locator) => !locator.trim()));
  add(
    'claim-locators',
    'Every claim has a locator',
    missingClaimLocators.length === 0 ? 'pass' : 'fail',
    missingClaimLocators.length ? `Missing: ${missingClaimLocators.map((claim) => claim.claim_id).join(', ')}.` : 'All claims carry locators.',
  );

  const emptyLocators = records.filter((record) => !record.source_locator.trim());
  add(
    'record-locators',
    'Every record has a source locator',
    emptyLocators.length === 0 ? 'pass' : 'fail',
    emptyLocators.length ? `${emptyLocators.length} record(s) lack a locator.` : 'All records carry a locator.',
    emptyLocators.map((record) => record.experiment_id),
  );

  const badStatuses = records.filter(
    (record) => !['validated', 'partial', 'suspect'].includes(record.validation_status),
  );
  add(
    'validation-vocabulary',
    'Validation status vocabulary is closed',
    badStatuses.length === 0 ? 'pass' : 'fail',
    badStatuses.length ? `${badStatuses.length} record(s) use an unknown status.` : 'All records use validated, partial, or suspect.',
    badStatuses.map((record) => record.experiment_id),
  );

  const flaggedCount = records.filter((record) => record.quality_flags.length > 0).length;
  add(
    'quality-flags',
    'Quality flags are preserved',
    flaggedCount > 0 ? 'pass' : 'warn',
    `${flaggedCount} record(s) carry at least one quality flag.`,
  );

  const reportStatus = statusOf(checks);
  const summary = {
    pass: checks.filter((check) => check.status === 'pass').length,
    warn: checks.filter((check) => check.status === 'warn').length,
    fail: checks.filter((check) => check.status === 'fail').length,
    total: checks.length,
  };
  return {
    policy_version: INTEGRITY_POLICY,
    corpus_version: corpusVersion,
    generated_at: now.toISOString(),
    status: reportStatus,
    checks,
    summary,
    limitations: [
      'Checks run against the bundled normalized layer. They do not re-download or re-hash remote artifacts.',
      'A passing check means the local data are internally consistent, not that the source experiment is scientifically valid.',
      'No record is repaired, zero-filled, or removed by this report.',
    ],
  };
}

export function integrityToMarkdown(report: IntegrityReport): string {
  return [
    '# Corpus integrity report',
    '',
    `- Policy: ${report.policy_version}`,
    `- Corpus version: ${report.corpus_version}`,
    `- Generated: ${report.generated_at}`,
    `- Overall status: **${report.status.toUpperCase()}**`,
    `- Checks: ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail`,
    '',
    '## Checks',
    '',
    '| Check | Status | Detail |',
    '| --- | --- | --- |',
    ...report.checks.map((check) => `| ${check.title} | ${check.status} | ${check.detail.replace(/\|/g, '\\|')} |`),
    '',
    '## Limitations',
    '',
    ...report.limitations.map((limitation) => `- ${limitation}`),
    '',
  ].join('\n');
}
