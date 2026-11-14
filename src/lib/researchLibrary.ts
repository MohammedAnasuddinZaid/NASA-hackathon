import coverageJson from '../data/research_coverage.json';
import type { ExperimentRecord } from './types';

export type CombustionType = 'solid_fuel' | 'liquid_droplet';
export interface ResearchInvestigation {
  id: string; acronym: string; title: string; combustion_type: CombustionType;
  fuel_category: 'solid' | 'liquid'; doi: string; gravity_context: string;
  objective: string; platform: string; metadata_source_id: string; metadata_locator: string;
}
export interface ResearchDocument {
  id: string; investigation_id: string; title: string;
  kind: 'research_report' | 'experimental_table' | 'investigation_metadata';
  url: string; download_url: string; doi: string | null; nasa_id?: string;
  version: string; sha256: string; bytes: number; local_path: string | null;
  acquired_at: string | null; access: string; license: string; limitations: string[];
}
export interface ReportFinding {
  id: string; investigation_id: string; source_id: string; title: string; summary: string;
  content_origin: string;
  finding_type: 'methodology' | 'report_aggregate' | 'qualitative_observation' | 'research_limitation';
  quantitative: boolean; topics: string[];
  locator: { pdf_page: number; printed_page: string; section: string };
  experiment_ids: string[]; limitations: string[];
  quantities: Array<{ quantity: string; raw: string; value: number | null; unit: string;
    status: string; qualifier: string; uncertainty: string | null }>;
}
export interface ResearchLibraryData {
  schema_version: string; dataset_version: string; base_corpus_sha256: string;
  verified_at: string; investigations: ResearchInvestigation[];
  sources: ResearchDocument[]; findings: ReportFinding[]; limitations: string[];
}
export const researchCoverage = coverageJson;
export const combustionLabel = { solid_fuel: 'Solid-fuel combustion', liquid_droplet: 'Liquid-fuel droplet combustion' };

