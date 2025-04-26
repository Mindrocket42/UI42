<!-- llm-ui/src/components/ConversationList.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import {
    db,
    type Conversation,
    branchConversation as dbBranchConversation,
    createConversation as dbCreateConversation, // Import create func
    deleteConversation as dbDeleteConversation  // Import delete func
  } from '../lib/db';
  import { createEventDispatcher } from 'svelte'; // Import event dispatcher
  import { writable } from 'svelte/store'; // Import writable
  import ExportButton from './ExportButton.svelte'; // Import the new component

  // --- Props ---
  export let currentSelectedId: string | null = null; // Accept selected ID from parent

  // --- State ---
  // Store for the list of conversations
  const conversations = writable<Conversation[]>([]);
  // Remove internal store: const selectedConversationId = writable<string | null>(null);

  const dispatch = createEventDispatcher<{ selectconversation: { id: string | null } }>(); // Allow null ID dispatch

  onMount(async () => {
    // Load conversations from Dexie when the component mounts
    await loadConversations();
    // TODO: Use liveQuery for real-time updates
  });

  async function loadConversations() {
    try {
      const convos = await db.conversations.orderBy('updatedAt').reverse().toArray();
      conversations.set(convos);
      // Select the first conversation by default if none is selected by the parent
      if (currentSelectedId === null && convos.length > 0 && convos[0].id) {
        // Don't set internal state, dispatch event to parent
        dispatch('selectconversation', { id: convos[0].id });
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
      // Optionally set an error state for the UI
    }
  }

  async function createNewConversation() {
    console.log('Creating new conversation...');
    try {
      const newId = await dbCreateConversation(); // Call the actual DB function
      // Dispatch event to select the new conversation in the parent
      dispatch('selectconversation', { id: newId });
      await loadConversations(); // Reload list to show the new conversation
    } catch (error) {
      console.error("Failed to create conversation:", error);
      // TODO: Show user-facing error message
    }
  }

  async function deleteConversation(id: string) {
    if (confirm('Are you sure you want to delete this conversation?')) {
      console.log(`Deleting conversation ${id}...`);
      try {
        const currentList = $conversations; // Get current list before delete
        await dbDeleteConversation(id); // Call the actual DB function

        // If the deleted one was selected, tell the parent to select null or the next one
        if (currentSelectedId === id) {
           let nextId: string | null = null;
           // Add type Conversation to 'c'
           const remainingConvos = currentList.filter((c: Conversation) => c.id !== id);
           if (remainingConvos.length > 0) {
               // Try selecting the first remaining conversation
               nextId = remainingConvos[0].id;
           }
           dispatch('selectconversation', { id: nextId }); // Dispatch null or the next ID
        }
        await loadConversations(); // Reload list (will reflect deletion)
      } catch (error) {
        console.error("Failed to delete conversation:", error);
        // TODO: Show user-facing error message
      }
      await loadConversations(); // Reload list
    }
  }

  async function branchConversation(id: string) {
    console.log(`Branching conversation ${id}...`);
    // TODO: Add ability to pass specific message ID for branching point (F4.5)
    try {
      const newId = await dbBranchConversation(id); // Call the actual DB function
      // Dispatch event to select the new branch in the parent
      dispatch('selectconversation', { id: newId });
      await loadConversations(); // Reload list to show the new branch
    } catch (error) {
      console.error("Failed to branch conversation:", error);
      // TODO: Show user-facing error message
    }
  }

  function selectConversation(id: string) {
    // Don't set internal state, dispatch event to parent
    dispatch('selectconversation', { id });
    console.log(`Selected conversation ${id} (dispatched)`);
  }

</script>

<div class="sidebar">
  <h2>Conversations</h2>
  <button on:click={createNewConversation} class="new-convo-btn">
    + New Conversation
  </button>
  <ul class="conversation-list">
    {#each $conversations as convo (convo.id)}
      <li
        class:selected={currentSelectedId === convo.id}
      >
        <!-- Make the title the interactive element for selection -->
        <button type="button" class="convo-select-btn" on:click={() => selectConversation(convo.id)}>
            <span class="convo-title">{convo.title || `Conversation ${convo.id}`}</span>
        </button>
        <div class="convo-actions">
          <!-- Actions -->
          <button title="Branch" on:click|stopPropagation={() => branchConversation(convo.id)}>Branch</button>
          <!-- ExportButton is a component, stopPropagation cannot be applied directly here.
               Clicking Export *will* also trigger selectConversation. This might be acceptable. -->
          <ExportButton conversationId={convo.id} />
          <button title="Delete" on:click|stopPropagation={() => deleteConversation(convo.id)}>&times;</button>
        </div>
      </li>
    {:else}
      <li>No conversations yet.</li>
    {/each}
  </ul>
</div>

<style>
  .sidebar {
    width: 250px;
    height: 100vh;
    background-color: #f4f4f4;
    padding: 15px;
    border-right: 1px solid #ddd;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  h2 {
    margin-top: 0;
    margin-bottom: 15px;
    font-size: 1.2em;
    color: #333;
  }

  .new-convo-btn {
    width: 100%;
    padding: 10px;
    margin-bottom: 15px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
  }
  .new-convo-btn:hover {
    background-color: #0056b3;
  }

  .conversation-list {
    list-style: none;
    padding: 0;
    margin: 0;
    flex-grow: 1;
    overflow-y: auto; /* Allow list itself to scroll if needed */
  }

  .conversation-list li {
    padding: 10px 8px;
    margin-bottom: 5px;
    border-radius: 4px;
    /* cursor: pointer; */ /* Removed as li is no longer the main interactive element */
    border: 1px solid transparent;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9em;
  }

  .conversation-list li:hover {
    background-color: #e9e9e9;
  }

  .conversation-list li.selected {
    background-color: #d1e7fd;
    border-color: #007bff;
    font-weight: bold;
  }

  .convo-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-grow: 1;
    margin-right: 10px; /* Keep margin on the inner span */
  }

  .convo-select-btn {
    /* Reset button styles to look like text */
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    /* Ensure it takes up space */
    flex-grow: 1;
    overflow: hidden; /* Needed for ellipsis on the button */
    display: block; /* Or inline-block, depending on desired layout */
    width: 100%; /* Try to fill width */
  }

  .convo-select-btn:hover,
  .convo-select-btn:focus {
     /* Add subtle hover/focus for accessibility */
    text-decoration: underline;
    outline: none; /* Or a custom focus style */
  }


  .convo-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0; /* Prevent actions from shrinking */
  }

  /* Style action buttons directly */
  .convo-actions button,
  .convo-actions > :global(button) /* Target ExportButton */ {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    font-size: 0.8em;
    color: #555;
    border-radius: 3px;
  }
   .convo-actions button:hover,
   .convo-actions > :global(button):hover {
     background-color: #ddd;
     color: #000;
   }

</style>