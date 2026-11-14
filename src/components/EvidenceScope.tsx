import { coverage, records } from '../lib/corpus';

export function EvidenceScope() {
  return <aside className="evidence-scope" aria-label="Evidence scope">
    <strong>Current record layer:</strong> {coverage.pressure_reported} of {records.length} records contain total pressure.
    {' '}This is a table-coverage gap. The BASS-II report documents pressure and ignition context for subsets;
    it has not been mapped to individual records. <a href="#/methodology">Review sources and scope →</a>
  </aside>;
}
