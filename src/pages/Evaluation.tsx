import { useEffect, useRef, useState } from 'react';
import { PageHeader, Panel, Badge } from '../components/ui';
import { BENCHMARK_VERSION, runBenchmark } from '../lib/benchmark';
import type { BenchmarkCategory, BenchmarkRun } from '../lib/benchmark';
import { downloadText } from '../lib/export';

const CATEGORIES: Array<BenchmarkCategory | 'all'> = [
  'all',
  'retrieval',
  'abstention',
  'provenance',
  'coverage',
  'safety',
  'adversarial',
];

export function Evaluation() {
  const [run, setRun] = useState<BenchmarkRun | null>(null);
  const [running, setRunning] = useState(false);
  const [category, setCategory] = useState<BenchmarkCategory | 'all'>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const started = useRef(false);

  async function execute() {
    setRunning(true);
    try {
      const next = await runBenchmark();
      setRun(next);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void execute();
  }, []);

  const cases = (run?.results ?? []).filter(
    (item) =>
      (category === 'all' || item.category === category) &&
      (resultFilter === 'all' || (resultFilter === 'pass' ? item.pass : !item.pass)),
  );

  return (
    <div className="page page--evaluation">
      <PageHeader
        index="12"
        eyebrow="Evaluation Harness"
        title={
          <>
            Test the retrieval, <em>including its refusals.</em>
          </>
        }
        lede="A versioned deterministic benchmark over the bundled assistant. Cases are fixed and reviewable: retrieval, abstention, provenance, coverage, safety, and adversarial instructions."
        actions={
          <>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={execute}
              disabled={running}
            >
              {running ? 'Running…' : 'Re-run benchmark'}
            </button>
            {run && (
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => downloadText('firertrace-benchmark.json', JSON.stringify(run, null, 2), 'application/json')}
              >
                Export results
              </button>
            )}
          </>
        }
      />

      {!run ? (
        <Panel kicker="Benchmark" title="Running the deterministic harness">
          <p className="muted">
            {running
              ? 'Executing every case against the bundled engine. No network request is made.'
              : 'No benchmark run is loaded yet.'}
          </p>
        </Panel>
      ) : (
        <>
          <div className="wb-stat-grid">
            <div className="wb-mini-stat">
              <strong>
                {run.passed} / {run.total}
              </strong>
              <span>cases passed</span>
            </div>
            <div className="wb-mini-stat">
              <strong>{run.pass_rate}%</strong>
              <span>pass rate</span>
            </div>
            <div className="wb-mini-stat">
              <strong>{run.failed}</strong>
              <span>failures</span>
            </div>
            <div className="wb-mini-stat">
              <strong>{run.duration_ms.toFixed(1)} ms</strong>
              <span>wall time (machine-dependent)</span>
            </div>
          </div>

          <Panel kicker="Run identity" title="Versioned and reproducible">
            <dl className="kv">
              <div>
                <dt>Benchmark version</dt>
                <dd className="mono">{BENCHMARK_VERSION}</dd>
              </div>
              <div>
                <dt>Case fingerprint</dt>
                <dd className="mono wb-break">{run.case_fingerprint}</dd>
              </div>
              <div>
                <dt>Corpus version</dt>
                <dd className="mono wb-break">{run.corpus_version}</dd>
              </div>
              <div>
                <dt>Generated</dt>
                <dd className="mono">{run.generated_at}</dd>
              </div>
            </dl>
            <ul className="wb-check-list">
              {run.notes.map((note) => (
                <li key={note}>
                  <Badge tone="neutral">note</Badge>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel kicker="Categories" title="Pass rate by category">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Total</th>
                    <th className="num">Passed</th>
                    <th className="num">Failed</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(run.by_category).map(([name, bucket]) => (
                    <tr key={name}>
                      <th>{name}</th>
                      <td className="num mono">{bucket.total}</td>
                      <td className="num mono">{bucket.passed}</td>
                      <td className="num mono">{bucket.failed}</td>
                      <td>
                        <Badge tone={bucket.failed === 0 ? 'mint' : 'red'}>
                          {bucket.failed === 0 ? 'all pass' : `${bucket.failed} fail`}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel kicker="Cases" title={`${cases.length} case(s) in view`}>
            <div className="wb-chip-row">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`wb-chip ${category === item ? 'is-active' : ''}`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
              <span className="wb-chip-divider" aria-hidden="true" />
              {(['all', 'pass', 'fail'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`wb-chip ${resultFilter === item ? 'is-active' : ''}`}
                  onClick={() => setResultFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <ul className="wb-benchmark-list">
              {cases.map((item) => (
                <li key={item.id} className={`wb-benchmark ${item.pass ? 'is-pass' : 'is-fail'}`}>
                  <div className="wb-benchmark__head">
                    <span className="mono">{item.id}</span>
                    <Badge tone={item.pass ? 'mint' : 'red'}>{item.pass ? 'pass' : 'fail'}</Badge>
                    <Badge tone="neutral">{item.category}</Badge>
                    <span className="mono muted">
                      {item.actual_grade} · {item.citations} citation(s) · {item.duration_ms.toFixed(1)} ms
                    </span>
                  </div>
                  <p className="wb-benchmark__question">{item.question}</p>
                  <p className="panel-caption">{item.note}</p>
                  {!item.pass && (
                    <ul className="wb-benchmark__failures">
                      {item.failures.map((failure) => (
                        <li key={failure}>{failure}</li>
                      ))}
                    </ul>
                  )}
                  <details>
                    <summary>Expected grade, verification verdict, citation resolution</summary>
                    <p>
                      Expected <span className="mono">{item.expected_grade}</span>; actual{' '}
                      <span className="mono">{item.actual_grade}</span>; verification verdict{' '}
                      <span className="mono">{item.verdict}</span>; citation sources resolve:{' '}
                      <span className="mono">{item.citation_sources_resolve ? 'yes' : 'no'}</span>.
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel kicker="Scope" title="What this benchmark does not establish">
            <ul className="wb-check-list">
              <li>
                <Badge tone="amber">not</Badge>
                <span>A scientific validation of the source experiments.</span>
                <span className="muted">It checks retrieval behavior and abstention.</span>
              </li>
              <li>
                <Badge tone="amber">not</Badge>
                <span>A statistical generalization over all possible questions.</span>
                <span className="muted">The case set is fixed and deliberately small.</span>
              </li>
              <li>
                <Badge tone="amber">not</Badge>
                <span>A model comparison.</span>
                <span className="muted">No external model is called in bundled mode.</span>
              </li>
            </ul>
            <p className="panel-caption">
              A failure is kept visible. The harness never rewrites an expected grade to make a case pass.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
