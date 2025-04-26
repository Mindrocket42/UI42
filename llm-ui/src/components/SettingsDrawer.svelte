<script lang="ts">
  import { settingsStore, type AppSettings } from '../lib/settings';
  import { get, writable, type Writable } from 'svelte/store';
  import { onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  // Use event dispatcher for two-way binding
  const dispatch = createEventDispatcher<{
    openChange: boolean;
  }>();
  
  export let open = false;
  const activeTab: Writable<'Keys' | 'Models' | 'Advanced'> = writable('Keys');
  let local: AppSettings = structuredClone(get(settingsStore));
  let testResult: { ok: boolean; ms?: number; err?: string } | null = null;
  let models: string[] = [];
  let loadingModels = false;
  let modelError: string | null = null;

  function updateOpen(value: boolean) {
    open = value;
    dispatch('openChange', value);
  }

  // Subscribe to settings changes
  const unsub = settingsStore.subscribe((v: AppSettings) => {
    if (!open) {
      // Only update local if drawer is closed to prevent overwriting user edits
      local = structuredClone(v);
    }
  });

  function save() {
    testResult = null;
    settingsStore.patch((s: AppSettings) => {
      // Deep copy to ensure all nested objects are updated
      Object.assign(s, structuredClone(local));
      return s;
    });
    test();
  }

  async function test() {
    testResult = null;
    try {
      const mod = await import('../lib/providerTest');
      testResult = await mod.testProvider(local);
    } catch (e) {
      testResult = { ok: false, err: 'Test failed' };
    }
  }

  async function fetchModels() {
    loadingModels = true;
    models = [];
    modelError = null;
    try {
      const mod = await import('../lib/providerTest');
      if (mod.fetchProviderModels) {
        models = await mod.fetchProviderModels(local?.defaultProvider, local?.providers[local?.defaultProvider ?? 'openrouter']);
        if (Array.isArray(models)) models = models.slice().sort((a, b) => a.localeCompare(b));
      }
    } catch (e) {
      modelError = 'Could not fetch models';
    } finally {
      loadingModels = false;
    }
  }

  $: if ($activeTab === 'Models') {
    fetchModels();
  }

  $: if (local?.defaultProvider) {
    fetchModels();
  }

  $: if (open) {
    // Refresh local settings from store when drawer is opened
    local = structuredClone(get(settingsStore));
  }

  onDestroy(unsub);
</script>

{#if open}
  <section class="drawer" role="dialog" aria-modal="true" tabindex="-1" on:keydown={(e) => { if (e.key === 'Escape') updateOpen(false); }}>
    <header>
      <nav>
        <button on:click={() => activeTab.set('Keys')} class:active={$activeTab === 'Keys'}>Keys</button>
        <button on:click={() => activeTab.set('Models')} class:active={$activeTab === 'Models'}>Models</button>
        <button on:click={() => activeTab.set('Advanced')} class:active={$activeTab === 'Advanced'}>Advanced</button>
      </nav>
    </header>
    <form on:submit|preventDefault={save}>
      {#if $activeTab === 'Keys'}
        <label for="openrouter-key">OpenRouter API Key</label>
        <input id="openrouter-key" name="openrouter-key" type="password" bind:value={local.providers.openrouter.key} />
        <label for="openai-key">OpenAI API Key</label>
        <input id="openai-key" name="openai-key" type="password" bind:value={local.providers.openai.key} />
        <label for="anthropic-key">Anthropic API Key</label>
        <input id="anthropic-key" name="anthropic-key" type="password" bind:value={local.providers.anthropic.key} />
        <label for="grok-key">Grok API Key</label>
        <input id="grok-key" name="grok-key" type="password" bind:value={local.providers.grok.key} />
      {/if}
      {#if $activeTab === 'Models'}
        <fieldset class="provider-radio-group">
          <legend>Default Provider</legend>
          <label for="provider-openrouter"><input id="provider-openrouter" name="provider" type="radio" bind:group={local.defaultProvider} value="openrouter" />OpenRouter</label>
          <label for="provider-openai"><input id="provider-openai" name="provider" type="radio" bind:group={local.defaultProvider} value="openai" />OpenAI</label>
          <label for="provider-anthropic"><input id="provider-anthropic" name="provider" type="radio" bind:group={local.defaultProvider} value="anthropic" />Anthropic</label>
          <label for="provider-grok"><input id="provider-grok" name="provider" type="radio" bind:group={local.defaultProvider} value="grok" />Grok</label>
        </fieldset>
        {#if loadingModels}
          <div class="model-loading">Loading models…</div>
        {:else if models.length > 0}
          <label for="model-select">Model</label>
          <select id="model-select" name="model-select" bind:value={local.model}>
            {#each models as m}
              <option value={m}>{m}</option>
            {/each}
          </select>
        {:else}
          <label for="model-input">Model</label>
          <input id="model-input" name="model-input" type="text" bind:value={local.model} placeholder="Enter model name" />
        {/if}
        {#if modelError}
          <div class="error">{modelError}</div>
        {/if}
        <label for="temperature">Temperature</label>
        <input id="temperature" name="temperature" type="range" min="0" max="2" step="0.01" bind:value={local.temperature} />
        <span>{local.temperature}</span>
        <label for="timeout">Timeout (ms)</label>
        <input id="timeout" name="timeout" type="number" min="1000" max="120000" step="1000" bind:value={local.timeout} />
      {/if}
      {#if $activeTab === 'Advanced'}
        <label for="openrouter-baseurl">OpenRouter Base URL</label>
        <input id="openrouter-baseurl" name="openrouter-baseurl" type="text" bind:value={local.providers.openrouter.baseUrl} />
        <label for="openai-baseurl">OpenAI Base URL</label>
        <input id="openai-baseurl" name="openai-baseurl" type="text" bind:value={local.providers.openai.baseUrl} />
        <label for="anthropic-baseurl">Anthropic Base URL</label>
        <input id="anthropic-baseurl" name="anthropic-baseurl" type="text" bind:value={local.providers.anthropic.baseUrl} />
        <label for="grok-baseurl">Grok Base URL</label>
        <input id="grok-baseurl" name="grok-baseurl" type="text" bind:value={local.providers.grok.baseUrl} />
      {/if}
      <div class="actions">
        <button type="submit" class="save-test-btn">Save &amp; Test</button>
        {#if testResult}
          {#if testResult.ok}
            <span class="latency-chip green">{testResult.ms} ms</span>
          {:else}
            <span class="error">{testResult.err}</span>
          {/if}
        {/if}
      </div>
    </form>
  </section>
{/if}

<style>
.drawer {
  position: fixed; right: 0; top: 0; height: 100vh; width: min(400px, 100vw);
  background: var(--bg-1, #fff); color: var(--text-1, #222);
  box-shadow: -2px 0 16px rgba(0,0,0,0.15);
  display: flex; flex-direction: column; z-index: 1000;
}
header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; }
nav button { margin-right: 1rem; background: none; border: none; font-weight: bold; cursor: pointer; }
nav button.active { text-decoration: underline; }
form { flex: 1; display: flex; flex-direction: column; gap: 1rem; padding: 1rem; }
label { display: flex; flex-direction: column; gap: 0.25rem; }
.actions { margin-top: auto; display: flex; align-items: center; gap: 1rem; justify-content: flex-end; }
.save-test-btn { background: #007aff; color: #fff; border: none; border-radius: 4px; padding: 0.5rem 1rem; font-weight: bold; cursor: pointer; }
.latency-chip.green { background: #c6f6d5; color: #22543d; padding: 0.25rem 0.75rem; border-radius: 999px; }
.error { color: #e53e3e; font-weight: bold; }
.provider-radio-group {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}
.provider-radio-group label {
  display: flex; align-items: center; gap: 0.25rem;
  font-weight: normal;
}
.model-loading {
  color: #888;
  margin-bottom: 0.5rem;
}
@media (max-width: 600px) {
  .drawer { width: 100vw; }
}
</style>
