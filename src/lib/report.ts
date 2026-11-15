/**
 * Research report assembly.
 *
 * A report is a set of deterministic files plus a SHA-256 manifest. It copies
 * evidence references and computed summaries; it does not create new scientific
 * claims. Every limitation travels with the report.
 */

import { claims, corpus, corpusVersion, records, sourceManifest, validation } from './corpus';
import { hashFiles, type HashedFile } from './hash';
import { buildIntegrityReport, integrityToMarkdown } from './integrity';
import type { IntegrityReport } from './integrity';
import { summarizeVerifications, verifyAllClaims, verdictLabels } from './verification';
import type { VerificationResult } from './verification';
import { buildEvidenceGraph } from './evidenceGraph';
import type { EvidenceGraph } from './evidenceGraph';
import { analysisToMarkdown } from './analysisRun';
import type { AnalysisRun } from './analysisRun';
import type { BenchmarkRun } from './benchmark';
import type { NotebookDocument } from './notebook';
import { notebookToMarkdown } from './notebook';

export const REPORT_SCHEMA = 1;

export interface ReportOptions {
  title?: string;
  notebook?: NotebookDocument | null;
  investigationId?: string | null;
  benchmark?: BenchmarkRun | null;
  analysisRuns?: AnalysisRun[];
  generatedAt?: string;
  appVersion?: string;
  includeClaims?: boolean;
}

export interface ReportManifest {
  report_schema_version: number;
  generated_at: string;
  corpus_version: string;
  app_version: string | null;
  title: string;
  file_count: number;
  files: Array<{ path: string; sha256: string; bytes: number }>;
  notes: string[];
}

export interface ReportBundle {
  title: string;
  generated_at: string;
  markdown: string;
  json: string;
  files: HashedFile[];
  manifest: ReportManifest;
  integrity: IntegrityReport;
  verifications: VerificationResult[];
  graph: EvidenceGraph;
}

function coverageTable(): string[] {
  const fields: Array<{ label: string; count: number }> = [
    { label: 'Initial O2', count: records.filter((record) => record.oxygen_initial_pct.value !== null).length },
    { label: 'Final O2', count: records.filter((record) => record.oxygen_final_pct.value !== null).length },
    { label: 'Total pressure', count: records.filter((record) => record.total_pressure_psia.value !== null).length },
    { label: 'Oxygen partial pressure', count: records.filter((record) => record.oxygen_partial_pressure_psi.value !== null).length },
    { label: 'Reported flow', count: records.filter((record) => record.flow_initial_cm_s.value !== null).length },
    { label: 'Thickness', count: records.filter((record) => record.thickness_mm.value !== null).length },
    { label: 'Per-test gravity', count: records.filter((record) => record.gravity_regime.status === 'measured').length },
    { label: 'Ignition method', count: records.filter((record) => record.ignition_method.status === 'measured').length },
    { label: 'Standardized outcome', count: records.filter((record) => record.outcome.status === 'measured').length },
  ];
  return [
    '| Field | Reported | Coverage |',
    '| --- | ---: | ---: |',
    ...fields.map(
      (field) =>
        `| ${field.label} | ${field.count} of ${records.length} | ${((field.count / records.length) * 100).toFixed(1)}% |`,
    ),
  ];
}

