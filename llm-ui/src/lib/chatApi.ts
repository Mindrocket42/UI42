import type { Message } from './db';

/**
 * streamChat
 * ----------
 * Call OpenAI‑compatible chat endpoint with `stream: true`
 * and yield incremental chunks as they arrive.
 *
 * NOTE: UI passes `apiKey` & endpoint via localStorage/env.
 */
export async function* streamChat(
  apiKey: string,
  messages: Message[],
  model = 'gpt-3.5-turbo',
  signal?: AbortSignal,
  baseUrl = 'https://api.openai.com/v1/chat/completions'
): AsyncGenerator<string> {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true
    }),
    signal
  });

  if (!res.ok || !res.body) {
    const txt = await res.text();
    throw new Error(`Chat API error ${res.status}: ${txt}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');

    // keep last partial line in buffer
    buffer = lines.pop() ?? '';

    for (const ln of lines) {
      const line = ln.trim();
      if (!line || !line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;

      try {
        const json = JSON.parse(payload);
        const delta: string | undefined =
          json.choices?.[0]?.delta?.content ?? undefined;
        if (delta) {
          yield delta;
        }
      } catch {
        // ignore malformed JSON (shouldn't happen)
      }
    }
  }
}
