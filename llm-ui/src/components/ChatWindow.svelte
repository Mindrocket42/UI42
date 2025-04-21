<script lang="ts">
  import { onMount, afterUpdate } from 'svelte'; // Import afterUpdate if needed for focus
  import { streamChat } from '../lib/providers';
  import {
    getOrCreateConversation,
    listMessages,
    appendMessage,
    updateConversationTitle, // Import updateConversationTitle from db
    type Message
  } from '../lib/db';
  import { settingsStore } from '../lib/settings';
  import { get } from 'svelte/store';
  import { chatToMarkdown } from '../lib/markdown';

  let messages: Message[] = [];
  let input = '';
  // Remove internal state: let conversationId = '';
  const apiKey: string = localStorage.getItem('apiKey') ?? ''; // Use const as it's not reassigned here

  // --- Props ---
  // Prop to receive content from the prompt library
  export let insertContent: string | null = null;
  export let conversationId: string | null = null; // Accept conversationId from parent

  // Reference to the textarea element for potential focus management
  let textareaElement: HTMLTextAreaElement;

  // Remove onMount logic that fetches conversation ID
  // onMount(async () => {
  //   const convo = await getOrCreateConversation();
  //   conversationId = convo.id;
  //   messages = await listMessages(conversationId);
  //   scrollToBottom();
  // });

  // --- Reactive Statements ---
  // Reactive statement to watch for incoming prompt content
  $: if (insertContent) {
    console.log('ChatWindow received insertContent:', insertContent);
    // Append to existing input or replace? Let's replace for simplicity now.
    input = insertContent;
    // Optionally focus the textarea after inserting
    textareaElement?.focus();
    // insertContent is reset to null in App.svelte shortly after,
    // so no need to reset it here.
  }

  // Load messages when conversationId prop changes
  $: if (conversationId) {
      loadMessages(conversationId);
  } else {
      // Clear messages if conversationId becomes null (e.g., no conversation selected)
      messages = [];
  }

  // --- Search ---
  let searchTerm = '';
  let filteredMessages: Message[] = [];

  $: filteredMessages = searchTerm.trim()
    ? messages.filter(m => m.content.toLowerCase().includes(searchTerm.toLowerCase()))
    : messages;

  function highlight(text: string, term: string): string {
    if (!term) return text;
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>');
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */
  function scrollToBottom() {
    const box = document.getElementById('msg-box');
    box?.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }

  async function loadMessages(id: string) {
      console.log(`ChatWindow loading messages for ${id}`);
      messages = await listMessages(id);
      // Ensure scroll happens after messages are rendered
      setTimeout(scrollToBottom, 0);
  }

  async function sendMessage() {
    const content = input.trim();
    // Ensure conversationId is available before sending
    if (!content || !conversationId) {
        if (!conversationId) console.warn("Cannot send message: No conversation selected.");
        return;
    }
    input = '';

    /* ----- Persist user message ------------------------------------- */
    const userMsg: Omit<Message, 'id'> = {
      conversationId,
      role: 'user',
      content,
      createdAt: new Date()
    };
    await appendMessage(userMsg);
    messages = [...messages, userMsg];
    scrollToBottom();

    // Autoname conversation after first prompt if it has a generic/new title
    if (messages.length === 1) {
      // Use first 6 words or 40 chars of user prompt as title
      let autoTitle = content.split(/\s+/).slice(0, 6).join(' ');
      if (autoTitle.length > 40) autoTitle = autoTitle.slice(0, 40) + '...';
      await updateConversationTitle(conversationId, autoTitle);
    }

    /* ----- Stream assistant reply ----------------------------------- */
    let assistantContent = '';
    const settings = get(settingsStore);
    for await (const delta of streamChat(settings, messages)) {
      assistantContent += delta;

      // live update last assistant bubble (immutable update)
      const draft: Message = {
        conversationId,
        role: 'assistant',
        content: assistantContent,
        createdAt: new Date()
      };
      if (messages[messages.length - 1]?.role === 'assistant') {
        messages[messages.length - 1] = draft;
      } else {
        messages = [...messages, draft];
      }
      scrollToBottom();
    }

    /* ----- Persist assistant final message -------------------------- */
    await appendMessage({
      conversationId,
      role: 'assistant',
      content: assistantContent,
      createdAt: new Date()
    });
  }

  let blocked = false;
  $: blocked = !get(settingsStore).providers[get(settingsStore).defaultProvider].key;

  let chatStartedAt: Date | null = null;
  let conversationTitle: string | null = null;

  $: if (messages.length > 0 && !chatStartedAt) {
    chatStartedAt = messages[0].createdAt ? new Date(messages[0].createdAt) : new Date();
  }

  $: if (conversationId) {
    db.conversations.get(conversationId).then(convo => {
      conversationTitle = convo?.title || null;
    });
  }

  function formatTimestamp(date: Date | null) {
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}`;
  }
</script>

<style>
  .chat-window {
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-height: 100dvh;
    font-family: system-ui, sans-serif;
  }
  .chat-header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    background: linear-gradient(90deg, #30336b 0%, #f0932b 100%);
    color: #fff;
    padding: 0.7rem 1.2rem 0.7rem 1.2rem;
    font-size: 1.07em;
    font-weight: 600;
    border-bottom: 1px solid #e0e0e0;
    min-height: 48px;
  }
  .model-name {
    font-weight: bold;
    letter-spacing: 0.5px;
  }
  .chat-main-row {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    position: relative;
  }
  #msg-box {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 1rem;
    background: #fafafa;
    min-width: 0;
  }
  .chat-right-zone {
    width: 48px;
    min-width: 48px;
    max-width: 48px;
    background: #fff;
    border-left: 1px solid #eee;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding-top: 0.5rem;
    height: auto;
  }
  .msg {
    max-width: 60ch;
    margin: 0.3rem 0;
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .msg.user {
    margin-left: auto;
    background: #d1e7ff;
  }
  .msg.assistant {
    margin-right: auto;
    background: #e9e9e9;
  }
  mark {
    background: #ffe066;
    color: inherit;
    padding: 0 2px;
    border-radius: 2px;
  }
  .composer {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    border-top: 1px solid #ddd;
  }
  .composer textarea {
    flex: 1 1 auto;
    resize: vertical;
    padding: 0.5rem;
    font-family: inherit;
  }
  .composer button {
    flex: 0 0 auto;
    padding: 0 1rem;
    min-width: 48px;
  }
  @media (max-width: 600px) {
    .chat-window {
      height: 100dvh;
      max-width: 100vw;
    }
    .msg {
      max-width: 98vw;
      font-size: 0.98rem;
      padding: 0.5rem 0.4rem;
    }
    .chat-right-zone {
      width: 42px;
      min-width: 42px;
      max-width: 42px;
    }
  }
  .banner {
    color: #e53e3e;
    background: #fff0f0;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }
  .empty-chat-msg {
    color: #aaa;
    text-align: center;
    margin-top: 2em;
    font-size: 1.1em;
  }
</style>

<div class="chat-window">
  <div class="chat-header">
    <span class="model-name">{get(settingsStore).model}</span>
  </div>
  <div class="chat-main-row">
    <div id="msg-box">
      {#if filteredMessages.length === 0}
        <div class="empty-chat-msg">No conversation selected or no messages yet.</div>
      {:else}
        {#each filteredMessages as m}
          <div class="msg {m.role}">
            <pre>{@html highlight(m.content, searchTerm)}</pre>
          </div>
        {/each}
      {/if}
    </div>
    <div class="chat-right-zone">
      <slot name="settings" />
    </div>
  </div>
  <form class="composer" on:submit|preventDefault={sendMessage}>
    {#if blocked}
      <div class="banner">
        <!-- Removed redundant API key prompt -->
      </div>
    {/if}
    <textarea
      rows="3"
      placeholder="Type a message…"
      bind:value={input}
      bind:this={textareaElement}
      on:keydown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      }}
      disabled={blocked}
    ></textarea>
    <button type="submit" disabled={!input.trim() || blocked}>Send</button>
  </form>
</div>
