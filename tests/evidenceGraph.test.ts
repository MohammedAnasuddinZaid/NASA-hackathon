import { describe, expect, it } from 'vitest';
import { records } from '../src/lib/corpus';
import {
  buildEvidenceGraph,
  claimNodeId,
  graphNeighborhood,
  graphSearch,
  graphToJson,
  recordNodeId,
  sourceNodeId,
} from '../src/lib/evidenceGraph';
import { addRecordsToInvestigation, createInvestigation, emptyNotebook } from '../src/lib/notebook';

describe('evidence graph', () => {
  it('builds a connected typed graph from the corpus', () => {
    const graph = buildEvidenceGraph({ builtAt: '2026-01-01T00:00:00.000Z' });
    expect(graph.stats.node_count).toBeGreaterThan(records.length);
    expect(graph.stats.edge_count).toBeGreaterThan(records.length);
    expect(graph.stats.records_without_sources).toEqual([]);
    expect(graph.stats.orphans).toBe(0);
    const ids = new Set(graph.nodes.map((node) => node.id));
    for (const edge of graph.edges) {
      expect(ids.has(edge.from)).toBe(true);
      expect(ids.has(edge.to)).toBe(true);
    }
  });

  it('links a record to its source, investigation, status, and flags', () => {
    const graph = buildEvidenceGraph();
    const neighborhood = graphNeighborhood(graph, recordNodeId('BASS2-B1'), 1);
    expect(neighborhood.root?.kind).toBe('record');
    const ids = neighborhood.nodes.map((node) => node.id);
    expect(ids).toContain(sourceNodeId('PSI-25'));
    expect(ids).toContain('investigation:BASS-II');
    expect(ids).toContain('validation:validated');
  });

  it('links claims to context sources as well as experiment sources', () => {
    const graph = buildEvidenceGraph();
    const contextClaim = graph.edges.find(
      (edge) => edge.to === claimNodeId('CL-CHALLENGE-PGRAV') && edge.from.startsWith('context:'),
    );
    expect(contextClaim).toBeDefined();
  });

  it('searches nodes by identifier and metadata', () => {
    const graph = buildEvidenceGraph();
    const results = graphSearch(graph, 'BASS2-B1');
    expect(results.some((node) => node.id === recordNodeId('BASS2-B1'))).toBe(true);
    const pressure = graphSearch(graph, 'pressure');
    expect(pressure.some((node) => node.kind === 'claim')).toBe(true);
  });

  it('adds notebook references without inventing evidence', () => {
    const created = createInvestigation(emptyNotebook(), { title: 'Graph test' }, 1);
    const attached = addRecordsToInvestigation(
      created.document,
      created.investigation!.id,
      ['BASS2-B1'],
      2,
    );
    const graph = buildEvidenceGraph({ notebook: attached.document });
    const notebook = graph.nodes.find((node) => node.kind === 'notebook');
    expect(notebook).toBeDefined();
    expect(graph.edges.some((edge) => edge.kind === 'references' && edge.to === recordNodeId('BASS2-B1'))).toBe(true);
  });

  it('serializes to JSON without secrets', () => {
    const json = graphToJson(buildEvidenceGraph());
    expect(json).toContain('corpus_version');
    expect(json).not.toMatch(/api[_-]?key|token|secret/i);
    expect(JSON.parse(json).nodes.length).toBeGreaterThan(0);
  });
});
