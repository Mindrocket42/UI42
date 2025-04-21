import type { AppSettings } from './settings';

/**
 * streamGrok
 * ---------
 * Streams chat completions from Grok's API, yielding incremental content.
 */
export async function* streamGrok(
  url: string,
  headers: Record<string, string>,
  settings: AppSettings,
  messages: { role: string; content: string }[],
  signal?: AbortSignal
): AsyncGenerator<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.model,
      messages,
      stream: true
    }),
    signal
  });
  if (!res.ok || !res.body) {
    const txt = await res.text();
    throw new Error(`Grok API error ${res.status}: ${txt}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const ln of lines) {
      const line = ln.trim();
      if (!line || !line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta: string | undefined = json?.choices?.[0]?.delta?.content ?? undefined;
        if (delta) yield delta;
      } catch {}
    }
  }
}
