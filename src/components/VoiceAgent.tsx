import { useEffect, useRef, useState } from 'react';
import { apiHealth, apiVoiceTurn, playWavBase64 } from '../lib/api';

export function VoiceAgent() {
  const [question, setQuestion] = useState('');
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Not checked. Use Health to check optional speech availability.');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const stopAudio = useRef<(() => void) | null>(null);
  useEffect(() => () => stopAudio.current?.(), []);

  async function handleAsk() {
    if (!available || busy || !question.trim()) return;
    setBusy(true); setError(''); setStatus('Preparing speech…'); stopAudio.current?.();
    try {
      const result = await apiVoiceTurn(question.trim());
      setAnswer(result.spoken);
      if (result.audio_b64) {
        stopAudio.current = await playWavBase64(result.audio_b64);
        setStatus(result.llm_used ? 'Speech started · grounded local interpretation.' : 'Speech started · deterministic answer.');
      } else setStatus('Text answer returned; no speech audio was provided.');
    } catch (err) { setStatus('Speech unavailable. You can retry or continue with typed TRACE.'); setError(err instanceof Error ? err.message : 'Voice unavailable. Use typed TRACE.'); }
    finally { setBusy(false); }
  }
  async function checkHealth() {
    setBusy(true); setError(''); setAvailable(false); setStatus('Checking optional voice service…');
    try {
      const health = await apiHealth(); setAvailable(health.available);
      setStatus(health.available ? 'Voice ready.' : health.reason === 'evidence_only'
        ? 'Voice unavailable in evidence-only mode. Start backend/main.py with local speech dependencies and models. Typed TRACE remains available.'
        : health.reason === 'corpus_mismatch' ? 'Voice dataset is unverified or incompatible. Use typed TRACE.'
        : 'Voice is not configured. Local speech dependencies or models are missing; typed TRACE remains available.');
    } catch (err) { setStatus('Voice unavailable. Typed TRACE remains available.'); setError(err instanceof Error ? err.message : 'Voice unavailable.'); }
    finally { setBusy(false); }
  }
  return <section className="panel" aria-labelledby="voice-agent-title">
    <h2 id="voice-agent-title">Voice agent (optional combined backend)</h2>
    <p className="muted">The default evidence API supports typed TRACE. Speech additionally requires the combined backend and local models. Check Health before asking for speech.</p>
    <div className="voice-controls">
      <input aria-label="Voice assistant question" type="text" maxLength={500} value={question}
        onChange={event => setQuestion(event.target.value)} placeholder="Ask the corpus…" />
      <button type="button" className="button button--lime" disabled={!available || busy || !question.trim()} onClick={() => void handleAsk()}>Ask &amp; speak</button>
      <button type="button" className="button button--outline" disabled={busy} onClick={() => void checkHealth()}>Health</button>
    </div>
    <p role="status">{status}</p>
    {error && <p role="alert">{error}</p>}
    {answer && <pre style={{whiteSpace:'pre-wrap',maxHeight:240,overflow:'auto'}}>{answer}</pre>}
  </section>;
}
