/**
 * Capability health.
 *
 * Each capability is probed against the running build. A capability is never
 * reported "available" because it is expected to exist; the probe must pass.
 * The optional evidence API probe is explicit and never silently substitutes
 * for the bundled engine.
 */

import { ask } from './assistant';
import { corpus, corpusVersion, records, validation } from './corpus';
import { buildEvidenceGraph } from './evidenceGraph';
import { verifyAllClaims, summarizeVerifications } from './verification';
import { browserStorage } from './storage';
import { API_BASE } from './api';

export type CapabilityStatus = 'available' | 'degraded' | 'unavailable' | 'not_configured';

export interface Capability {
  id: string;
  name: string;
  status: CapabilityStatus;
  detail: string;
  evidence: string[];
}

export interface CapabilityReport {
  generated_at: string;
  corpus_version: string;
  mode: 'bundled' | 'api-probed';
  capabilities: Capability[];
  summary: Record<CapabilityStatus, number>;
}

export interface CapabilityOptions {
  checkApi?: boolean;
  apiBase?: string;
  timeoutMs?: number;
  now?: Date;
}

function cap(
  id: string,
  name: string,
  status: CapabilityStatus,
  detail: string,
  evidence: string[] = [],
): Capability {
  return { id, name, status, detail, evidence };
}

function summaryOf(capabilities: Capability[]): Record<CapabilityStatus, number> {
  const summary: Record<CapabilityStatus, number> = {
    available: 0,
    degraded: 0,
    unavailable: 0,
    not_configured: 0,
  };
  for (const capability of capabilities) summary[capability.status] += 1;
  return summary;
}

