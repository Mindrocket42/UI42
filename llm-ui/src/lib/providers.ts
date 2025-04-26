import type { AppSettings } from './settings';
import type { Message } from './db';

// Import provider-specific streaming functions (to be implemented or adapted)
// These should match the provider API streaming protocol
// For now, let's assume streamOpenAI is compatible with OpenRouter/OpenAI,
// and streamAnthropic and streamGrok are implemented similarly
import { streamChat as streamOpenAI } from './chatApi';
import { streamAnthropic } from './anthropicApi';
import { streamGrok } from './grokApi';

const DEFAULT_BASE = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  grok: 'https://api.groq.com/v1'
};

export async function* streamChat(
  settings: AppSettings,
  messages: { role: string; content: string }[],
  signal?: AbortSignal
): AsyncGenerator<string> {
  const p = settings.providers[settings.defaultProvider];
  const base = p.baseUrl || DEFAULT_BASE[settings.defaultProvider];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${p.key}`
  };

  switch (settings.defaultProvider) {
    case 'openrouter': {
      headers['HTTP-Referer'] = 'https://github.com/Mindrocket42/UI42';
      headers['X-Title'] = 'UI42';
      const res = await fetch(base + '/chat/completions', {
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
        throw new Error('OpenRouter error: ' + txt);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
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
            const delta = json.choices?.[0]?.delta?.content ?? undefined;
            if (delta) yield delta;
          } catch {}
        }
      }
      break;
    }
    case 'openai':
      // Use OpenAI-compatible streaming
      yield* streamOpenAI(
        p.key,
        messages,
        settings.model,
        signal,
        base + '/chat/completions'
      );
      break;
    case 'anthropic':
      headers['anthropic-version'] = '2023-06-01';
      yield* streamAnthropic(
        base + '/messages',
        headers,
        settings,
        messages,
        signal
      );
      break;
    case 'grok':
      yield* streamGrok(
        base + '/chat',
        headers,
        settings,
        messages,
        signal
      );
      break;
    default:
      throw new Error('Unknown provider');
  }
}
