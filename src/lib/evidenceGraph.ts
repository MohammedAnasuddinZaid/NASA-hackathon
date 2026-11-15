/**
 * Typed, in-memory evidence graph.
 *
 * Nodes and edges are derived from the bundled corpus, source manifest,
 * validation report, claims, and an optional local notebook. There is no graph
 * database and no inferred edge: every edge names the evidence relation it
 * represents. Orphan nodes are reported, not hidden.
 */

import { claims, corpus, corpusVersion, recordById, records, sourceManifest, validation } from './corpus';
import type { NotebookDocument } from './notebook';

export const GRAPH_SCHEMA = 1;
export const GRAPH_POLICY = 'evidence-graph-1.0';

export type GraphNodeKind =
  | 'record'
  | 'investigation'
  | 'source'
  | 'context_source'
  | 'claim'
  | 'validation_status'
  | 'quality_flag'
  | 'notebook';

export type GraphEdgeKind =
  | 'cites'
  | 'belongs_to'
  | 'has_status'
  | 'has_flag'
  | 'supports_claim'
  | 'references'
  | 'uses_source';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  href: string | null;
  meta: Record<string, string | number | boolean | null>;
}

export interface GraphEdge {
  id: string;
  kind: GraphEdgeKind;
  from: string;
  to: string;
  label: string;
}

export interface EvidenceGraph {
  schema_version: number;
  policy_version: string;
  corpus_version: string;
  built_at: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    node_count: number;
    edge_count: number;
    nodes_by_kind: Record<string, number>;
    edges_by_kind: Record<string, number>;
    orphans: number;
    orphan_ids: string[];
    records_without_sources: string[];
  };
}

export interface GraphOptions {
  notebook?: NotebookDocument | null;
  builtAt?: string;
}

export function recordNodeId(recordId: string): string {
  return `record:${recordId}`;
}

export function sourceNodeId(sourceId: string): string {
  return `source:${sourceId}`;
}

export function claimNodeId(claimId: string): string {
  return `claim:${claimId}`;
}

export function investigationNodeId(family: string): string {
  return `investigation:${family}`;
}

export function buildEvidenceGraph(options: GraphOptions = {}): EvidenceGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const addNode = (node: GraphNode) => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  };
  const addEdge = (edge: Omit<GraphEdge, 'id'>) => {
    const id = `${edge.kind}|${edge.from}|${edge.to}`;
    if (!edges.has(id)) edges.set(id, { ...edge, id });
  };

  for (const investigation of corpus.meta.investigations) {
    addNode({
      id: investigationNodeId(investigation.family),
      kind: 'investigation',
      label: investigation.family,
      href: `#/atlas?family=${encodeURIComponent(investigation.family)}`,
      meta: {
        title: investigation.title,
        records: investigation.records,
        psi: investigation.psi,
        doi: investigation.doi,
      },
    });
  }

  for (const source of sourceManifest.sources) {
    addNode({
      id: sourceNodeId(source.source_id),
      kind: 'source',
      label: source.source_title,
      href: source.local_original_url ?? source.source_url,
      meta: {
        source_id: source.source_id,
        role: source.role,
        license: source.license,
        sha256: source.sha256,
        local_artifact: Boolean(source.local_original_url),
        locator: source.source_locator,
      },
    });
  }

  for (const source of sourceManifest.context_sources) {
    addNode({
      id: `context:${source.source_id}`,
      kind: 'context_source',
      label: source.source_title,
      href: source.source_url,
      meta: { source_id: source.source_id, role: source.role, license: source.license },
    });
  }

  for (const claim of claims) {
    addNode({
      id: claimNodeId(claim.claim_id),
      kind: 'claim',
      label: claim.claim_text.slice(0, 140),
      href: `#/verification?claim=${encodeURIComponent(claim.claim_id)}`,
      meta: {
        claim_id: claim.claim_id,
        claim_type: claim.claim_type,
        validation_status: claim.validation_status,
        limitation: claim.limitation,
      },
    });
    for (const sourceId of claim.supporting_source_ids) {
      const target = nodes.has(sourceNodeId(sourceId))
        ? sourceNodeId(sourceId)
        : nodes.has(`context:${sourceId}`)
          ? `context:${sourceId}`
          : null;
      if (!target) continue;
      addEdge({
        kind: 'supports_claim',
        from: target,
        to: claimNodeId(claim.claim_id),
        label: 'supports claim',
      });
    }
  }

  for (const record of records) {
    const recordNode = recordNodeId(record.experiment_id);
    addNode({
      id: recordNode,
      kind: 'record',
      label: record.experiment_id,
      href: `#/atlas?id=${encodeURIComponent(record.experiment_id)}`,
      meta: {
        experiment_id: record.experiment_id,
        family: record.family,
        material: record.material_raw,
        validation_status: record.validation_status,
        source_id: record.source_id,
        oxygen_initial: record.oxygen_initial_pct.value,
        pressure: record.total_pressure_psia.value,
        gravity_status: record.gravity_regime.status,
        outcome_status: record.outcome.status,
      },
    });

    const investigation = investigationNodeId(record.family);
    if (nodes.has(investigation)) {
      addEdge({ kind: 'belongs_to', from: recordNode, to: investigation, label: 'belongs to' });
    }

    const source = sourceNodeId(record.source_id);
    if (nodes.has(source)) {
      addEdge({ kind: 'cites', from: recordNode, to: source, label: 'source row' });
    }

    const statusId = `validation:${record.validation_status}`;
    addNode({
      id: statusId,
      kind: 'validation_status',
      label: record.validation_status,
      href: `#/coverage?quality=${encodeURIComponent(record.validation_status)}`,
      meta: { status: record.validation_status },
    });
    addEdge({ kind: 'has_status', from: recordNode, to: statusId, label: 'validation status' });

    for (const flag of record.quality_flags) {
      const flagId = `flag:${flag}`;
      addNode({
        id: flagId,
        kind: 'quality_flag',
        label: flag.replaceAll('_', ' '),
        href: `#/coverage?flag=${encodeURIComponent(flag)}`,
        meta: { flag, count: validation.quality_flag_counts[flag] ?? 0 },
      });
      addEdge({ kind: 'has_flag', from: recordNode, to: flagId, label: 'quality flag' });
    }
  }

  if (options.notebook) {
    for (const investigation of options.notebook.investigations) {
      const notebookId = `notebook:${investigation.id}`;
      addNode({
        id: notebookId,
        kind: 'notebook',
        label: investigation.title,
        href: `#/notebook?id=${encodeURIComponent(investigation.id)}`,
        meta: {
          status: investigation.status,
          items: investigation.items.length,
          records: investigation.record_ids.length,
          updated_at: investigation.updated_at,
        },
      });
      for (const recordId of investigation.record_ids) {
        if (!recordById.has(recordId)) continue;
        addEdge({ kind: 'references', from: notebookId, to: recordNodeId(recordId), label: 'references' });
      }
      for (const item of investigation.items) {
        for (const sourceId of item.source_ids) {
          if (!nodes.has(sourceNodeId(sourceId))) continue;
          addEdge({ kind: 'uses_source', from: notebookId, to: sourceNodeId(sourceId), label: 'uses source' });
        }
      }
    }
  }

  const nodeList = [...nodes.values()];
  const edgeList = [...edges.values()];
  const connected = new Set<string>();
  for (const edge of edgeList) {
    connected.add(edge.from);
    connected.add(edge.to);
  }
  const orphanNodes = nodeList.filter(
    (node) => !connected.has(node.id) && node.kind !== 'context_source',
  );
  const nodesByKind: Record<string, number> = {};
  for (const node of nodeList) nodesByKind[node.kind] = (nodesByKind[node.kind] ?? 0) + 1;
  const edgesByKind: Record<string, number> = {};
  for (const edge of edgeList) edgesByKind[edge.kind] = (edgesByKind[edge.kind] ?? 0) + 1;

  const recordsWithoutSources = records
    .filter((record) => !sourceManifest.sources.some((source) => source.source_id === record.source_id))
    .map((record) => record.experiment_id);

  return {
    schema_version: GRAPH_SCHEMA,
    policy_version: GRAPH_POLICY,
    corpus_version: corpusVersion,
    built_at: options.builtAt ?? new Date().toISOString(),
    nodes: nodeList,
    edges: edgeList,
    stats: {
      node_count: nodeList.length,
      edge_count: edgeList.length,
      nodes_by_kind: nodesByKind,
      edges_by_kind: edgesByKind,
      orphans: orphanNodes.length,
      orphan_ids: orphanNodes.map((node) => node.id),
      records_without_sources: recordsWithoutSources,
    },
  };
}

