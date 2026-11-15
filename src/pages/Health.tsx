import { useEffect, useRef, useState } from 'react';
import { PageHeader, Panel, Badge } from '../components/ui';
import { probeCapabilities } from '../lib/capabilities';
import type { CapabilityReport, CapabilityStatus } from '../lib/capabilities';
import { downloadText } from '../lib/export';

const TONES: Record<CapabilityStatus, 'mint' | 'amber' | 'red' | 'muted'> = {
  available: 'mint',
  degraded: 'amber',
  unavailable: 'red',
  not_configured: 'muted',
};

export function Health() {
  const [report, setReport] = useState<CapabilityReport | null>(null);
  const [checkApi, setCheckApi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const started = useRef(false);

  async function probe(api: boolean) {
    setBusy(true);
    try {
      const next = await probeCapabilities({ checkApi: api });
      setReport(next);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void probe(false);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const serviceWorker =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? Boolean(navigator.serviceWorker.controller)
      : false;

  return (
    <div className="page page--health">
      <PageHeader
        index="16"
        eyebrow="System Health"
        title={
          <>
            Prove the capability, <em>don't assume it.</em>
          </>
        }
        lede="Every capability is probed against the running build. Bundled retrieval remains authoritative. The optional evidence API is never treated as ready unless it answers a readiness probe."
        actions={
          <>
            <button type="button" className="button button--ghost button--small" onClick={() => probe(checkApi)} disabled={busy}>
              {busy ? 'Probing…' : 'Re-probe'}
            </button>
            {report && (
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => downloadText('firertrace-health.json', JSON.stringify(report, null, 2), 'application/json')}
              >
                Export report
              </button>
            )}
          </>
        }
      />

      <Panel kicker="Environment" title="Current session">
        <div className="wb-health-env">
          <div>
            <span className="kicker">Network</span>
            <Badge tone={online ? 'mint' : 'amber'}>{online ? 'online' : 'offline'}</Badge>
          </div>
          <div>
            <span className="kicker">Mode</span>
            <Badge tone={report?.mode === 'api-probed' ? 'amber' : 'mint'}>
              {report?.mode ?? 'probing'}
            </Badge>
          </div>
          <div>
            <span className="kicker">Service worker</span>
            <Badge tone={serviceWorker ? 'mint' : 'muted'}>{serviceWorker ? 'controlling' : 'not controlling'}</Badge>
          </div>
          <div>
            <span className="kicker">Bundled corpus</span>
            <Badge tone="mint">authoritative</Badge>
          </div>
        </div>
        <label className="field field--check wb-health-toggle">
          <input type="checkbox" checked={checkApi} onChange={(event) => setCheckApi(event.target.checked)} />
          <span>Probe the optional evidence API when re-probing</span>
        </label>
        <p className="panel-caption">
          The API probe is explicit. If it is off, the report says “not configured” rather than implying the service is
          available. A degraded API never replaces the bundled deterministic engine.
        </p>
      </Panel>

      {report && (
        <>
          <div className="wb-stat-grid">
            <div className="wb-mini-stat">
              <strong>{report.summary.available}</strong>
              <span>available</span>
            </div>
            <div className="wb-mini-stat">
              <strong>{report.summary.degraded}</strong>
              <span>degraded</span>
            </div>
            <div className="wb-mini-stat">
              <strong>{report.summary.unavailable}</strong>
              <span>unavailable</span>
            </div>
            <div className="wb-mini-stat">
              <strong>{report.summary.not_configured}</strong>
              <span>not configured</span>
            </div>
          </div>

          <Panel kicker="Capabilities" title={`${report.capabilities.length} probed`}>
            <ul className="wb-capability-list">
              {report.capabilities.map((capability) => (
                <li key={capability.id} className={`wb-capability is-${capability.status}`}>
                  <div className="wb-capability__head">
                    <Badge tone={TONES[capability.status]}>{capability.status.replaceAll('_', ' ')}</Badge>
                    <strong>{capability.name}</strong>
                    <span className="mono muted">{capability.id}</span>
                  </div>
                  <p>{capability.detail}</p>
                  {capability.evidence.length > 0 && (
                    <p className="mono muted wb-break">{capability.evidence.join(' · ')}</p>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel kicker="Report identity" title="Probe context">
            <dl className="kv">
              <div>
                <dt>Generated</dt>
                <dd className="mono">{report.generated_at}</dd>
              </div>
              <div>
                <dt>Corpus version</dt>
                <dd className="mono wb-break">{report.corpus_version}</dd>
              </div>
              <div>
                <dt>User agent</dt>
                <dd className="mono wb-break">{navigator.userAgent}</dd>
              </div>
            </dl>
            <p className="panel-caption">
              No secrets or environment values are included. The report contains only probe outcomes and the public
              corpus version.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
