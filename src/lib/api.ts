export const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_FIRETRACE_API_BASE ?? 'http://127.0.0.1:8000';

export async function apiHealth(): Promise<unknown> {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) throw new Error(`health ${response.status}`);
  return response.json();
}

export async function apiAsk(question: string): Promise<{ answer: unknown; spoken: string }> {
  const response = await fetch(`${API_BASE}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) throw new Error(`ask ${response.status}`);
  return response.json();
}

export async function apiVoiceTurn(text: string): Promise<{
  transcript: string;
  answer: unknown;
  spoken: string;
  llm_used: boolean;
  audio_b64: string | null;
}> {
  const response = await fetch(`${API_BASE}/api/voice/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`voice turn ${response.status}`);
  return response.json();
}

export function playWavBase64(b64: string): void {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  void audio.play();
}
