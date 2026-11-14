import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { evidenceApi, type Coverage } from './apiClient';
interface Session { mode: 'checking' | 'api' | 'bundled'; reason: string; coverage: Coverage | null; fallback: (reason: string) => void }
const Context = createContext<Session>({ mode: 'bundled', reason: 'Bundled data', coverage: null, fallback: () => {} });
export function EvidenceSession({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<Session, 'fallback'>>({ mode: 'checking', reason: 'Checking evidence API', coverage: null });
  const fallback = (reason: string) => setState({ mode: 'bundled', reason, coverage: null });
  useEffect(() => {
    let active = true;
    if ((import.meta as { env?: Record<string, string> }).env?.VITE_EVIDENCE_API === 'off') { fallback('API disabled'); return; }
    evidenceApi.coverage().then(coverage => { if (active) setState({ mode: 'api', reason: 'Local evidence API · corpus verified', coverage }); })
      .catch(error => { if (active) fallback(error.message); });
    return () => { active = false; };
  }, []);
  return <Context.Provider value={{ ...state, fallback }}>{children}</Context.Provider>;
}
export function useEvidenceSession() { return useContext(Context); }
export function EvidenceConnection() {
  const state = useEvidenceSession();
  return <div role="status" data-testid="evidence-connection" style={{ padding: '10px 24px', fontSize: 12, borderBottom: '1px solid var(--line)' }}>
    <strong>{state.mode === 'api' ? 'API connected' : state.mode === 'checking' ? 'Connecting' : 'Bundled data'}</strong> · {state.reason}
    {state.coverage && <> · {state.coverage.record_count} records</>} · Coverage refers to imported records, not all NASA research.
  </div>;
}
