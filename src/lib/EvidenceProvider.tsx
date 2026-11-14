import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { evidenceEnabled, evidenceRequest, type EvidenceCoverage } from './evidenceApi';

interface EvidenceState {
  mode: 'checking' | 'api' | 'bundled';
  reason: string;
  coverage: EvidenceCoverage | null;
  fallback: (reason: string) => void;
}
const Context = createContext<EvidenceState>({ mode: 'bundled', reason: 'Bundled dataset', coverage: null, fallback: () => {} });
export function EvidenceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<EvidenceState, 'fallback'>>({ mode: evidenceEnabled ? 'checking' : 'bundled', reason: evidenceEnabled ? 'Checking local evidence API…' : 'API disabled; bundled dataset', coverage: null });
  const fallback = (reason: string) => setState({ mode: 'bundled', reason, coverage: null });
  useEffect(() => {
    if (!evidenceEnabled) return;
    let active = true;
    evidenceRequest<EvidenceCoverage>('/coverage').then(coverage => {
      if (active) setState({ mode: 'api', reason: 'Local evidence API · dataset verified', coverage });
    }).catch(error => { if (active) fallback(String(error.message)); });
    return () => { active = false; };
  }, []);
  return <Context.Provider value={{ ...state, fallback }}>{children}</Context.Provider>;
}
export function useEvidence() { return useContext(Context); }
export function EvidenceStatus() {
  const state = useEvidence();
  return <div className="evidence-status" role="status" data-testid="evidence-status" style={{ padding: '10px 24px', borderBottom: '1px solid var(--line)', fontSize: '12px' }}>
    <strong>{state.mode === 'api' ? 'API connected' : state.mode === 'checking' ? 'Connecting' : 'Bundled data'}</strong> · {state.reason}
    {state.coverage && <> · {state.coverage.total} records · pressure available {state.coverage.fields.total_pressure_psia.available}</>}
    {' · '}Coverage refers to imported records, not all NASA research.
  </div>;
}
