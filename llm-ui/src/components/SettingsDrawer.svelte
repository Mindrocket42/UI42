<script lang="ts">
  import { settingsStore, type AppSettings } from '$lib/settings';
  import { onMount, onDestroy } from 'svelte';
  export let open = false;
  let local: AppSettings;
  let activeTab: 'Keys' | 'Models' | 'Advanced' = 'Keys';
  let testResult: { ok: boolean; ms?: number; err?: string } | null = null;
  let models: string[] = [];
  let loadingModels = false;
  let modelError: string | null = null;

  const unsub = settingsStore.subscribe(v => local = structuredClone(v));
  function save() {
    settingsStore.patch(s => Object.assign(s, local));
    test();
  }
  async function test() {
    testResult = null;
    try {
      const mod = await import('$lib/providerTest');
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
      const mod = await import('$lib/providerTest');
      if (mod.fetchProviderModels) {
        models = await mod.fetchProviderModels(local.defaultProvider, local.providers[local.defaultProvider]);
        if (Array.isArray(models)) models = models.slice().sort((a, b) => a.localeCompare(b));
      }
    } catch (e) {
      modelError = 'Could not fetch models';
    } finally {
      loadingModels = false;
    }
  }

  $: if (activeTab === 'Models') {
    fetchModels();
  }

  $: if (local && local.defaultProvider) {
    fetchModels();
  }
  onDestroy(unsub);
</script>

<button class="icon-btn settings-btn" on:click={() => open = true} title="Settings">
  <svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v4l3 3" stroke="currentColor" stroke-width="2" fill="none"/></svg>
</button>

{#if open}
  <aside class="drawer">
    <header>
      <nav>
        <button on:click={() => activeTab = 'Keys'} class:active={activeTab === 'Keys'}>Keys</button>
        <button on:click={() => activeTab = 'Models'} class:active={activeTab === 'Models'}>Models</button>
        <button on:click={() => activeTab = 'Advanced'} class:active={activeTab === 'Advanced'}>Advanced</button>
      </nav>
    </header>
    <form on:submit|preventDefault={save}>
      {#if activeTab === 'Keys'}
        <label>OpenRouter API Key <input type="password" bind:value={local.providers.openrouter.key}/></label>
        <label>OpenAI API Key <input type="password" bind:value={local.providers.openai.key}/></label>
        <label>Anthropic API Key <input type="password" bind:value={local.providers.anthropic.key}/></label>
        <label>Grok API Key <input type="password" bind:value={local.providers.grok.key}/></label>
      {/if}
      {#if activeTab === 'Models'}
        <fieldset class="provider-radio-group">
          <legend>Default Provider</legend>
          <label><input type="radio" bind:group={local.defaultProvider} value="openrouter" />OpenRouter</label>
          <label><input type="radio" bind:group={local.defaultProvider} value="openai" />OpenAI</label>
          <label><input type="radio" bind:group={local.defaultProvider} value="anthropic" />Anthropic</label>
          <label><input type="radio" bind:group={local.defaultProvider} value="grok" />Grok</label>
        </fieldset>
        {#if loadingModels}
          <div class="model-loading">Loading models…</div>
        {:else if models.length > 0}
          <label>Model
            <select bind:value={local.model}>
              {#each models as m}
                <option value={m}>{m}</option>
              {/each}
            </select>
          </label>
        {:else}
          <label>Model <input type="text" bind:value={local.model} placeholder="Enter model name" /></label>
        {/if}
        {#if modelError}
          <div class="error">{modelError}</div>
        {/if}
        <label>Temperature <input type="range" min="0" max="2" step="0.01" bind:value={local.temperature}/><span>{local.temperature}</span></label>
        <label>Timeout (ms) <input type="number" min="1000" max="120000" step="1000" bind:value={local.timeout}/></label>
      {/if}
      {#if activeTab === 'Advanced'}
        <label>OpenRouter Base URL <input type="text" bind:value={local.providers.openrouter.baseUrl}/></label>
        <label>OpenAI Base URL <input type="text" bind:value={local.providers.openai.baseUrl}/></label>
        <label>Anthropic Base URL <input type="text" bind:value={local.providers.anthropic.baseUrl}/></label>
        <label>Grok Base URL <input type="text" bind:value={local.providers.grok.baseUrl}/></label>
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
  </aside>
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
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: normal;
}
.model-loading {
  color: #888;
  margin-bottom: 0.5rem;
}
.settings-btn {
  display: block;
  margin: 18px auto 0 auto;
  width: 42px;
  height: 42px;
  padding: 0;
  border-radius: 8px;
  background: none;
  border: none;
  box-shadow: none;
}
.settings-btn svg {
  width: 28px;
  height: 28px;
  display: block;
  margin: auto;
}
@media (max-width: 600px) {
  .drawer { width: 100vw; }
}
</style>