export function nasaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && ['psi.nasa.gov', 'ntrs.nasa.gov'].includes(url.hostname);
  } catch { return false; }
}
/** Refuse mixed, malformed or stale snapshots; build-time ingestion performs deeper scientific validation. */
export function validateResearch(value: unknown): ResearchLibraryData {
  const data = value as ResearchLibraryData;
  if (!data || data.schema_version !== 'firetrace.research/1' ||
      data.dataset_version !== researchCoverage.dataset_version ||
      data.base_corpus_sha256 !== researchCoverage.base_corpus_sha256 ||
      !Array.isArray(data.investigations) || !Array.isArray(data.sources) || !Array.isArray(data.findings))
    throw new Error('Research snapshot is invalid or does not match this build.');
  const unique = (items: { id: string }[]) => items.every(x => typeof x.id === 'string') && new Set(items.map(x => x.id)).size === items.length;
  if (![data.investigations, data.sources, data.findings].every(unique)) throw new Error('Duplicate research identifiers.');
  const invs = new Set(data.investigations.map(x => x.id));
  const sources = new Map(data.sources.map(x => [x.id, x]));
  if (data.investigations.some(x => !['solid_fuel', 'liquid_droplet'].includes(x.combustion_type) ||
      x.fuel_category !== (x.combustion_type === 'solid_fuel' ? 'solid' : 'liquid')))
    throw new Error('Invalid combustion classification.');
  if (data.sources.some(x => !invs.has(x.investigation_id) || !nasaUrl(x.url) || !nasaUrl(x.download_url)))
    throw new Error('Invalid NASA source reference.');
  if (data.investigations.some(x => sources.get(x.metadata_source_id)?.investigation_id !== x.id || !x.metadata_locator))
    throw new Error('Invalid investigation metadata source.');
  if (data.findings.some(x => !sources.has(x.source_id) || sources.get(x.source_id)?.investigation_id !== x.investigation_id ||
      !x.locator?.section || !Number.isInteger(x.locator.pdf_page) || x.locator.pdf_page < 1 || !x.locator.printed_page ||
      !Array.isArray(x.experiment_ids) || x.experiment_ids.length !== 0 || !Array.isArray(x.quantities) || !Array.isArray(x.topics) ||
      !Array.isArray(x.limitations) || !x.summary || !x.content_origin?.startsWith('FIRETRACE-authored paraphrase') ||
      !['methodology', 'report_aggregate', 'qualitative_observation', 'research_limitation'].includes(x.finding_type) ||
      x.quantitative !== Boolean(x.quantities.length) || x.quantities.some(q => !q.unit || !q.status || !q.qualifier || !q.raw ||
        (q.value !== null && (typeof q.value !== 'number' || !Number.isFinite(q.value))))))
    throw new Error('Invalid report locator or unverified experiment mapping.');
  if (data.findings.length !== researchCoverage.counts.report_findings || data.sources.length !== researchCoverage.counts.linked_sources)
    throw new Error('Research coverage does not match this build.');
  return data;
}
export async function loadResearch(): Promise<ResearchLibraryData> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/research.json`);
  if (!response.ok) throw new Error('Research file is unavailable. Retry or inspect the NASA sources.');
  const text = await response.text();
  if (text.length > 1_000_000) throw new Error('Research snapshot exceeds the expected size.');
  return validateResearch(JSON.parse(text));
}
export type ResearchResult = {
  id: string; type: 'finding' | 'experiment' | 'source' | 'investigation'; investigation_id: string;
  title: string; text: string; topics: string[]; source_ids: string[];
};
export function researchEntries(data: ResearchLibraryData, records: ExperimentRecord[]): ResearchResult[] {
  return [
    ...data.findings.map(f => ({ id: f.id, type: 'finding' as const, investigation_id: f.investigation_id,
      title: f.title, text: f.summary, topics: f.topics, source_ids: [f.source_id] })),
    ...data.sources.map(s => ({ id: s.id, type: 'source' as const, investigation_id: s.investigation_id,
      title: s.title, text: `${s.kind} ${s.doi ?? ''} ${s.limitations.join(' ')}`, topics: [], source_ids: [s.id] })),
    ...data.investigations.map(i => ({ id: i.id, type: 'investigation' as const, investigation_id: i.id,
      title: i.title, text: `${i.acronym} ${i.objective} ${i.platform} ${i.gravity_context} ${combustionLabel[i.combustion_type]} ${i.doi}`, topics: [],
      source_ids: data.sources.filter(s => s.investigation_id === i.id).map(s => s.id) })),
    ...records.map(r => ({ id: r.experiment_id, type: 'experiment' as const, investigation_id: r.source_id,
      title: `${r.experiment_id} · ${r.material_raw}`, text: `${r.family} ${r.geometry} ${r.source_locator}`, topics: [],
      source_ids: data.sources.filter(s => s.investigation_id === r.source_id && s.kind === 'experimental_table').map(s => s.id) })),
  ];
}
export const emptyResearchFilters = { query: '', investigation: 'all', combustion: 'all', evidence: 'finding', topic: 'all', source: 'all' };
export type ResearchFilters = typeof emptyResearchFilters;
export function searchResearch(data: ResearchLibraryData, records: ExperimentRecord[], filters: ResearchFilters): ResearchResult[] {
  const tokens = filters.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const entries = researchEntries(data, records);
  const exact = entries.find(entry => ['experiment', 'finding'].includes(entry.type) && entry.id.toLowerCase() === filters.query.trim().toLowerCase());
  return (exact ? [exact] : entries).filter(entry => {
    const investigation = data.investigations.find(i => i.id === entry.investigation_id);
    const sourceText = data.sources.filter(s => entry.source_ids.includes(s.id)).map(s => `${s.id} ${s.title} ${s.doi ?? ''}`).join(' ');
    return (filters.investigation === 'all' || entry.investigation_id === filters.investigation) &&
      (filters.combustion === 'all' || investigation?.combustion_type === filters.combustion) &&
      (filters.evidence === 'all' || entry.type === filters.evidence) &&
      (filters.topic === 'all' || entry.topics.includes(filters.topic)) &&
      (filters.source === 'all' || entry.source_ids.includes(filters.source)) &&
      tokens.every(token => `${entry.id} ${entry.title} ${entry.text} ${entry.topics.join(' ')} ${entry.investigation_id} ${investigation?.acronym} ${investigation?.doi} ${sourceText}`.toLocaleLowerCase().includes(token));
  });
}
export function researchCompatibility(a: ResearchInvestigation | undefined, b: ResearchInvestigation | undefined) {
  if (!a || !b) return 'Choose two verified investigations. No substitution is made for an unknown identifier.';
  if (a.combustion_type !== b.combustion_type)
    return 'Not numerically comparable: solid-fuel flame spread and liquid-droplet burning or extinction are different measurements. Shared oxygen or microgravity context does not establish equivalence.';
  return 'A shared combustion category does not establish comparability. Check fuel, geometry, thickness or droplet size, atmosphere, pressure, flow direction, scale, diagnostics and method. Report aggregates are not per-test measurements.';
}
export function findingLocator(finding: ReportFinding) {
  return `Printed p.${finding.locator.printed_page} · PDF p.${finding.locator.pdf_page} · ${finding.locator.section}`;
}
