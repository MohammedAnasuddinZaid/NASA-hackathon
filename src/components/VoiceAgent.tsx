import { useState } from 'react';
import { apiHealth, apiVoiceTurn, playWavBase64 } from '../lib/api';

export function VoiceAgent() {
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState<string>('idle');
  const [answer, setAnswer] = useState<string>('');
  const [error, setError] = useState<string>('');

  async function handleAsk() {
    const q = question.trim();
    if (!q) return;
    setError('');
    setStatus('processing');
    try {
      const result = await apiVoiceTurn(q);
      setAnswer(result.spoken);
      setStatus(result.llm_used ? 'spoken (grounded LLM)' : 'spoken (deterministic)');
      if (result.audio_b64) playWavBase64(result.audio_b64);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice turn failed');
      setStatus('error');
    }
  }

  async function checkHealth() {
    try {
      const health = (await apiHealth()) as { status?: string };
      setStatus(`backend: ${health.status ?? 'unknown'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backend unreachable');
    }
  }

  return (
    <section className="panel" aria-labelledby="voice-agent-title">
      <h2 id="voice-agent-title">Voice agent (local backend)</h2>
      <p className="muted">
        Optional. Requires the FIRETRACE backend running on 127.0.0.1:8000. Answers are
        retrieved deterministically; speech is generated locally.
      </p>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask the corpus…"
          style={{ flex: 1 }}
        />
        <button type="button" className="button button--lime" onClick={handleAsk}>
          Ask &amp; speak
        </button>
        <button type="button" className="button button--outline" onClick={checkHealth}>
          Health
        </button>
      </div>
      {status && <p className="muted">Status: {status}</p>}
      {error && <p className="is-red">{error}</p>}
      {answer && (
        <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>
          {answer}
        </pre>
      )}
    </section>
  );
}
