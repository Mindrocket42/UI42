import type { AppSettings } from './settings';

export async function testProvider(s: AppSettings): Promise<{ok:boolean; ms?:number; err?:string}> {
  const p = s.providers[s.defaultProvider];
  if (!p.key) return { ok:false, err:'No key' };
  const t0 = performance.now();
  try {
    let url = '', headers: Record<string, string> = {}, body: any = {};
    switch (s.defaultProvider) {
      case 'openrouter':
        url = p.baseUrl || 'https://openrouter.ai/api/v1/chat/completions';
        headers = {
          'Authorization': `Bearer ${p.key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://your-site.example',
          'X-Title': 'My Chat App',
        };
        body = { model: s.model, messages: [{role:'user', content:'ping'}], stream: false };
        break;
      case 'openai':
        url = p.baseUrl || 'https://api.openai.com/v1/chat/completions';
        headers = {
          'Authorization': `Bearer ${p.key}`,
          'Content-Type': 'application/json',
        };
        body = { model: s.model, messages: [{role:'user', content:'ping'}], stream: false };
        break;
      case 'anthropic':
        url = p.baseUrl || 'https://api.anthropic.com/v1/messages';
        headers = {
          'x-api-key': p.key,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        };
        body = { model: s.model, max_tokens: 16, messages: [{role:'user', content:'ping'}], stream: false };
        break;
      case 'grok':
        url = p.baseUrl || 'https://api.groq.com/v1/chat';
        headers = {
          'Authorization': `Bearer ${p.key}`,
          'Content-Type': 'application/json',
        };
        body = { model: s.model, messages: [{role:'user', content:'ping'}], stream: false };
        break;
    }
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, err };
    }
    const ms = Math.round(performance.now() - t0);
    return { ok: true, ms };
  } catch (e: any) {
    return { ok: false, err: e?.message || 'Unknown error' };
  }
}

// Fetch available models for a provider
export async function fetchProviderModels(
  provider: 'openrouter' | 'openai' | 'anthropic' | 'grok',
  settings: { key: string; baseUrl?: string }
): Promise<string[]> {
  switch (provider) {
    case 'openrouter': {
      const url = (settings.baseUrl?.replace(/\/$/, '') || 'https://openrouter.ai/api/v1') + '/models';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${settings.key}` }
      });
      if (!res.ok) throw new Error('Failed to fetch OpenRouter models');
      const data = await res.json();
      // OpenRouter: { data: [{id: string, ...}, ...] }
      return Array.isArray(data.data) ? data.data.map((m: any) => m.id) : [];
    }
    case 'openai': {
      const url = (settings.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1') + '/models';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${settings.key}` }
      });
      if (!res.ok) throw new Error('Failed to fetch OpenAI models');
      const data = await res.json();
      // OpenAI: { data: [{id: string, ...}, ...] }
      return Array.isArray(data.data) ? data.data.map((m: any) => m.id) : [];
    }
    case 'anthropic': {
      // No public model listing endpoint; return known models
      return [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-2.1',
        'claude-2.0',
        'claude-instant-1.2'
      ];
    }
    case 'grok': {
      // No public model listing endpoint; return known models
      return [
        'gpt-3.5-turbo',
        'gpt-4',
        'mixtral-8x7b-32768',
        'llama-2-70b',
        'gemma-7b-it'
      ];
    }
    default:
      return [];
  }
}