export async function buildResearchReport(options: ReportOptions = {}): Promise<ReportBundle> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const title = (options.title ?? 'FIRETRACE evidence report').slice(0, 160);
  const integrity = buildIntegrityReport(new Date(generatedAt));
  const verifications = verifyAllClaims(new Date(generatedAt));
  const verificationSummary = summarizeVerifications(verifications);
  const graph = buildEvidenceGraph({
    notebook: options.notebook ?? null,
    builtAt: generatedAt,
  });
  const investigation =
    options.notebook?.investigations.find((item) => item.id === options.investigationId) ??
    options.notebook?.investigations[0] ??
    null;

  const sourceRows = sourceManifest.sources.map(
    (source) =>
      `| ${source.source_id} | ${source.source_title.replace(/\|/g, '\\|')} | ${source.role} | ${source.license.replace(/\|/g, '\\|')} | ${source.sha256.slice(0, 16)}… | ${source.local_original_url ? 'local' : 'remote'} |`,
  );

  const markdown = [
    `# ${title}`,
    '',
    `Generated: ${generatedAt}`,
    `Corpus version: \`${corpusVersion}\``,
    `Report schema: ${REPORT_SCHEMA}`,
    '',
    '> This is a research workspace report, not a NASA certification, a safety assessment, or a prediction of fire behavior. Missing values remain missing.',
    '',
    '## Corpus scope',
    '',
    `- Experiment records: ${records.length}`,
    `- Investigations: ${corpus.meta.investigations.map((item) => `${item.family} (${item.records})`).join(', ')}`,
    `- Declared claims: ${claims.length}`,
    `- Source artifacts: ${sourceManifest.sources.length}`,
    `- Context sources: ${sourceManifest.context_sources.length}`,
    `- Validation: ${validation.quality_counts.validated} validated, ${validation.quality_counts.partial} partial, ${validation.quality_counts.suspect} suspect`,
    '',
    '## Field coverage',
    '',
    ...coverageTable(),
    '',
    '## Source artifacts',
    '',
    '| Source | Title | Role | License | SHA-256 | Availability |',
    '| --- | --- | --- | --- | --- | --- |',
    ...sourceRows,
    '',
    '## Integrity',
    '',
    integrityToMarkdown(integrity),
    '',
    '## Claim verification',
    '',
    `- Supported: ${verificationSummary.supported}`,
    `- Partial: ${verificationSummary.partial}`,
    `- Unsupported: ${verificationSummary.unsupported}`,
    `- Contradicted: ${verificationSummary.contradicted}`,
    `- Unverifiable: ${verificationSummary.unverifiable}`,
    `- Total: ${verificationSummary.total}`,
    '',
    ...(options.includeClaims === false
      ? ['Claim-level detail omitted by request.', '']
      : [
          '| Claim | Verdict | Summary |',
          '| --- | --- | --- |',
          ...verifications.map(
            (result) =>
              `| ${result.target_id} | ${verdictLabels[result.verdict]} | ${result.summary.replace(/\|/g, '\\|')} |`,
          ),
          '',
        ]),
    '## Evidence graph',
    '',
    `- Nodes: ${graph.stats.node_count}`,
    `- Edges: ${graph.stats.edge_count}`,
    `- Orphan nodes: ${graph.stats.orphans}`,
    `- Nodes by kind: ${Object.entries(graph.stats.nodes_by_kind).map(([kind, count]) => `${kind}=${count}`).join(', ')}`,
    `- Records without a manifest source: ${graph.stats.records_without_sources.length}`,
    '',
    ...(options.benchmark
      ? [
          '## Deterministic assistant benchmark',
          '',
          `- Version: ${options.benchmark.benchmark_version}`,
          `- Cases: ${options.benchmark.total}`,
          `- Passed: ${options.benchmark.passed}`,
          `- Failed: ${options.benchmark.failed}`,
          `- Pass rate: ${options.benchmark.pass_rate}%`,
          `- Case fingerprint: \`${options.benchmark.case_fingerprint}\``,
          '',
          '| Case | Category | Result | Grade | Citations |',
          '| --- | --- | --- | --- | ---: |',
          ...options.benchmark.results.map(
            (result) =>
              `| ${result.id} | ${result.category} | ${result.pass ? 'pass' : 'fail'} | ${result.actual_grade} | ${result.citations} |`,
          ),
          '',
        ]
      : []),
    ...(options.analysisRuns?.length
      ? [
          '## Analysis runs',
          '',
          ...options.analysisRuns.map((run) => analysisToMarkdown(run)),
        ]
      : []),
    ...(investigation
      ? [
          '## Research notebook',
          '',
          notebookToMarkdown(investigation),
        ]
      : []),
    '## Limitations',
    '',
    ...corpus.limitations.map((limitation) => `- ${limitation}`),
    '- The bundled corpus is a normalized layer over public source tables. It does not reproduce every source column.',
    '- SHA-256 values prove file identity only. They do not prove a scientific conclusion.',
    '- Claim verification is a provenance check, not an independent scientific peer review.',
    '',
    '## Reproduction',
    '',
    '```',
    'npm test',
    'npm run build',
    'npm run benchmark',
    '```',
    '',
  ].join('\n');

  const json = JSON.stringify(
    {
      report_schema_version: REPORT_SCHEMA,
      generated_at: generatedAt,
      title,
      corpus_version: corpusVersion,
      app_version: options.appVersion ?? null,
      scope: {
        records: records.length,
        investigations: corpus.meta.investigations,
        claims: claims.length,
        sources: sourceManifest.sources.length,
        context_sources: sourceManifest.context_sources.length,
        validation: validation.quality_counts,
      },
      integrity,
      verification: { summary: verificationSummary, results: verifications },
      graph: {
        schema_version: graph.schema_version,
        policy_version: graph.policy_version,
        stats: graph.stats,
      },
      benchmark: options.benchmark ?? null,
      analysis_runs: options.analysisRuns ?? [],
      notebook: investigation,
      limitations: corpus.limitations,
    },
    null,
    2,
  );

  const graphJson = JSON.stringify(
    {
      schema_version: graph.schema_version,
      policy_version: graph.policy_version,
      corpus_version: graph.corpus_version,
      stats: graph.stats,
      nodes: graph.nodes,
      edges: graph.edges,
    },
    null,
    2,
  );

  const hashed = await hashFiles([
    { path: 'report.md', content: markdown },
    { path: 'report.json', content: json },
    { path: 'integrity.json', content: JSON.stringify(integrity, null, 2) },
    { path: 'verification.json', content: JSON.stringify(verifications, null, 2) },
    { path: 'evidence-graph.json', content: graphJson },
  ]);
  const manifest: ReportManifest = {
    report_schema_version: REPORT_SCHEMA,
    generated_at: generatedAt,
    corpus_version: corpusVersion,
    app_version: options.appVersion ?? null,
    title,
    file_count: hashed.length,
    files: hashed.map((file) => ({ path: file.path, sha256: file.sha256, bytes: file.bytes })),
    notes: [
      'Every file is generated from the bundled corpus and local workspace state.',
      'The manifest records content hashes only; it is not a signature or a certification.',
      'No secrets, tokens, or environment values are included.',
    ],
  };
  const manifestFile = await hashFiles([
    { path: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
  ]);
  return {
    title,
    generated_at: generatedAt,
    markdown,
    json,
    files: [...hashed, manifestFile[0]],
    manifest,
    integrity,
    verifications,
    graph,
  };
}
