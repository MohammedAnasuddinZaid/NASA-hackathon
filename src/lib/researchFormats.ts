import type { ResearchBrief } from './researchBrief';
import { valueFields } from './researchBrief';

/** Spreadsheet-oriented text escaping; legitimate numeric values retain their numeric representation. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (
    typeof value === 'string' &&
    /^[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]*[=+\-@]/.test(text)
  )
    text = `'${text}`;
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
export const researchCsvColumns = [
  'row_kind',
  'experiment_id',
  'investigation_id',
  'investigation',
  'material',
  'quantity',
  'normalized_value',
  'normalized_unit',
  'status',
  'original_value',
  'original_unit',
  'note',
  'basis',
  'source_file',
  'source_locator',
  'source_url',
  'doi',
  'quality_flags',
  'dataset_version',
  'generated_at',
  'measurement_id',
  'measurement_phase',
  'uncertainty',
  'investigation_table_title',
  'investigation_table_version',
  'investigation_table_sha256',
];
export function briefCsv(brief: ResearchBrief): string {
  const rows: unknown[][] = [];
  for (const record of brief.records) {
    const citation = brief.citations.find((c) => c.experiment_id === record.experiment_id)!;
    const prefix = [record.experiment_id, record.source_id, record.family, record.material_raw];
    const table = citation.artifacts.find((artifact) => artifact.role === 'experiment_table');
    const tableMetadata = [
      table?.source_title ?? null,
      table?.version ?? null,
      table?.sha256 ?? null,
    ];
    const suffix = [
      citation.url,
      citation.doi,
      record.quality_flags.join('; '),
      brief.dataset_version,
      brief.generated_at,
    ];
    for (const [field, data] of valueFields(record))
      rows.push([
        'record_field',
        ...prefix,
        field,
        data.value,
        data.unit,
        data.status,
        data.raw,
        null,
        data.note,
        data.basis,
        data.source_file ?? null,
        data.source_locator ?? record.source_locator,
        ...suffix,
        null,
        null,
        null,
        ...tableMetadata,
      ]);
    for (const measurement of record.measurements)
      rows.push([
        'measurement_ledger',
        ...prefix,
        measurement.quantity,
        measurement.normalized_value,
        measurement.normalized_unit,
        measurement.status,
        measurement.original_value,
        measurement.original_unit,
        measurement.note ?? null,
        measurement.measurement_method,
        measurement.source_file ?? null,
        measurement.source_locator,
        ...suffix,
        measurement.measurement_id,
        measurement.measurement_phase,
        measurement.uncertainty,
        ...tableMetadata,
      ]);
  }
  return [researchCsvColumns.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join(
    '\r\n',
  );
}
export function htmlEscape(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
export function markdownEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/[\\`*_[\]{}()#+.!|\-]/g, '\\$&')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
export function briefMarkdown(brief: ResearchBrief): string {
  const md = markdownEscape;
  const lines = [
    `# FIRETRACE — ${md(brief.user_metadata.title)}`,
    '',
    `Generated: ${md(brief.generated_at)} · Records: ${brief.record_count}`,
    `Dataset SHA-256: ${md(brief.dataset_version)}`,
    '',
    '## Research scope',
    ...brief.summary.investigations.map(
      (i) => `- ${md(i.family)}: ${i.count} records (${i.record_ids.map(md).join(', ')})`,
    ),
    '',
    `User-supplied research question (not verified): ${md(brief.user_metadata.research_question || 'Not supplied')}`,
    '',
    '## Selected experiments',
    '| Record | Investigation | Material | O2 | Pressure | Flow | Gravity |',
    '|---|---|---|---|---|---|---|',
    ...brief.records.map(
      (r) =>
        `| ${md(r.experiment_id)} | ${md(r.family)} | ${md(r.material_raw)} | ${md(r.oxygen_initial_pct.value ?? 'Unknown')} ${md(r.oxygen_initial_pct.unit)} (${md(r.oxygen_initial_pct.status)}) | ${md(r.total_pressure_psia.value ?? 'Unknown')} ${md(r.total_pressure_psia.unit)} (${md(r.total_pressure_psia.status)}) | ${md(r.flow_initial_cm_s.value ?? 'Unknown')} ${md(r.flow_initial_cm_s.unit)} (${md(r.flow_initial_cm_s.status)}) | ${md(r.gravity_regime.value ?? 'Unknown')} (${md(r.gravity_regime.status)}) |`,
    ),
    '',
    '## Evidence observations',
    ...brief.summary.coverage.map(
      (c) =>
        `- ${md(c.label)}: ${c.available}/${c.total} available; ${c.measured_or_corrected} measured/corrected, ${c.derived} derived, ${c.approximate_or_qualitative} approximate/qualitative, ${c.context_only} context-only. Records: ${c.reported_ids.map(md).join(', ') || 'none'}.`,
    ),
    `- Standardized measured outcomes: ${brief.summary.standardized_outcome_count}/${brief.record_count}. Qualitative annotations and burn durations are not standardized outcomes.`,
    '',
    '## Comparison limitations',
    ...brief.comparisons.map((c) => `- ${md(c.label)} (${md(c.state)}): ${md(c.detail)}`),
    '',
  ];
  if (brief.options.includeMissing)
    lines.push(
      '## Missing evidence',
      ...brief.summary.coverage.map(
        (c) =>
          `- ${md(c.label)} unavailable/unverified in: ${c.missing_ids.map(md).join(', ') || 'none'}.`,
      ),
      'These are record-layer gaps; additional reports may contain unmapped context.',
      '',
    );
  if (brief.options.detailed) {
    lines.push('## Detailed measurement fields');
    for (const r of brief.records)
      lines.push(
        `### ${md(r.experiment_id)}`,
        '| Quantity | Value | Unit | Status | Locator |',
        '|---|---|---|---|---|',
        ...valueFields(r).map(
          ([key, d]) =>
            `| ${md(key)} | ${md(d.value ?? 'Unknown')} | ${md(d.unit)} | ${md(d.status)} | ${md(d.source_locator ?? r.source_locator)} |`,
        ),
      );
  }
  lines.push('## Source references');
  for (const c of brief.citations) {
    lines.push(
      `- ${md(c.experiment_id)} / ${md(c.source_id)}: ${md(c.title ?? 'Source metadata unavailable')}; ${md(c.locator)}; DOI ${md(c.doi ?? 'not reported')}. ${c.url ? `[NASA source](${c.url.replace(/[()\s]/g, encodeURIComponent)})` : md(c.limitation)}`,
    );
    if (brief.options.includeSourceNotes) {
      const record = brief.records.find((r) => r.experiment_id === c.experiment_id)!;
      lines.push(
        ...record.provenance_notes.map((n) => `  - ${md(n)}`),
        ...valueFields(record)
          .filter(([, d]) => d.note)
          .map(([key, d]) => `  - ${md(key)} (${md(d.status)}): ${md(d.note)}`),
      );
    }
  }
  lines.push(
    '',
    '## Scientific limitations',
    ...brief.limitations.map((l) => `- ${md(l)}`),
    '',
    '## Disclaimer',
    brief.disclaimer,
    '',
  );
  return lines.join('\n');
}
export function briefHtml(brief: ResearchBrief): string {
  const h = htmlEscape;
  const list = (items: string[]) =>
    `<ul>${items.map((item) => `<li>${h(item)}</li>`).join('')}</ul>`;
  const table = (headers: string[], rows: unknown[][]) =>
    `<div class="table-wrap"><table><thead><tr>${headers.map((heading) => `<th scope="col">${h(heading)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${h(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const content = `<h2>Research scope</h2>${list(brief.summary.investigations.map((i) => `${i.family}: ${i.count} records (${i.record_ids.join(', ')})`))}<p>User-supplied purpose, not verified findings: ${h(brief.user_metadata.research_question || 'Not supplied')}</p>
    <h2>Selected experiments</h2>${table(
      ['Record', 'Investigation / material', 'Oxygen', 'Pressure', 'Flow', 'Gravity'],
      brief.records.map((r) => [
        r.experiment_id,
        `${r.family} / ${r.material_raw}`,
        ...[r.oxygen_initial_pct, r.total_pressure_psia, r.flow_initial_cm_s, r.gravity_regime].map(
          (d) => `${d.value ?? 'Unknown'} ${d.unit ?? ''} (${d.status})`,
        ),
      ]),
    )}
    <h2>Evidence observations</h2>${list(brief.summary.coverage.map((c) => `${c.label}: ${c.available}/${c.total} available; ${c.measured_or_corrected} measured/corrected, ${c.derived} derived, ${c.approximate_or_qualitative} approximate/qualitative, ${c.context_only} context-only. Records: ${c.reported_ids.join(', ') || 'none'}.`))}<p>Standardized measured outcomes: ${brief.summary.standardized_outcome_count}/${brief.record_count}. Burn durations and qualitative annotations are not standardized outcomes.</p>
    <h2>Comparison limitations</h2>${list(brief.comparisons.map((c) => `${c.label} (${c.state}): ${c.detail}`))}
    ${brief.options.includeMissing ? `<h2>Missing evidence and research gaps</h2>${list(brief.summary.coverage.map((c) => `${c.label} unavailable/unverified in: ${c.missing_ids.join(', ') || 'none'}.`))}<p>Record-layer gaps do not establish absence from all NASA research. Additional per-test reporting requires conditions, methods, units, uncertainty and source locators.</p>` : ''}
    ${
      brief.options.detailed
        ? `<h2>Detailed measurement fields</h2>${brief.records
            .map(
              (r) =>
                `<h3>${h(r.experiment_id)}</h3>${table(
                  ['Quantity', 'Value', 'Unit', 'Status', 'Locator'],
                  valueFields(r).map(([key, d]) => [
                    key,
                    d.value ?? 'Unknown',
                    d.unit ?? '',
                    d.status,
                    d.source_locator ?? r.source_locator,
                  ]),
                )}`,
            )
            .join('')}`
        : ''
    }
    <h2>Source references</h2><ol>${brief.citations
      .map(
        (c) =>
          `<li>${h(c.experiment_id)} / ${h(c.source_id)}: ${h(c.title ?? 'Source metadata unavailable')}; ${h(c.locator)}; DOI ${h(c.doi ?? 'not reported')}. ${c.url ? `<a href="${h(c.url)}">NASA source</a> (${h(c.url)})` : h(c.limitation)}${
            brief.options.includeSourceNotes
              ? list([
                  ...brief.records.find((r) => r.experiment_id === c.experiment_id)!
                    .provenance_notes,
                  ...valueFields(brief.records.find((r) => r.experiment_id === c.experiment_id)!)
                    .filter(([, d]) => d.note)
                    .map(([key, d]) => `${key} (${d.status}): ${d.note}`),
                ])
              : ''
          }</li>`,
      )
      .join('')}</ol>
    <h2>Scientific limitations</h2>${list(brief.limitations)}<h2>Scientific disclaimer</h2><p class="notice">${h(brief.disclaimer)}</p>`;
  // All content is escaped; the HTML export contains no scripts or external assets.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${h(brief.user_metadata.title)}</title><style>body{font:15px/1.55 system-ui,sans-serif;color:#111;max-width:1000px;margin:2rem auto;padding:1rem;overflow-wrap:anywhere}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #aaa;padding:.4rem;text-align:left;overflow-wrap:anywhere}h1,h2{break-after:avoid}tr{break-inside:avoid}.notice{border-left:4px solid #555;padding:1rem}@media print{body{margin:0;padding:0}a{color:#111}.table-wrap{overflow:visible}@page{margin:16mm}}</style></head><body><h1>FIRETRACE — ${h(brief.user_metadata.title)}</h1><p>Generated ${h(brief.generated_at)} · ${brief.record_count} selected records · Dataset SHA-256 ${h(brief.dataset_version)}</p>${content}</body></html>`;
}
export function exportFilename(date: string, extension: 'csv' | 'json' | 'md' | 'html'): string {
  const value = new Date(date);
  if (!Number.isFinite(value.getTime())) throw new Error('Invalid export date.');
  const stamp = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
  return `firetrace-evidence-brief-${stamp}.${extension}`;
}
export function exportArtifact(brief: ResearchBrief, format: 'csv' | 'json' | 'md' | 'html') {
  return {
    filename: exportFilename(brief.generated_at, format),
    mime: {
      csv: 'text/csv;charset=utf-8',
      json: 'application/json',
      md: 'text/markdown;charset=utf-8',
      html: 'text/html;charset=utf-8',
    }[format],
    content:
      format === 'csv'
        ? briefCsv(brief)
        : format === 'json'
          ? JSON.stringify(brief, null, 2)
          : format === 'md'
            ? briefMarkdown(brief)
            : briefHtml(brief),
  };
}
