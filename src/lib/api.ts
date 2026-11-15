import { API_BASE as evidenceBase } from './apiClient';
import { bundledCorpusVersion } from './datasetIdentity';

// Voice may have a separate combined backend; otherwise use the configured evidence origin.
export const API_BASE = import.meta.env.VITE_VOICE_API_BASE?.trim() || evidenceBase;
export interface VoiceHealth { available: boolean; reason?: 'evidence_only' | 'not_configured' | 'corpus_mismatch' }
async function request(path: string, body?: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_BASE}${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    // Consume the bounded response while the timeout still applies.
    const text = await response.text();
    return new Response(text, { status: response.status, headers: response.headers });
  } catch {
    throw new Error('The optional voice service is unreachable or timed out. Typed TRACE remains available.');
  } finally { globalThis.clearTimeout(timer); }
}
export async function apiHealth(): Promise<VoiceHealth> {
  const response = await request('/api/health');
  if (response.status === 404) return { available: false, reason: 'evidence_only' };
  if (!response.ok) return { available: false, reason: 'not_configured' };
  if (!response.headers.get('content-type')?.includes('json')) return { available: false, reason: 'evidence_only' };
  const health = await response.json();
  if (health.corpus_version !== bundledCorpusVersion) return { available: false, reason: 'corpus_mismatch' };
  return { available: health.voice?.available === true, reason: health.voice?.available ? undefined : 'not_configured' };
}
export async function apiAsk(question: string): Promise<{ answer: unknown; spoken: string }> {
  const response = await request('/api/ask', { question });
  if (!response.ok) throw new Error('The optional combined backend could not answer. Use typed TRACE.');
  return response.json();
}
export async function apiVoiceTurn(text: string): Promise<{
  transcript: string; answer: unknown; spoken: string; llm_used: boolean; audio_b64: string | null;
}> {
  const response = await request('/api/voice/turn', { text });
  if (!response.ok) throw new Error('Voice is unavailable. Configure the combined backend and local speech models; typed TRACE is unaffected.');
  return response.json();
}
export async function playWavBase64(b64: string): Promise<() => void> {
  const bytes = Uint8Array.from(atob(b64), char => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  const audio = new Audio(url);
  const cleanup = () => { audio.pause(); URL.revokeObjectURL(url); };
  audio.onended = cleanup; audio.onerror = cleanup;
  try { await audio.play(); return cleanup; }
  catch { cleanup(); throw new Error('Speech playback was blocked or the audio could not be played. The text answer remains available.'); }
}
