<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { Prompt } from '../lib/db'; // Use relative path
  import { listPrompts, addPrompt, updatePrompt, deletePrompt } from '../lib/db'; // Use relative path

  let prompts: Prompt[] = [];
  let newPromptName = '';
  let newPromptContent = '';
  let editingPromptId: number | null = null;
  let editingName = '';
  let editingContent = '';
  let isLoading = true;
  let error = '';

  const dispatch = createEventDispatcher();

  async function loadPrompts() {
    isLoading = true;
    error = '';
    try {
      prompts = await listPrompts();
    } catch (err) {
      console.error('Error loading prompts:', err);
      error = 'Failed to load prompts.';
    } finally {
      isLoading = false;
    }
  }

  async function handleAddPrompt() {
    if (!newPromptName.trim() || !newPromptContent.trim()) {
      error = 'Prompt name and content cannot be empty.';
      return;
    }
    error = '';
    try {
      await addPrompt(newPromptName.trim(), newPromptContent.trim());
      newPromptName = '';
      newPromptContent = '';
      await loadPrompts(); // Refresh list
    } catch (err) {
      console.error('Error adding prompt:', err);
      error = 'Failed to add prompt.';
    }
  }

  function startEditing(prompt: Prompt) {
    // Ensure id exists before assigning (though it should from DB)
    if (prompt.id !== undefined) {
        editingPromptId = prompt.id;
        editingName = prompt.name;
        editingContent = prompt.content;
    } else {
        console.error("Attempted to edit prompt without an ID:", prompt);
        error = "Cannot edit prompt: missing ID.";
    }
  }

  async function handleUpdatePrompt() {
    if (editingPromptId === null || !editingName.trim() || !editingContent.trim()) {
      error = 'Prompt name and content cannot be empty during edit.';
      return;
    }
    error = '';
    try {
      await updatePrompt(editingPromptId, { name: editingName.trim(), content: editingContent.trim() });
      cancelEditing();
      await loadPrompts(); // Refresh list
    } catch (err) {
      console.error('Error updating prompt:', err);
      error = 'Failed to update prompt.';
    }
  }

  function cancelEditing() {
    editingPromptId = null;
    editingName = '';
    editingContent = '';
  }

  async function handleDeletePrompt(id: number | undefined) {
    // Add check for undefined id, although button click should only pass valid ones
    if (id === undefined) {
        console.error("Attempted to delete prompt without an ID.");
        error = "Cannot delete prompt: missing ID.";
        return;
    }
    if (!confirm('Are you sure you want to delete this prompt?')) return;
    error = '';
    try {
      await deletePrompt(id);
      await loadPrompts(); // Refresh list
    } catch (err) {
      console.error('Error deleting prompt:', err);
      error = 'Failed to delete prompt.';
    }
  }

  function insertPrompt(content: string) {
    dispatch('insertprompt', { content });
    // Optionally close the library/drawer after insert
  }

  onMount(loadPrompts);
</script>

<div class="prompt-library">
  <h3>Prompt Library</h3>

  {#if isLoading}
    <p>Loading prompts...</p>
  {:else if error}
    <p class="error">{error}</p>
  {/if}

  <div class="prompt-list">
    {#each prompts as prompt (prompt.id)}
      <div class="prompt-item">
        {#if editingPromptId === prompt.id}
          <input type="text" bind:value={editingName} placeholder="Prompt Name" />
          <textarea bind:value={editingContent} placeholder="Prompt Content" rows="3"></textarea>
          <div class="actions">
            <button on:click={handleUpdatePrompt}>Save</button>
            <button on:click={cancelEditing}>Cancel</button>
          </div>
        {:else}
          <strong>{prompt.name}</strong>
          <p class="prompt-content">{prompt.content}</p>
          <div class="actions">
            <button on:click={() => insertPrompt(prompt.content)} title="Insert into chat">Insert</button>
            <button on:click={() => startEditing(prompt)}>Edit</button>
            <button on:click={() => handleDeletePrompt(prompt.id!)} class="delete">Delete</button>
          </div>
        {/if}
      </div>
    {:else}
      {#if !isLoading}
        <p>No prompts saved yet.</p>
      {/if}
    {/each}
  </div>

  <div class="add-prompt-form">
    <h4>Add New Prompt</h4>
    <input type="text" bind:value={newPromptName} placeholder="Prompt Name" />
    <textarea bind:value={newPromptContent} placeholder="Prompt Content" rows="4"></textarea>
    <button on:click={handleAddPrompt} disabled={!newPromptName.trim() || !newPromptContent.trim()}>Add Prompt</button>
  </div>
</div>

<style>
  .prompt-library {
    padding: 1rem;
    border-left: 1px solid #ccc;
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .prompt-list {
    flex-grow: 1;
    overflow-y: auto; /* Allow list itself to scroll if needed */
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .prompt-item {
    border: 1px solid #eee;
    padding: 0.75rem;
    border-radius: 4px;
    background-color: #f9f9f9;
  }
  .prompt-item strong {
    display: block;
    margin-bottom: 0.25rem;
  }
  .prompt-content {
    white-space: pre-wrap; /* Preserve whitespace and wrap */
    font-size: 0.9em;
    color: #555;
    margin-bottom: 0.5rem;
    max-height: 100px; /* Limit initial display height */
    overflow-y: auto; /* Allow scrolling for long prompts */
  }
  .prompt-item input,
  .prompt-item textarea,
  .add-prompt-form input,
  .add-prompt-form textarea {
    width: 100%;
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 3px;
    box-sizing: border-box; /* Include padding in width */
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .actions button {
    padding: 0.3rem 0.6rem;
    font-size: 0.9em;
    cursor: pointer;
    border: 1px solid #ccc;
    border-radius: 3px;
    background-color: #eee;
  }
  .actions button:hover {
    background-color: #ddd;
  }
  .actions button.delete {
    border-color: #f88;
    color: #c00;
    background-color: #fee;
  }
   .actions button.delete:hover {
    background-color: #fdd;
  }
  .add-prompt-form {
    border-top: 1px solid #ccc;
    padding-top: 1rem;
  }
  .add-prompt-form h4 {
    margin-top: 0;
    margin-bottom: 0.5rem;
  }
  .error {
    color: red;
    font-size: 0.9em;
  }
</style>