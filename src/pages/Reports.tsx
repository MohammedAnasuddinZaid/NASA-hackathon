import { useState } from 'react';
import { PageHeader, Panel, Badge } from '../components/ui';
import { buildResearchReport } from '../lib/report';
import type { ReportBundle } from '../lib/report';
import { runBenchmark } from '../lib/benchmark';
import type { BenchmarkRun } from '../lib/benchmark';
import { loadAnalysisDocument } from '../lib/analysisRun';
import { loadNotebook } from '../lib/notebook';
import { downloadBlob, downloadText } from '../lib/export';
import { createZip, zipToBlob } from '../lib/zip';
import { summarizeVerifications } from '../lib/verification';

export function Reports() {
  const [title, setTitle] = useState('FIRETRACE evidence report');
  const [includeClaims, setIncludeClaims] = useState(true);
  const [includeBenchmark, setIncludeBenchmark] = useState(false);
  const [includeNotebook, setIncludeNotebook] = useState(true);
  const [investigationId, setInvestigationId] = useState<string>('');
  const [benchmark, setBenchmark] = useState<BenchmarkRun | null>(null);
  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notebook = loadNotebook().value;
  const analysis = loadAnalysisDocument().value;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      let benchmarkRun = benchmark;
      if (includeBenchmark && !benchmarkRun) {
        benchmarkRun = await runBenchmark();
        setBenchmark(benchmarkRun);
      }
      const report = await buildResearchReport({
        title,
        includeClaims,
        benchmark: includeBenchmark ? benchmarkRun : null,
        analysisRuns: analysis.runs.slice(0, 5),
        notebook: includeNotebook ? notebook : null,
        investigationId: investigationId || null,
        appVersion: '0.1.0',
      });
      setBundle(report);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Report generation failed.');
    } finally {
      setBusy(false);
    }
  }

  function downloadBundle() {
    if (!bundle) return;
    const bytes = createZip(bundle.files.map((file) => ({ path: file.path, content: file.content })));
    downloadBlob(`firertrace-report-${bundle.generated_at.slice(0, 10)}.zip`, zipToBlob(bytes));
  }

  const verification = bundle ? summarizeVerifications(bundle.verifications) : null;

  return (
    <div className="page page--reports">
      <PageHeader
        index="15"
        eyebrow="Reports"
        title={
          <>
            A report that <em>carries its limits.</em>
          </>
        }
        lede="Assemble a deterministic Markdown and JSON report with an integrity section, claim verification, evidence-graph summary, optional benchmark and analysis runs, and a SHA-256 manifest. No secrets are included."
      />

      <div className="wb-two-col">
        <Panel kicker="Configure" title="Report contents">
          <div className="wb-form">
            <label className="field">
              <span>Title</span>
              <input type="text" value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="field field--check">
              <input
                type="checkbox"
                checked={includeClaims}
                onChange={(event) => setIncludeClaims(event.target.checked)}
              />
              <span>Include claim-level verification table</span>
            </label>
            <label className="field field--check">
              <input
                type="checkbox"
                checked={includeBenchmark}
                onChange={(event) => setIncludeBenchmark(event.target.checked)}
              />
              <span>Run and include the deterministic benchmark</span>
            </label>
            <label className="field field--check">
              <input
                type="checkbox"
                checked={includeNotebook}
                onChange={(event) => setIncludeNotebook(event.target.checked)}
              />
              <span>Include a local notebook investigation ({notebook.investigations.length} available)</span>
            </label>
            {includeNotebook && notebook.investigations.length > 0 && (
              <label className="field">
                <span>Investigation</span>
                <select value={investigationId} onChange={(event) => setInvestigationId(event.target.value)}>
                  <option value="">Most recently updated</option>
                  {notebook.investigations.map((investigation) => (
                    <option key={investigation.id} value={investigation.id}>
                      {investigation.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="panel-caption">
              {analysis.runs.length > 0
                ? `The ${Math.min(5, analysis.runs.length)} most recent stored analysis run(s) will be included.`
                : 'No stored analysis runs. Open Analysis Runs to create one.'}
            </p>
            <button type="button" className="button button--ember button--small" onClick={generate} disabled={busy}>
              {busy ? 'Generating…' : 'Generate report'}
            </button>
            {error && (
              <p role="alert" className="wb-alert">
                {error}
              </p>
            )}
          </div>
        </Panel>

        <Panel kicker="Scope" title="What travels with every report">
          <ul className="wb-check-list">
            <li>
              <Badge tone="mint">included</Badge>
              <span>Corpus version, field coverage, and source artifacts.</span>
            </li>
            <li>
              <Badge tone="mint">included</Badge>
              <span>Integrity checks, claim verification, and graph statistics.</span>
            </li>
            <li>
              <Badge tone="mint">included</Badge>
              <span>A SHA-256 manifest over every generated file.</span>
            </li>
            <li>
              <Badge tone="amber">excluded</Badge>
              <span>Secrets, tokens, environment values, and fabricated conclusions.</span>
            </li>
            <li>
              <Badge tone="amber">not claimed</Badge>
              <span>NASA certification, safety assessment, or fire-behavior prediction.</span>
            </li>
          </ul>
        </Panel>
      </div>

      {bundle && (
        <>
          <Panel
            kicker="Generated"
            title={bundle.title}
            actions={
              <>
                <button type="button" className="button button--ember button--small" onClick={downloadBundle}>
                  Download ZIP ({bundle.files.length} files)
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => downloadText('firertrace-report.md', bundle.markdown, 'text/markdown')}
                >
                  Markdown
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => downloadText('firertrace-report.json', bundle.json, 'application/json')}
                >
                  JSON
                </button>
              </>
            }
          >
            <dl className="kv">
              <div>
                <dt>Generated</dt>
                <dd className="mono">{bundle.generated_at}</dd>
              </div>
              <div>
                <dt>Corpus version</dt>
                <dd className="mono wb-break">{bundle.manifest.corpus_version}</dd>
              </div>
              <div>
                <dt>Integrity</dt>
                <dd>
                  <Badge tone={bundle.integrity.status === 'pass' ? 'mint' : bundle.integrity.status === 'warn' ? 'amber' : 'red'}>
                    {bundle.integrity.status}
                  </Badge>{' '}
                  <span className="mono muted">
                    {bundle.integrity.summary.pass} pass · {bundle.integrity.summary.warn} warn ·{' '}
                    {bundle.integrity.summary.fail} fail
                  </span>
                </dd>
              </div>
              <div>
                <dt>Claims verified</dt>
                <dd className="mono">
                  {verification?.supported ?? 0} supported · {verification?.partial ?? 0} partial ·{' '}
                  {verification?.unsupported ?? 0} unsupported · {verification?.contradicted ?? 0} contradicted
                </dd>
              </div>
              <div>
                <dt>Graph</dt>
                <dd className="mono">
                  {bundle.graph.stats.node_count} nodes · {bundle.graph.stats.edge_count} edges
                </dd>
              </div>
              <div>
                <dt>Manifest files</dt>
                <dd className="mono">{bundle.manifest.file_count}</dd>
              </div>
            </dl>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Bytes</th>
                    <th>SHA-256</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.manifest.files.map((file) => (
                    <tr key={file.path}>
                      <th className="mono">{file.path}</th>
                      <td className="num mono">{file.bytes}</td>
                      <td className="mono wb-break">{file.sha256}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="panel-caption">
              The manifest records content hashes only. It is not a signature, an endorsement, or a certification.
            </p>
          </Panel>

          <Panel kicker="Preview" title="Markdown report">
            <details>
              <summary>Show the full generated Markdown</summary>
              <pre className="wb-report-preview">{bundle.markdown}</pre>
            </details>
          </Panel>
        </>
      )}
    </div>
  );
}
