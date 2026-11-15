import { useMemo, useState } from 'react';
import { PageHeader, Panel, Badge } from '../components/ui';
import { buildIntegrityReport, integrityToMarkdown } from '../lib/integrity';
import type { IntegrityStatus } from '../lib/integrity';
import { downloadText } from '../lib/export';

const TONES: Record<IntegrityStatus, 'mint' | 'amber' | 'red'> = {
  pass: 'mint',
  warn: 'amber',
  fail: 'red',
};

export function Integrity() {
  const [filter, setFilter] = useState<IntegrityStatus | 'all'>('all');
  const report = useMemo(() => buildIntegrityReport(), []);
  const checks = filter === 'all' ? report.checks : report.checks.filter((check) => check.status === filter);

  return (
    <div className="page page--integrity">
      <PageHeader
        index="14"
        eyebrow="Corpus Integrity"
        title={
          <>
            Internal consistency, <em>stated plainly.</em>
          </>
        }
        lede="Checks compare the bundled corpus, validation report, source manifest, and claims against each other. A failure is surfaced as a failure. These checks do not re-download artifacts and they do not certify scientific correctness."
        actions={
          <>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => downloadText('firertrace-integrity.md', integrityToMarkdown(report), 'text/markdown')}
            >
              Markdown
            </button>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() =>
                downloadText('firertrace-integrity.json', JSON.stringify(report, null, 2), 'application/json')
              }
            >
              JSON
            </button>
          </>
        }
      />

      <div className="wb-stat-grid">
        <div className="wb-mini-stat">
          <strong>{report.summary.total}</strong>
          <span>checks</span>
        </div>
        <div className="wb-mini-stat">
          <strong>{report.summary.pass}</strong>
          <span>pass</span>
        </div>
        <div className="wb-mini-stat">
          <strong>{report.summary.warn}</strong>
          <span>warn</span>
        </div>
        <div className="wb-mini-stat">
          <strong>{report.summary.fail}</strong>
          <span>fail</span>
        </div>
      </div>

      <Panel
        kicker="Overall"
        title={
          <span className="wb-status-line">
            <Badge tone={TONES[report.status]}>{report.status.toUpperCase()}</Badge>
            <span className="mono muted">policy {report.policy_version}</span>
          </span>
        }
      >
        <dl className="kv">
          <div>
            <dt>Corpus version</dt>
            <dd className="mono wb-break">{report.corpus_version}</dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd className="mono">{report.generated_at}</dd>
          </div>
        </dl>
        <p className="panel-caption">
          A passing check means the local data are internally consistent. It does not mean the source experiment is
          scientifically valid, and it is not a NASA certification.
        </p>
      </Panel>

      <Panel kicker="Checks" title={`${checks.length} check(s) in view`}>
        <div className="wb-chip-row">
          {(['all', 'pass', 'warn', 'fail'] as const).map((status) => (
            <button
              key={status}
              type="button"
              className={`wb-chip ${filter === status ? 'is-active' : ''}`}
              onClick={() => setFilter(status)}
            >
              {status} (
              {status === 'all'
                ? report.checks.length
                : report.checks.filter((check) => check.status === status).length}
              )
            </button>
          ))}
        </div>
        <ul className="wb-integrity-list">
          {checks.map((check) => (
            <li key={check.id} className={`wb-integrity is-${check.status}`}>
              <div className="wb-integrity__head">
                <Badge tone={TONES[check.status]}>{check.status}</Badge>
                <strong>{check.title}</strong>
                <span className="mono muted">{check.id}</span>
              </div>
              <p>{check.detail}</p>
              {check.evidence.length > 0 && (
                <details>
                  <summary>{check.evidence.length} evidence item(s)</summary>
                  <p className="mono wb-break">{check.evidence.join(', ')}</p>
                </details>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel kicker="Limitations" title="Carried with the report">
        <ul className="wb-check-list">
          {report.limitations.map((limitation) => (
            <li key={limitation}>
              <Badge tone="amber">limit</Badge>
              <span>{limitation}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