export interface GraphNeighborhood {
  nodes: GraphNode[];
  edges: GraphEdge[];
  root: GraphNode | null;
}

export function graphNeighborhood(graph: EvidenceGraph, nodeId: string, depth = 1): GraphNeighborhood {
  const root = graph.nodes.find((node) => node.id === nodeId) ?? null;
  if (!root) return { nodes: [], edges: [], root: null };
  const visited = new Set<string>([nodeId]);
  const collectedEdges = new Map<string, GraphEdge>();
  let frontier = new Set<string>([nodeId]);
  for (let level = 0; level < Math.max(1, depth); level += 1) {
    const next = new Set<string>();
    for (const edge of graph.edges) {
      if (frontier.has(edge.from) || frontier.has(edge.to)) {
        collectedEdges.set(edge.id, edge);
        if (!visited.has(edge.from)) next.add(edge.from);
        if (!visited.has(edge.to)) next.add(edge.to);
      }
    }
    for (const id of next) visited.add(id);
    frontier = next;
  }
  return {
    root,
    nodes: graph.nodes.filter((node) => visited.has(node.id)),
    edges: [...collectedEdges.values()],
  };
}

export function graphSearch(graph: EvidenceGraph, rawQuery: string, limit = 40): GraphNode[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];
  const terms = query.split(/\s+/);
  return graph.nodes
    .filter((node) => {
      const haystack = `${node.id} ${node.label} ${Object.values(node.meta).join(' ')}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit);
}

export function graphStatsByKind(graph: EvidenceGraph): Array<{ kind: GraphNodeKind; count: number }> {
  return Object.entries(graph.stats.nodes_by_kind)
    .map(([kind, count]) => ({ kind: kind as GraphNodeKind, count }))
    .sort((a, b) => b.count - a.count);
}

/** A compact JSON representation suitable for export. No secrets are included. */
export function graphToJson(graph: EvidenceGraph): string {
  return JSON.stringify(
    {
      schema_version: graph.schema_version,
      policy_version: graph.policy_version,
      corpus_version: graph.corpus_version,
      built_at: graph.built_at,
      stats: graph.stats,
      nodes: graph.nodes,
      edges: graph.edges,
    },
    null,
    2,
  );
}