async function probeApi(base: string, timeoutMs: number): Promise<Capability> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/api/v1/health/ready`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return cap('evidence_api', 'Evidence API', 'degraded', `Service responded with HTTP ${response.status}. Bundled retrieval remains authoritative.`);
    }
    const body = (await response.json()) as Record<string, unknown>;
    const ready = body.ready === true || body.status === 'ready';
    return cap(
      'evidence_api',
      'Evidence API',
      ready ? 'available' : 'degraded',
      ready
        ? 'The typed evidence API is reachable and reports ready.'
        : 'The service is reachable but does not report ready. The UI will not treat it as authoritative.',
      [JSON.stringify(body).slice(0, 300)],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'request failed';
    return cap('evidence_api', 'Evidence API', 'unavailable', `No ready response from ${base}. Bundled mode remains active. (${message})`);
  } finally {
    clearTimeout(timer);
  }
}

export async function probeCapabilities(options: CapabilityOptions = {}): Promise<CapabilityReport> {
  const capabilities: Capability[] = [];
  const now = options.now ?? new Date();

  const countMatches =
    records.length === corpus.meta.record_count &&
    records.length === corpus.meta.experiment_record_count;
  capabilities.push(
    cap(
      'bundled_corpus',
      'Bundled corpus',
      countMatches && records.length > 0 ? 'available' : 'unavailable',
      countMatches
        ? `${records.length} records loaded from the build-time corpus.`
        : `Loaded ${records.length}; metadata declares ${corpus.meta.record_count}.`,
      [`corpus_version=${corpusVersion}`],
    ),
  );

  const qualityMatches = (['validated', 'partial', 'suspect'] as const).every(
    (status) => validation.quality_counts[status] === corpus.meta.quality_counts[status],
  );
  capabilities.push(
    cap(
      'validation_report',
      'Validation report',
      qualityMatches ? 'available' : 'degraded',
      qualityMatches
        ? `Validation counts agree: ${validation.quality_counts.validated} validated, ${validation.quality_counts.partial} partial, ${validation.quality_counts.suspect} suspect.`
        : 'Validation counts disagree with corpus metadata. Treat validation status with caution.',
    ),
  );

  const pressureProbe = ask('What pressure was BASS-II run at?');
  const assistantOk =
    pressureProbe.grade === 'absent' &&
    pressureProbe.headline.includes(`0 of ${records.length}`) &&
    pressureProbe.citations.length > 0;
  capabilities.push(
    cap(
      'deterministic_assistant',
      'Deterministic evidence assistant',
      assistantOk ? 'available' : 'degraded',
      assistantOk
        ? 'A pressure probe abstains with the computed zero-coverage count and citations.'
        : 'The pressure probe did not match the expected abstention behavior.',
      [`grade=${pressureProbe.grade}`, `citations=${pressureProbe.citations.length}`],
    ),
  );

  const verifications = verifyAllClaims(now);
  const verificationSummary = summarizeVerifications(verifications);
  capabilities.push(
    cap(
      'claim_verification',
      'Claim verification',
      verificationSummary.contradicted > 0
        ? 'degraded'
        : verificationSummary.total > 0
          ? 'available'
          : 'unavailable',
      `${verificationSummary.total} claim(s): ${verificationSummary.supported} supported, ${verificationSummary.partial} partial, ${verificationSummary.unsupported} unsupported, ${verificationSummary.contradicted} contradicted.`,
    ),
  );

  const graph = buildEvidenceGraph({ builtAt: now.toISOString() });
  capabilities.push(
    cap(
      'evidence_graph',
      'Evidence graph',
      graph.stats.node_count > 0 && graph.stats.records_without_sources.length === 0
        ? graph.stats.orphans > 0
          ? 'degraded'
          : 'available'
        : 'degraded',
      `${graph.stats.node_count} nodes, ${graph.stats.edge_count} edges, ${graph.stats.orphans} orphan(s), ${graph.stats.records_without_sources.length} record(s) without a source.`,
    ),
  );

  const storage = browserStorage();
  capabilities.push(
    cap(
      'local_storage',
      'Local workspace storage',
      storage ? 'available' : 'unavailable',
      storage
        ? 'Versioned local storage is readable and writable.'
        : 'Local storage is unavailable. Notebook, saved views, and analysis runs cannot persist in this browser.',
    ),
  );

  const subtle = typeof globalThis.crypto?.subtle !== 'undefined';
  capabilities.push(
    cap(
      'sha256',
      'SHA-256 content hashing',
      subtle ? 'available' : 'unavailable',
      subtle
        ? 'Web Crypto is available for export and report manifests.'
        : 'Web Crypto is unavailable. Export manifests cannot be generated in this context.',
    ),
  );

  const csvProbe = ask('What oxygen did BASS2-B1 report?');
  capabilities.push(
    cap(
      'citation_export',
      'Citation-bearing answers',
      csvProbe.citations.length > 0 ? 'available' : 'unavailable',
      csvProbe.citations.length > 0
        ? 'Record answers carry source IDs and locators suitable for export.'
        : 'Record answers produced no citation.',
    ),
  );

  const serviceWorker =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? Boolean(navigator.serviceWorker.controller)
      : false;
  capabilities.push(
    cap(
      'offline_shell',
      'Offline application shell',
      serviceWorker ? 'available' : 'not_configured',
      serviceWorker
        ? 'A service worker controls this page; the shell is available offline.'
        : 'No service worker is controlling this page. Bundled data still work after load, but a cold reload requires the network.',
    ),
  );

  if (options.checkApi) {
    capabilities.push(await probeApi(options.apiBase ?? API_BASE, options.timeoutMs ?? 2500));
  } else {
    capabilities.push(
      cap(
        'evidence_api',
        'Evidence API',
        'not_configured',
        'Bundled mode is active. The API was not probed; no remote answer is being treated as authoritative.',
      ),
    );
  }

  return {
    generated_at: now.toISOString(),
    corpus_version: corpusVersion,
    mode: options.checkApi ? 'api-probed' : 'bundled',
    capabilities,
    summary: summaryOf(capabilities),
  };
}
