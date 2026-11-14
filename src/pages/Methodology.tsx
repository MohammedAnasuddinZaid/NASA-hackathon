import { corpus, validation, sourceManifest, records } from '../lib/corpus';
import { formatNumber, shortIso, humanizeToken } from '../lib/format';
import { Badge, PageHeader, Panel, SectionRule, SourceLink, Stat } from '../components/ui';
import { useEvidenceSession } from '../lib/evidenceSession';

function bytes(value: number): string {
  if (value > 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  if (value > 1_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${value} B`;
}

export function Methodology() {
  const session = useEvidenceSession();
  const suspect = records.filter((record) => record.validation_status === 'suspect');
  const excluded = validation.excluded_non_experiment_rows;
  const downloads = [
    { href: './data/validation_report.json', label: 'Validation report', detail: 'Machine-readable checks and provenance' },
    { href: './data/source_manifest.json', label: 'Source manifest', detail: 'Artifacts, hashes, licenses and limitations' },
    { href: './data/corpus.json', label: 'Corpus JSON', detail: 'Normalized records, claims, presets and limitations' },
  ];

  return (
    <div className="page page--methodology">
      <PageHeader
        index="06"
        eyebrow="Methodology & Sources"
        title={<>Built to be checked, <em>not trusted.</em></>}
        lede="FIRETRACE is a transparent transformation of preserved public NASA PSI artifacts. Every normalized value keeps its status, raw token, source locator and limitations. Nothing is zero-filled; nothing is silently corrected."
        actions={<Badge tone="mint">Pipeline v{corpus.meta.pipeline_version}</Badge>}
      />

      <div className="method-stats">
        <Stat value={String(records.length)} label="accepted experiment records" detail={corpus.meta.investigations.map((item) => `${item.records} ${item.family}`).join(" + ")} tone="paper" />
        <Stat value={String(sourceManifest.sources.length)} label="preserved source artifacts" detail="CSV, ReadMe, matrix, calibration, NTRS" tone="mint" />
        <Stat value={`${validation.matrix_cross_check.test_ids_matched}/${validation.matrix_cross_check.test_ids_in_csv}`} label="matrix ID cross-check" detail="IDs and initial O2 checked" tone="mint" />
        <Stat value={String(suspect.length)} label="records flagged suspect" detail="Retained and disclosed" tone="amber" />
      </div>

      {session.coverage && <Panel kicker="Evidence API" title="Imported dataset coverage">
        <p>{session.coverage.record_count} records. Non-null context and qualitative notes are not measured per-test conditions or standardized outcomes.</p>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Field</th><th>Non-null</th><th>Measured / corrected</th><th>Context only</th><th>Null</th><th>Statuses</th></tr></thead><tbody>
          {Object.entries(session.coverage.field_coverage).map(([key, field]) => <tr key={key}><td>{field.label}</td><td>{field.reported}</td><td>{field.per_test_measured}</td><td>{field.context_only}</td><td>{field.missing}</td><td>{Object.entries(field.statuses).map(([status, count]) => `${status}: ${count}`).join(' · ')}</td></tr>)}
        </tbody></table></div>
      </Panel>}
      <SectionRule label="Pipeline" meta="Raw files are never modified" />
      <div className="pipeline">
        {[
          ['01', 'Acquire', 'Download the PSI experimental tables, ReadMes, test matrices, fan calibration and NTRS context. Record SHA-256, DOI, license and retrieval time.'],
          ['02', 'Preserve', 'Keep every original CSV field as a string in record.raw. Do not overwrite or reformat the source files.'],
          ['03', 'Normalize', 'Parse numeric values, units and statuses. Mark derived fields, retain ranges and flags, and keep missing values null.'],
          ['04', 'Validate', 'Cross-check test IDs and O2 values against the six-sheet matrix. Run explicit missing-data and non-substitution gates.'],
          ['05', 'Publish', 'Emit a local corpus with source locators and a validation report. The app loads it offline; no runtime API is required.'],
        ].map(([index, title, text]) => (
          <div className="pipeline__step" key={index}>
            <span className="pipeline__index mono">{index}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>

      <div className="method-split">
        <Panel kicker="Evidence policy" title="Rules the pipeline enforces">
          <ul className="policy-list">
            <li><strong>Missing is not zero.</strong> Every absent field is null with a <span className="mono">not_reported</span> status.</li>
            <li><strong>No substitution.</strong> ISS or Cygnus cabin pressure is never used as a per-test pressure.</li>
            <li><strong>No level promotion.</strong> Investigation-level context is not presented as a per-test measurement.</li>
            <li><strong>No silent correction.</strong> Anomalies are flagged and retained, not rewritten.</li>
            <li><strong>No fabricated outcome.</strong> Free-text notes and burn duration are not converted into a flammability classification.</li>
            <li><strong>No external generation.</strong> The assistant retrieves from this corpus; it does not call a language model.</li>
          </ul>
        </Panel>

        <Panel kicker="Validation" title={<>Gate results <span className="mono muted">({validation.checks.filter((check) => check.result === 'PASS').length}/{validation.checks.length} pass)</span></>}>
          <div className="validation-list">
            {validation.checks.map((check) => (
              <div className="validation-list__row" key={check.check}>
                <span className={`validation-list__result validation-list__result--${check.result.toLowerCase()}`}>{check.result}</span>
                <div>
                  <div className="validation-list__check">{check.check}</div>
                  <div className="validation-list__detail">{check.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel kicker="Cross-check" title="CSV versus the six-sheet test-matrix workbook" actions={<Badge tone="mint">{validation.matrix_cross_check.o2_initial_mismatches.length} initial-O2 conflicts</Badge>}>
        <div className="crosscheck">
          <div className="crosscheck__numbers">
            <div><strong>{validation.matrix_cross_check.test_ids_in_csv}</strong><span>test IDs in CSV</span></div>
            <div><strong>{validation.matrix_cross_check.test_ids_in_matrix}</strong><span>test IDs in matrix</span></div>
            <div><strong>{validation.matrix_cross_check.test_ids_matched}</strong><span>matched IDs</span></div>
            <div><strong>{validation.matrix_cross_check.o2_initial_exact_matches}</strong><span>exact initial O2 matches</span></div>
          </div>
          <div className="crosscheck__detail">
            <p>{validation.matrix_cross_check.interpretation}</p>
            <div className="crosscheck__diffs">
              <span className="mono">{validation.matrix_cross_check.material_text_formatting_differences} material text-format differences</span>
              <span className="mono">{validation.matrix_cross_check.air_display_formatting_differences} air-display text-format differences</span>
              <span className="mono">{validation.matrix_cross_check.substantive_numeric_conflicts.length} substantive numeric conflicts</span>
            </div>
            <p className="muted">
              Text differences were counted, not proven to be formatting-only. Other numeric columns
              were not exhaustively cross-checked. Raw values remain available for review.
            </p>
          </div>
        </div>
      </Panel>

      <SectionRule label="Retained anomalies" meta="Flags, not corrections" />
      <div className="anomaly-grid">
        <Panel kicker="Suspect records" title={`${suspect.length} records carry a suspect flag`}>
          <div className="anomaly-list">
            {suspect.map((record) => (
              <div className="anomaly" key={record.experiment_id}>
                <div className="anomaly__head">
                  <span className="mono">{record.experiment_id}</span>
                  <Badge tone="red">suspect</Badge>
                </div>
                <div className="anomaly__flags">
                  {record.quality_flags.map((flag) => (
                    <span key={flag}>{humanizeToken(flag)}</span>
                  ))}
                </div>
                {record.experiment_id === 'BASS2-P22b' || record.experiment_id === 'BASS2-T28b' ? (
                  <div className="anomaly__values mono">
                    initial O2 {record.oxygen_initial_pct.raw} → final {record.oxygen_final_pct.raw}
                  </div>
                ) : (
                  <div className="anomaly__values mono">date reported: {record.date_reported}</div>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel kicker="Excluded rows" title={`${excluded.length} non-experiment rows`}>
          <div className="excluded-list">
            {excluded.map((row) => (
              <div className="excluded" key={row.sample}>
                <div className="excluded__head">
                  <span className="mono">CSV row {row.row}</span>
                  <span>{row.sample}</span>
                </div>
                <p>{row.material}</p>
                <div className="excluded__reason">{row.reason}</div>
              </div>
            ))}
          </div>
          <p className="panel-caption">
            Saffire-I also contains pre/post-flow image-set descriptors. Counting them as experiments
            would inflate the two sample rows to four records; this is not a claim about the number of independent flight burns.
          </p>
        </Panel>
      </div>

      <SectionRule label="Sources" meta={`${sourceManifest.sources.length} artifacts + ${sourceManifest.context_sources.length} context sources`} />
      <div className="source-list">
        {sourceManifest.sources.map((source) => (
          <article className="source-card" key={`${source.source_id}-${source.original_filename}`}>
            <div className="source-card__head">
              <div>
                <div className="kicker">{source.source_id} · {source.role.replaceAll('_', ' ')}</div>
                <h3>{source.source_title}</h3>
              </div>
              <Badge tone={source.processing_status === 'parsed' ? 'mint' : 'amber'}>{source.processing_status.replaceAll('_', ' ')}</Badge>
            </div>
            <dl className="source-meta">
              <div><dt>File</dt><dd className="mono">{source.original_filename} · {bytes(source.file_size_bytes)}</dd></div>
              <div><dt>Version</dt><dd>{source.version}</dd></div>
              <div><dt>DOI</dt><dd className="mono">{source.doi ?? 'not assigned'}</dd></div>
              <div><dt>License</dt><dd>{source.license}</dd></div>
              <div><dt>Acquired (manifest)</dt><dd className="mono">{source.download_timestamp ? shortIso(source.download_timestamp) : 'Not preserved'}</dd></div>
              <div><dt>SHA-256</dt><dd className="mono hash">{source.sha256}</dd></div>
            </dl>
            <div className="source-card__locator">{source.source_locator}</div>
            <p className="panel-caption">{source.timestamp_note}</p>
            <ul className="source-limits">
              {source.limitations.map((limitation) => (<li key={limitation}>{limitation}</li>))}
            </ul>
            <div className="source-card__foot">
              <SourceLink href={source.source_url}>Landing page</SourceLink>
              {source.local_original_url && <a href={source.local_original_url} download>Preserved NASA original ({source.content_type.split('/').pop()}) ↓</a>}
              {source.original_download_url && <SourceLink href={source.original_download_url}>NASA original download</SourceLink>}
              {source.license_url && <SourceLink href={source.license_url} quiet>License</SourceLink>}
            </div>
          </article>
        ))}
      </div>

      <div className="context-sources">
        {sourceManifest.context_sources.map((source) => (
          <div className="context-source" key={source.source_id}>
            <div>
              <div className="kicker">{source.source_id} · {source.role.replaceAll('_', ' ')}</div>
              <h4>{source.source_title}</h4>
              <p>{source.limitations.join(' ')}</p>
            </div>
            <SourceLink href={source.source_url}>Open</SourceLink>
            {source.original_download_url && <SourceLink href={source.original_download_url}>Original report PDF (NASA)</SourceLink>}
          </div>
        ))}
      </div>

      <div className="method-split">
        <Panel kicker="Known limitations" title="What this corpus cannot establish">
          <ul className="refusal-list">
            {corpus.limitations.map((limitation) => (<li key={limitation}>{limitation}</li>))}
          </ul>
        </Panel>
        <Panel kicker="Downloads" title="Audit artifacts">
          <div className="download-list">
            {downloads.map((item) => (
              <a href={item.href} download className="download-row" key={item.href}>
                <div>
                  <span>{item.label}</span>
                  <small>{item.detail}</small>
                </div>
                <span aria-hidden="true">↓</span>
              </a>
            ))}
          </div>
          <p className="panel-caption">
            Generated {corpus.meta.generated_at.slice(0, 10)}. The corpus is bundled into the app;
            these files are also available as static downloads.
          </p>
        </Panel>
      </div>

      <div className="independence">
        <div className="independence__mark">NASA</div>
        <div>
          <h3>Independent project. No endorsement implied.</h3>
          <p>
            FIRETRACE was built for the NASA Space Apps Challenge 2026 “Flame in Freefall” prompt. It
            uses public NASA PSI data under CC0-1.0 and public NTRS material. It is not affiliated
            with, endorsed by, or certified by NASA. The challenge page is quoted for alignment only,
            not treated as an experimental source.
          </p>
          <div className="independence__stats mono">
            <span>{formatNumber(records.length, 0)} records</span>
            <span>{corpus.meta.investigations.map((investigation) => investigation.doi).join(' · ')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
