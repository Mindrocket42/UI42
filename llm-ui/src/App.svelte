<script lang="ts">
  import { onMount } from 'svelte';
  import ChatWindow from './components/ChatWindow.svelte';
  import ConversationList from './components/ConversationList.svelte';
  import PromptLibrary from './components/PromptLibrary.svelte';
  import TaskPanel from './components/TaskPanel.svelte';
  import { getOrCreateConversation, type Conversation } from './lib/db';
  import TopSettingsBar from './components/TopSettingsBar.svelte';

  let promptToInsert: string | null = null;
  let selectedConversationId: string | null = null;
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
  function handleSelectConversation(event: CustomEvent<{ id: string | null }>) {
    selectedConversationId = event.detail.id;
    console.log("App selected conversation:", selectedConversationId);
  }
</script>

<main class="app-layout">
  <TopSettingsBar />
  <div class="main-content">
    <!-- Hamburger menu -->
    <div class="menu-burger-area">
      <button class="hamburger" on:click={() => menuOpen = !menuOpen} aria-label="Open menu">
        <span></span><span></span><span></span>
      </button>
      {#if menuOpen}
        <nav class="app-menu">
          <button on:click={() => { promptLibraryOpen = true; menuOpen = false; }}>Prompt Library</button>
          <button on:click={() => { taskPanelOpen = true; menuOpen = false; }}>Task Queue</button>
        </nav>
      {/if}
    </div>
    <aside class="sidebar conversations">
      <ConversationList currentSelectedId={selectedConversationId} on:selectconversation={handleSelectConversation} />
    </aside>
    <section class="main-chat">
      <ChatWindow bind:insertContent={promptToInsert} conversationId={selectedConversationId} />
    </section>
  </div>

  <!-- Drawers/Modals -->
  {#if promptLibraryOpen}
    <button class="drawer-overlay" type="button" aria-label="Close prompt library" on:click={() => promptLibraryOpen = false} on:keydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { promptLibraryOpen = false; } }}></button>
    <aside class="drawer popout"><PromptLibrary on:insertprompt={handleInsertPrompt} /></aside>
  {/if}
  {#if taskPanelOpen}
    <button class="drawer-overlay" type="button" aria-label="Close task panel" on:click={() => taskPanelOpen = false} on:keydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { taskPanelOpen = false; } }}></button>
    <aside class="drawer popout"><TaskPanel conversationId={selectedConversationId} /></aside>
  {/if}
</main>

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }
  .main-content {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    height: 100%;
  }
  .menu-burger-area {
    width: 56px;
    min-width: 56px;
    border-right: 2px solid #222;
    background: #fafafa;
    position: relative;
    z-index: 1300;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
  }
  .sidebar {
    flex-shrink: 0;
    height: 100%;
    overflow-y: auto;
    border-right: 2px solid #222;
    background-color: #f9f9f9;
  }
  .sidebar.conversations {
    width: 250px;
  }
  .main-chat {
    flex-grow: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: #fff;
  }
  :global(.main-chat > *) {
     flex-grow: 1;
     height: 100%;
     overflow: hidden;
  }
  .hamburger {
    margin-top: 18px;
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
    left: 0;
    background: var(--bg-2, #fff);
    border: 1px solid #ccc;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    z-index: 1350;
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
    z-index: 1200;
    outline: none;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    width: 100vw;
    height: 100vh;
  }
  .drawer.popout, .drawer {
    position: fixed;
    top: 0; right: 0;
    width: min(400px, 100vw);
    height: 100vh;
    background: var(--bg-1, #fff);
    box-shadow: -2px 0 16px rgba(0,0,0,0.15);
    z-index: 1300;
    display: flex;
    flex-direction: column;
    animation: slideInDrawer 0.2s ease;
  }
  @keyframes slideInDrawer {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
</style>
