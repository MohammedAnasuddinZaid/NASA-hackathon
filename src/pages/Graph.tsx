import { useMemo, useState } from 'react';
import { PageHeader, Panel, Badge, EmptyState } from '../components/ui';
import {
  buildEvidenceGraph,
  graphNeighborhood,
  graphSearch,
  graphStatsByKind,
  graphToJson,
} from '../lib/evidenceGraph';
import type { GraphNode } from '../lib/evidenceGraph';
import { loadNotebook } from '../lib/notebook';
import { downloadText } from '../lib/export';

const KIND_TONES: Record<string, 'mint' | 'amber' | 'neutral' | 'red' | 'muted'> = {
  record: 'mint',
  investigation: 'amber',
  source: 'neutral',
  context_source: 'muted',
  claim: 'red',
  validation_status: 'neutral',
  quality_flag: 'amber',
  notebook: 'mint',
};

export function Graph() {
  const [notebook] = useState(() => loadNotebook().value);
  const graph = useMemo(() => buildEvidenceGraph({ notebook }), [notebook]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('record:BASS2-B1');
  const [depth, setDepth] = useState(1);

  const results = query.trim() ? graphSearch(graph, query) : [];
  const neighborhood = graphNeighborhood(graph, selectedId, depth);
  const kinds = graphStatsByKind(graph);
  const root = neighborhood.root;

  const radius = 180;
  const center = 220;
  const positioned = neighborhood.nodes.map((node, index) => {
    if (node.id === selectedId) return { node, x: center, y: center };
    const others = neighborhood.nodes.filter((item) => item.id !== selectedId);
    const position = others.findIndex((item) => item.id === node.id);
    const angle = (position / Math.max(1, others.length)) * Math.PI * 2 - Math.PI / 2;
    return { node, x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
  });
  const positions = new Map(positioned.map((item) => [item.node.id, item]));

  function selectNode(node: GraphNode) {
    setSelectedId(node.id);
    setQuery('');
  }

  return (
    <div className="page page--graph">
      <PageHeader
        index="10"
        eyebrow="Evidence Graph"
        title={
          <>
            Every claim has a <em>path back.</em>
          </>
        }
        lede="A typed graph built from the bundled corpus, source manifest, validation report, claims, and your local notebook. Every edge names the relation it represents; nothing is inferred."
        actions={
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => downloadText('firertrace-evidence-graph.json', graphToJson(graph), 'application/json')}
          >
            Export graph JSON
          </button>
        }
      />

      <div className="wb-stat-grid">
        <div className="wb-mini-stat">
          <strong>{graph.stats.node_count}</strong>
          <span>nodes</span>
        </div>
        <div className="wb-mini-stat">
          <strong>{graph.stats.edge_count}</strong>
          <span>typed edges</span>
        </div>
        <div className="wb-mini-stat">
          <strong>{graph.stats.orphans}</strong>
          <span>orphan nodes</span>
        </div>
        <div className="wb-mini-stat">
          <strong>{graph.stats.records_without_sources.length}</strong>
          <span>records without a source</span>
        </div>
      </div>

      <div className="wb-two-col">
        <Panel kicker="Search" title="Find a node">
          <label className="field field--search">
            <span>Identifier, material, claim text, flag…</span>
            <input
              type="search"
              value={query}
              placeholder="BASS2-B1, PMMA, pressure, suspect"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {query.trim() && (
            <ul className="wb-graph-results">
              {results.length === 0 && <li className="muted">No node matches every term.</li>}
              {results.map((node) => (
                <li key={node.id}>
                  <button type="button" className="wb-graph-result" onClick={() => selectNode(node)}>
                    <Badge tone={KIND_TONES[node.kind] ?? 'neutral'}>{node.kind.replaceAll('_', ' ')}</Badge>
                    <span>{node.label}</span>
                    <span className="mono muted">{node.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="drawer-section__sub">Nodes by kind</div>
          <ul className="wb-kind-list">
            {kinds.map((item) => (
              <li key={item.kind}>
                <span>{item.kind.replaceAll('_', ' ')}</span>
                <span className="mono">{item.count}</span>
              </li>
            ))}
          </ul>
          <div className="drawer-section__sub">Edges by kind</div>
          <ul className="wb-kind-list">
            {Object.entries(graph.stats.edges_by_kind)
              .sort((a, b) => b[1] - a[1])
              .map(([kind, count]) => (
                <li key={kind}>
                  <span>{kind.replaceAll('_', ' ')}</span>
                  <span className="mono">{count}</span>
                </li>
              ))}
          </ul>
        </Panel>

        <Panel
          kicker="Neighborhood"
          title={root ? root.label : 'Select a node'}
          actions={
            <label className="field field--inline">
              <span>Depth</span>
              <select value={depth} onChange={(event) => setDepth(Number(event.target.value))}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
          }
        >
          {!root ? (
            <EmptyState title="That node is not in this graph">
              The identifier did not resolve. No nearby node was substituted.
            </EmptyState>
          ) : (
            <>
              <div className="wb-graph-canvas">
                <svg viewBox="0 0 440 440" aria-label={`Neighborhood of ${root.label}`}>
                  <g className="wb-graph-edges">
                    {neighborhood.edges.map((edge) => {
                      const from = positions.get(edge.from);
                      const to = positions.get(edge.to);
                      if (!from || !to) return null;
                      return (
                        <line
                          key={edge.id}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          className="wb-graph-edge"
                        />
                      );
                    })}
                  </g>
                  <g>
                    {positioned.map(({ node, x, y }) => (
                      <g
                        key={node.id}
                        transform={`translate(${x} ${y})`}
                        className={`wb-graph-node ${node.id === selectedId ? 'is-root' : ''}`}
                        onClick={() => setSelectedId(node.id)}
                        role="button"
                        tabIndex={0}
                        aria-label={`${node.kind.replaceAll('_', ' ')}: ${node.label}`}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') setSelectedId(node.id);
                        }}
                      >
                        <circle r={node.id === selectedId ? 15 : 9} />
                        <text y={node.id === selectedId ? -24 : -14} textAnchor="middle">
                          {node.kind === 'record' ? node.label : node.kind.replaceAll('_', ' ')}
                        </text>
                      </g>
                    ))}
                  </g>
                </svg>
              </div>
              <dl className="kv">
                <div>
                  <dt>Node</dt>
                  <dd className="mono">{root.id}</dd>
                </div>
                <div>
                  <dt>Kind</dt>
                  <dd>{root.kind.replaceAll('_', ' ')}</dd>
                </div>
                <div>
                  <dt>Neighborhood</dt>
                  <dd className="mono">
                    {neighborhood.nodes.length} node(s), {neighborhood.edges.length} edge(s)
                  </dd>
                </div>
                {root.href && (
                  <div>
                    <dt>Open</dt>
                    <dd>
                      <a className="text-link" href={root.href}>
                        {root.href}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Edge</th>
                      <th>From</th>
                      <th>To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {neighborhood.edges.slice(0, 40).map((edge) => (
                      <tr key={edge.id}>
                        <td>{edge.label}</td>
                        <td className="mono">{edge.from}</td>
                        <td className="mono">{edge.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {neighborhood.edges.length > 40 && (
                <p className="panel-caption">Showing the first 40 of {neighborhood.edges.length} edges.</p>
              )}
            </>
          )}
        </Panel>
      </div>

      <Panel kicker="Policy" title="How this graph is built">
        <ul className="wb-check-list">
          <li>
            <Badge tone="mint">typed</Badge>
            <span>Records cite source artifacts and belong to investigations.</span>
            <span className="mono muted">belongs_to, cites</span>
          </li>
          <li>
            <Badge tone="mint">typed</Badge>
            <span>Claims are supported by experiment or context sources.</span>
            <span className="mono muted">supports_claim</span>
          </li>
          <li>
            <Badge tone="mint">typed</Badge>
            <span>Validation status and quality flags attach to records.</span>
            <span className="mono muted">has_status, has_flag</span>
          </li>
          <li>
            <Badge tone="mint">typed</Badge>
            <span>Notebook investigations reference records and sources they cite.</span>
            <span className="mono muted">references, uses_source</span>
          </li>
        </ul>
        <p className="panel-caption">
          There is no graph database and no similarity edge. An edge exists only when a field in the corpus or the
          notebook names both ends. Orphan nodes are counted, not hidden.
        </p>
        {graph.stats.orphan_ids.length > 0 && (
          <p className="panel-caption">Orphan IDs: {graph.stats.orphan_ids.join(', ')}.</p>
        )}
      </Panel>
    </div>
  );
}
