<script lang="ts">
  import { onMount } from 'svelte';
  import ChatWindow from './components/ChatWindow.svelte';
  import ConversationList from './components/ConversationList.svelte';
  import PromptLibrary from './components/PromptLibrary.svelte';
  import TaskPanel from './components/TaskPanel.svelte'; // Import TaskPanel
  import { getOrCreateConversation, type Conversation } from '$lib/db'; // Import db helpers
  import SettingsDrawer from './components/SettingsDrawer.svelte';

  let promptToInsert: string | null = null;
  let selectedConversationId: string | null = null; // State for selected conversation
  let settingsOpen = false;
  let menuOpen = false;
  let promptLibraryOpen = false;
  let taskPanelOpen = false;

  // Fetch initial/last conversation on mount
  onMount(async () => {
    const initialConvo = await getOrCreateConversation();
    selectedConversationId = initialConvo.id;
    console.log("App selected initial conversation:", selectedConversationId);
  });

  function handleInsertPrompt(event: CustomEvent<{ content: string }>) {
    console.log("Prompt insert requested:", event.detail.content);
    promptToInsert = event.detail.content;
    setTimeout(() => {
      promptToInsert = null;
    }, 50);
  }

  // Handler for when conversation list selects a new conversation
  // Note: ConversationList needs to be updated to dispatch this event
  // and potentially accept selectedId via bind:
  function handleSelectConversation(event: CustomEvent<{ id: string }>) {
    selectedConversationId = event.detail.id;
    console.log("App selected conversation:", selectedConversationId);
    // Potentially stop the agent if the conversation changes? Or let TaskPanel handle it?
    // For now, TaskPanel will use the ID passed via prop.
  }

</script>

<main class="app-layout">
  <!-- Hamburger menu -->
  <button class="hamburger" on:click={() => menuOpen = !menuOpen} aria-label="Open menu">
    <span></span><span></span><span></span>
  </button>
  {#if menuOpen}
    <nav class="app-menu">
      <button on:click={() => { settingsOpen = true; menuOpen = false; }}>Settings</button>
      <button on:click={() => { promptLibraryOpen = true; menuOpen = false; }}>Prompt Library</button>
      <button on:click={() => { taskPanelOpen = true; menuOpen = false; }}>Task Queue</button>
    </nav>
  {/if}

  <!-- Main chat and conversations -->
  <aside class="sidebar conversations">
    <ConversationList currentSelectedId={selectedConversationId} on:selectconversation={handleSelectConversation} />
  </aside>
  <section class="main-chat">
    <ChatWindow bind:insertContent={promptToInsert} conversationId={selectedConversationId} />
  </section>

  <!-- Drawers/Modals -->
  <SettingsDrawer bind:open={settingsOpen} />
  {#if settingsOpen}
    <div class="drawer-overlay" on:click={() => settingsOpen = false}></div>
  {/if}
  {#if promptLibraryOpen}
    <div class="drawer-overlay" on:click={() => promptLibraryOpen = false}></div>
    <aside class="drawer popout"><PromptLibrary on:insertprompt={handleInsertPrompt} /></aside>
  {/if}
  {#if taskPanelOpen}
    <div class="drawer-overlay" on:click={() => taskPanelOpen = false}></div>
    <aside class="drawer popout"><TaskPanel conversationId={selectedConversationId} /></aside>
  {/if}
</main>

<style>
  .app-layout {
    display: flex;
    height: 100vh; /* Full viewport height */
    width: 100vw; /* Full viewport width */
    overflow: hidden; /* Prevent scrollbars on the main layout */
  }

  .sidebar {
    flex-shrink: 0; /* Prevent sidebars from shrinking */
    height: 100%; /* Take full height */
    overflow-y: auto; /* Allow scrolling within sidebars */
    border-right: 1px solid #ccc; /* Separator */
    background-color: #f9f9f9; /* Consistent background */
  }

  .sidebar.conversations {
    width: 250px; /* Adjust width as needed */
  }

  .main-chat {
    flex-grow: 1; /* Chat window takes remaining space */
    height: 100%;
    display: flex; /* Allow ChatWindow to potentially flex internally */
    flex-direction: column; /* Stack elements vertically */
    overflow: hidden; /* Prevent chat area itself from scrolling; internal elements should scroll */
    background-color: #fff; /* White background for chat */
  }

  /* Ensure child components fill the main-chat area */
  :global(.main-chat > *) {
     flex-grow: 1;
     height: 100%; /* Might need adjustment based on ChatWindow structure */
     overflow: hidden; /* Let ChatWindow handle its own scrolling */
  }

  .hamburger {
    position: absolute;
    top: 18px;
    right: 24px;
    left: unset;
    z-index: 1200;
    width: 42px;
    height: 42px;
    background: none;
    border: none;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
  }
  .hamburger span {
    display: block;
    height: 4px;
    width: 28px;
    background: #444;
    border-radius: 2px;
    transition: all 0.2s;
  }
  .app-menu {
    position: absolute;
    top: 60px;
    right: 24px;
    left: unset;
    background: var(--bg-2, #fff);
    border: 1px solid #ccc;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    z-index: 1250;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    min-width: 180px;
  }
  .app-menu button {
    background: none;
    border: none;
    text-align: left;
    padding: 0.5rem 0.75rem;
    font-size: 1rem;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.15s;
  }
  .app-menu button:hover {
    background: #eee;
  }
  .drawer-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.15);
    z-index: 1100;
  }
  .drawer.popout {
    position: fixed;
    top: 0; right: 0;
    width: min(400px, 100vw);
    height: 100vh;
    background: var(--bg-1, #fff);
    box-shadow: -2px 0 16px rgba(0,0,0,0.15);
    z-index: 1201;
    display: flex;
    flex-direction: column;
    animation: slideInDrawer 0.2s ease;
  }
  @keyframes slideInDrawer {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  /* Hide old settings-fab and sidebar prompts/tasks */
  .settings-fab, .sidebar.prompts, .sidebar.tasks { display: none !important; }
</style>
