<script lang="ts">
  import { settingsStore, type AppSettings } from '../lib/settings';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';

  let settings: AppSettings = get(settingsStore);
  let loadingModels = false;
  let modelError: string | null = null;
  let models: string[] = [];

  // Subscribe to settings changes
  const unsub = settingsStore.subscribe((v: AppSettings) => {
    settings = v;
  });

  // Fetch models for selected provider
  async function fetchModels() {
    loadingModels = true;
    modelError = null;
    try {
      const mod = await import('../lib/providerTest');
      if (mod.fetchProviderModels) {
        models = await mod.fetchProviderModels(settings.defaultProvider, settings.providers[settings.defaultProvider]);
        if (Array.isArray(models)) models = models.slice().sort((a, b) => a.localeCompare(b));
      }
    } catch (e) {
      modelError = 'Could not fetch models';
      models = [];
    } finally {
      loadingModels = false;
    }
  }

  // Watch provider change
  $: if (settings.defaultProvider) {
    fetchModels();
  }

  function setProvider(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    if (target) settingsStore.patch((s: AppSettings) => { s.defaultProvider = target.value as any; });
  }
  function setTemperature(event: Event) {
    const target = event.target as HTMLInputElement | null;
    if (target) settingsStore.patch((s: AppSettings) => { s.temperature = +target.value; });
  }
  function setModel(event: Event) {
    const target = event.target as HTMLSelectElement | HTMLInputElement | null;
    if (target) settingsStore.patch((s: AppSettings) => { s.model = target.value; });
  }

  // Advanced modal state
  let showAdvanced = false;
  function openAdvanced() { showAdvanced = true; }
  function closeAdvanced() { showAdvanced = false; }

  onMount(() => {
    fetchModels();
  });
</script>

<style>
.top-settings-bar {
  display: grid;
  grid-template-columns: 1fr 2fr 2fr 1fr;
  align-items: center;
  background: var(--bg-2, #f5f5f5);
  padding: 0.25rem 1.25rem 0.15rem 1.25rem;
  border-bottom: 2px solid #222;
  min-height: 38px;
  max-height: 44px;
  z-index: 1400;
  font-size: 0.98rem;
  width: 100%;
  box-sizing: border-box;
  gap: 0.5rem;
}
.topbar-cell {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 100%;
  padding: 0 0.3rem;
}
.topbar-provider { background: #cce3ff; }
.topbar-model { background: #ffa500; }
.topbar-temp { background: #7fff7f; }
.topbar-advanced { background: #ffe066; justify-content: flex-end; }

.top-settings-bar label {
  font-weight: 500;
  margin-right: 0.15rem;
  white-space: nowrap;
}
.top-settings-bar select,
.top-settings-bar input[type="number"] {
  font-size: 0.98rem;
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #ccc;
  height: 2rem;
}
.advanced-btn {
  background: #eee;
  border: none;
  border-radius: 4px;
  padding: 0.3rem 0.8rem;
  font-weight: bold;
  cursor: pointer;
  height: 2rem;
  font-size: 0.98rem;
  margin-left: auto;
}
.advanced-btn:hover {
  background: #ddd;
}
@media (max-width: 900px) {
  .top-settings-bar {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
  }
  .topbar-cell {
    min-width: 0;
    width: 100%;
  }
}
</style>

<div class="top-settings-bar">
  <div class="topbar-cell topbar-provider">
    <label for="provider-select">Provider</label>
    <select id="provider-select" name="provider-select" bind:value={settings.defaultProvider} on:change={setProvider}>
      {#each Object.keys(settings.providers) as provider}
        <option value={provider}>{provider}</option>
      {/each}
    </select>
  </div>
  <div class="topbar-cell topbar-model">
    {#if loadingModels}
      <label>Model</label>
      <div style="min-width:120px;flex:1;">
        <span>Loading…</span>
      </div>
    {:else if models.length > 0}
      <label for="model-select">Model</label>
      <div style="min-width:120px;flex:1;">
        <select id="model-select" name="model-select" bind:value={settings.model} on:change={setModel}>
          {#each models as m}
            <option value={m}>{m}</option>
          {/each}
        </select>
      </div>
    {:else}
      <label for="model-text">Model</label>
      <div style="min-width:120px;flex:1;">
        <input id="model-text" name="model-text" type="text" bind:value={settings.model} on:input={setModel} placeholder="Enter model name" />
      </div>
    {/if}
    {#if modelError}
      <span class="error">{modelError}</span>
    {/if}
  </div>
  <div class="topbar-cell topbar-temp">
    <label for="temperature-input">Temperature</label>
    <input id="temperature-input" name="temperature-input" type="number" min="0" max="2" step="0.01" bind:value={settings.temperature} on:change={setTemperature} style="width: 70px; margin-right: 10px;" />
    <input id="temperature-slider" name="temperature-slider" type="range" min="0" max="2" step="0.01" bind:value={settings.temperature} on:change={setTemperature} style="width: 120px; vertical-align: middle;" />
  </div>
  <div class="topbar-cell topbar-advanced">
    <button class="advanced-btn" type="button" on:click={openAdvanced}>Advanced</button>
  </div>
</div>

{#if showAdvanced}
  <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);z-index:2000;display:flex;align-items:center;justify-content:center;">
    <div style="background:#fff;padding:2rem 2.5rem;border-radius:10px;min-width:340px;box-shadow:0 2px 18px #0002;max-width:96vw;overflow:auto;">
      <h3>Advanced Settings</h3>
      <form on:submit|preventDefault={() => { showAdvanced = false; }} style="display: flex; flex-direction: column; gap: 1rem;">
        <h4>API Keys</h4>
        {#each Object.keys(settings.providers) as provider}
          <label for={provider + '-key'}>{provider} API Key</label>
          <input id={provider + '-key'} type="password" bind:value={settings.providers[provider].key} on:input={() => settingsStore.patch(s => s.providers[provider].key = settings.providers[provider].key)} />
        {/each}
        <h4>Endpoints</h4>
        {#each Object.keys(settings.providers) as provider}
          <label for={provider + '-baseurl'}>{provider} Endpoint</label>
          <input id={provider + '-baseurl'} type="text" bind:value={settings.providers[provider].baseUrl} on:input={() => settingsStore.patch(s => s.providers[provider].baseUrl = settings.providers[provider].baseUrl)} />
        {/each}
        <button type="submit" style="margin-top:1.5rem;">Close</button>
      </form>
    </div>
  </div>
{/if}
