import { useMemo, useState } from 'react';
import { PageHeader, Panel, Badge, EmptyState } from '../components/ui';
import {
  ANALYSIS_DEFINITIONS,
  addAnalysisRun,
  analysisToMarkdown,
  diffAgainstRun,
  loadAnalysisDocument,
  runAnalysis,
  saveAnalysisDocument,
} from '../lib/analysisRun';
import type { AnalysisDefinitionId, AnalysisRun } from '../lib/analysisRun';
import { downloadText, analysisRowsToCsv } from '../lib/export';

const SEVERITY_TONES = {
  info: 'neutral',
  warning: 'amber',
  critical: 'red',
} as const;

export function Analysis() {
  const [document, setDocument] = useState(() => loadAnalysisDocument().value);
  const [warning, setWarning] = useState<string | null>(() => loadAnalysisDocument().warning);
  const [active, setActive] = useState<AnalysisRun | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const diff = useMemo(() => (active ? diffAgainstRun(active) : null), [active]);

  function record(run: AnalysisRun, message: string) {
    const next = addAnalysisRun(document, run);
    const saved = saveAnalysisDocument(next);
    setDocument(next);
    setActive(run);
    if (saved.ok) {
      setWarning(null);
      setNotice(message);
    } else {
      setWarning(saved.error);
      setNotice(`${message} The run is in memory only; it could not be persisted.`);
    }
  }

  function execute(id: AnalysisDefinitionId) {
    const run = runAnalysis(id);
    record(run, `Completed “${run.result.title}” with ${run.result.rows.length} row(s) and ${run.result.findings.length} finding(s).`);
  }

  function executeAll() {
    let next = document;
    let latest: AnalysisRun | null = null;
    for (const definition of ANALYSIS_DEFINITIONS) {
      const run = runAnalysis(definition.id);
      next = addAnalysisRun(next, run);
      latest = run;
    }
    const saved = saveAnalysisDocument(next);
    setDocument(next);
    setActive(latest);
    if (saved.ok) {
      setWarning(null);
      setNotice(`Completed ${ANALYSIS_DEFINITIONS.length} analysis definitions.`);
    } else {
      setWarning(saved.error);
      setNotice('Runs are in memory only; they could not be persisted.');
    }
  }

  return (
    <div className="page page--analysis">
      <PageHeader
        index="13"
        eyebrow="Analysis Runs"
        title={
          <>
            Reproducible counts, <em>not narrative.</em>
          </>
        }
        lede="Each run records its definition version, corpus version, parameters, computed rows, findings, and a per-record fingerprint. Re-running the same definition against the same corpus reproduces the result."
        actions={
          <button type="button" className="button button--ghost button--small" onClick={executeAll}>
            Run all definitions
          </button>
        }
      />

      {warning && (
        <p role="alert" className="wb-alert">
          Analysis history was not loaded or saved: {warning}
        </p>
      )}
      {notice && (
        <div className="wb-notice" role="status">
          <span>{notice}</span>
          <button type="button" className="text-link" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="wb-analysis-layout">
        <aside className="wb-analysis-sidebar">
          <Panel kicker="Definitions" title={`${ANALYSIS_DEFINITIONS.length} available`}>
            <ul className="wb-definition-list">
              {ANALYSIS_DEFINITIONS.map((definition) => (
                <li key={definition.id}>
                  <div className="wb-definition">
                    <div className="wb-definition__head">
                      <strong>{definition.name}</strong>
                      <span className="mono muted">v{definition.version}</span>
                    </div>
                    <p>{definition.description}</p>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() => execute(definition.id)}
                    >
                      Run
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel kicker="History" title={`${document.runs.length} stored run(s)`}>
            {document.runs.length === 0 ? (
              <p className="muted">No runs stored. Running a definition records a versioned run in this browser.</p>
            ) : (
              <ul className="wb-run-list">
                {document.runs.map((run) => (
                  <li key={run.id}>
                    <button
                      type="button"
                      className={`wb-run ${active?.id === run.id ? 'is-active' : ''}`}
                      onClick={() => setActive(run)}
                    >
                      <span>{run.result.title}</span>
                      <span className="mono muted">{run.created_at.slice(0, 16).replace('T', ' ')}</span>
                      <span className="mono muted">
                        {run.definition_id} v{run.definition_version}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>

        <div className="wb-analysis-main">
          {!active ? (
            <Panel kicker="Result" title="No run selected">
              <EmptyState title="Run a definition to see computed rows">
                Analysis rows are counts and inventory derived from the bundled corpus. They are not a statistical
                model, a prediction, or a certification.
              </EmptyState>
            </Panel>
          ) : (
            <>
              <Panel
                kicker="Result"
                title={active.result.title}
                actions={
                  <>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() => downloadText(`analysis-${active.id}.md`, analysisToMarkdown(active), 'text/markdown')}
                    >
                      Markdown
                    </button>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() =>
                        downloadText(`analysis-${active.id}.csv`, analysisRowsToCsv(active), 'text/csv;charset=utf-8')
                      }
                    >
                      CSV
                    </button>
                  </>
                }
              >
                <dl className="kv">
                  <div>
                    <dt>Run ID</dt>
                    <dd className="mono">{active.id}</dd>
                  </div>
                  <div>
                    <dt>Definition</dt>
                    <dd className="mono">
                      {active.definition_id} v{active.definition_version}
                    </dd>
                  </div>
                  <div>
                    <dt>Corpus version</dt>
                    <dd className="mono wb-break">{active.corpus_version}</dd>
                  </div>
                  <div>
                    <dt>Records fingerprinted</dt>
                    <dd className="mono">{Object.keys(active.record_fingerprints).length}</dd>
                  </div>
                </dl>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Label</th>
                        <th className="num">Value</th>
                        <th>Unit</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.result.rows.map((row) => (
                        <tr key={row.key}>
                          <td className="mono">{row.key}</td>
                          <th>{row.label}</th>
                          <td className="num mono">{row.value}</td>
                          <td className="mono">{row.unit ?? '—'}</td>
                          <td>{row.note ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel kicker="Findings" title={`${active.result.findings.length} finding(s)`}>
                {active.result.findings.length === 0 ? (
                  <p className="muted">No findings were produced by this definition.</p>
                ) : (
                  <ul className="wb-finding-list">
                    {active.result.findings.map((finding) => (
                      <li key={finding.id}>
                        <Badge tone={SEVERITY_TONES[finding.severity]}>{finding.severity}</Badge>
                        <div>
                          <strong>{finding.title}</strong>
                          <p>{finding.detail}</p>
                          {finding.record_ids.length > 0 && (
                            <p className="mono muted">{finding.record_ids.join(', ')}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <div className="wb-two-col">
                <Panel kicker="Reproducibility" title="Diff against the current corpus">
                  {diff && (
                    <dl className="kv">
                      <div>
                        <dt>Same corpus version</dt>
                        <dd>{diff.same_version ? 'yes' : 'no'}</dd>
                      </div>
                      <div>
                        <dt>Fingerprint matches</dt>
                        <dd className="mono">
                          {diff.fingerprint_matches} / {diff.total_current}
                        </dd>
                      </div>
                      <div>
                        <dt>Added records</dt>
                        <dd className="mono">{diff.added_records.length}</dd>
                      </div>
                      <div>
                        <dt>Removed records</dt>
                        <dd className="mono">{diff.removed_records.length}</dd>
                      </div>
                      <div>
                        <dt>Changed fingerprints</dt>
                        <dd className="mono">{diff.changed_records.length}</dd>
                      </div>
                    </dl>
                  )}
                  <p className="panel-caption">
                    A fingerprint covers the fields this workspace displays, plus validation status, quality flags,
                    and missing-field markers. A changed fingerprint means the normalized layer changed; it does not
                    say which source is correct.
                  </p>
                </Panel>

                <Panel kicker="Limitations" title="Carried with the run">
                  <ul className="wb-check-list">
                    {active.result.limitations.map((limitation) => (
                      <li key={limitation}>
                        <Badge tone="amber">limit</Badge>
                        <span>{limitation}</span>
                      </li>
                    ))}
                    <li>
                      <Badge tone="amber">limit</Badge>
                      <span>No run re-downloads or re-hashes a remote artifact.</span>
                    </li>
                    <li>
                      <Badge tone="amber">limit</Badge>
                      <span>No run imputes a missing pressure, gravity, ignition method, or outcome.</span>
                    </li>
                  </ul>
                </Panel>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
