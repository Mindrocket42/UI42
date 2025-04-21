import { writable } from 'svelte/store';

export type Provider = 'openrouter' | 'openai' | 'anthropic' | 'grok';
export interface ProviderSettings { key: string; baseUrl?: string }
export interface AppSettings {
  defaultProvider: Provider;
  model: string;
  temperature: number;
  timeout: number;
  providers: Record<Provider, ProviderSettings>;
}

const DEFAULT: AppSettings = {
  defaultProvider: 'openrouter',
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  timeout: 30000,
  providers: {
    openrouter:  { key: '', baseUrl: 'https://openrouter.ai/api/v1' },
    openai:      { key: '', baseUrl: 'https://api.openai.com/v1' },
    anthropic:   { key: '', baseUrl: 'https://api.anthropic.com' },
    grok:        { key: '', baseUrl: 'https://api.groq.com' }
  }
};

function persist(s: AppSettings) {
  localStorage.setItem('llm-settings', JSON.stringify(s));
}

function load(): AppSettings {
  const raw = localStorage.getItem('llm-settings');
  return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
}

function createStore() {
  const { subscribe, set, update } = writable<AppSettings>(load());
  return {
    subscribe,
    patch: (fn: (s: AppSettings) => void) => update(s => { fn(s); persist(s); return s; }),
    reset: () => { persist(DEFAULT); set(DEFAULT); }
  };
}

export const settingsStore = createStore();
