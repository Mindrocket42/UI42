<script lang="ts">
  import { onMount, afterUpdate } from 'svelte'; // Import afterUpdate if needed for focus
  import { streamChat } from '../lib/providers';
  import {
    getOrCreateConversation,
    listMessages,
    appendMessage,
    type Message,
    db // Import db instance
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
      createdAt: new Date(),
      model: get(settingsStore).model // Store the model used for this message
    };
    await appendMessage(userMsg);
    messages = [...messages, userMsg];
    scrollToBottom();

    // Autoname conversation after first prompt if it has a generic/new title
    if (messages.length === 1) {
      // Use first 6 words or 40 chars of user prompt as title
      let autoTitle = content.split(/\s+/).slice(0, 6).join(' ');
      if (autoTitle.length > 40) autoTitle = autoTitle.slice(0, 40) + '...';
      // Update the conversation title directly using Dexie
      const now = new Date();
      await db.conversations.update(conversationId, { title: autoTitle, updatedAt: now });
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
        createdAt: new Date(),
        model: settings.model // Store the model used for this assistant reply
      };
      // Optionally update UI with draft
      scrollToBottom();
    }

    /* ----- Persist assistant final message -------------------------- */
    await appendMessage({
      conversationId,
      role: 'assistant',
      content: assistantContent,
      createdAt: new Date(),
      model: settings.model // Store the model used for this assistant reply
    });
    messages = await listMessages(conversationId);
    scrollToBottom();
  }

  let blocked = false;
  $: blocked = !get(settingsStore).providers[get(settingsStore).defaultProvider].key;

  // Add the missing function for copying a single message as markdown
  function copyMessageAsMarkdown(message: Message) {
    // Inline conversion to markdown for a single message
    let md = '';
    if (message.role === 'user') {
      md = `## User\n\n${message.content}\n`;
    } else if (message.role === 'assistant') {
      md = `## Assistant\n\n${message.content}\n`;
    }
    navigator.clipboard.writeText(md)
      .then(() => {
        console.log('Message copied to clipboard as markdown');
      })
      .catch(err => {
        console.error('Failed to copy message:', err);
      });
  }

  // Add function to copy all messages as markdown
  function copyAllMessagesAsMarkdown() {
    let md = '';
    for (const m of filteredMessages) {
      if (m.role === 'user') {
        md += `## User\n\n${m.content}\n`;
      } else if (m.role === 'assistant') {
        md += `## Assistant\n\n${m.content}\n`;
      }
    }
    navigator.clipboard.writeText(md)
      .then(() => {
        console.log('All messages copied to clipboard as markdown');
      })
      .catch(err => {
        console.error('Failed to copy all messages:', err);
      });
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
  .search-box {
    margin-bottom: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
  }
  #msg-box {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 1rem;
    background: #fafafa;
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
  }
  .banner {
    color: #e53e3e;
    background: #fff0f0;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }
  .chat-header {
    padding: 0.5rem;
    border-bottom: 1px solid #ddd;
  }
  .model-name {
    font-size: 0.9rem;
    color: #666;
  }
  .msg-role-label {
    display: flex;
    align-items: center;
    margin-bottom: 0.2rem;
  }
  .role-prefix {
    font-size: 0.9rem;
    color: #666;
  }
  .user-role {
    color: #337ab7;
  }
  .assistant-role {
    color: #5cb85c;
  }
  .copy-msg-btn {
    margin-left: 0.5rem;
    padding: 0.2rem 0.4rem;
    border: none;
    border-radius: 4px;
    background: #f7f7f7;
    cursor: pointer;
  }
  .copy-msg-btn:hover {
    background: #e7e7e7;
  }
  .copy-all-btn {
    margin: 0.5rem auto 0.5rem auto;
    display: block;
    background: #f7f7f7;
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 0.4rem 1.2rem;
    font-weight: bold;
    cursor: pointer;
  }
</style>

<div class="chat-window">
  <div class="chat-header">
  </div>
  <div id="msg-box">
    {#each filteredMessages as m}
      <div class="msg {m.role}">
        <div class="msg-role-label">
          {#if m.role === 'user'}
            <span class="role-prefix user-role">User</span>
          {:else}
            <span class="role-prefix assistant-role">Assistant - {m.model || get(settingsStore).model}</span>
          {/if}
          <button 
            class="copy-msg-btn" 
            title="Copy as markdown" 
            aria-label="Copy message as markdown"
            on:click={() => copyMessageAsMarkdown(m)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
        <pre class="msg-content">{@html highlight(m.content, searchTerm)}</pre>
      </div>
    {/each}
  </div>
  <div class="chat-footer">
    <button class="copy-all-btn" on:click={copyAllMessagesAsMarkdown}>
      Copy All to Markdown
    </button>
    <form class="composer" on:submit|preventDefault={sendMessage}>
      {#if blocked}
        <div class="banner">
          Add an API key
        </div>
      {/if}
      <textarea
        rows="3"
        placeholder="Type a message…"
        bind:value={input}
        bind:this={textareaElement}
        on:keydown={(e) => {
          // Optional: Allow sending with Enter, Shift+Enter for newline
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent default newline
            sendMessage();
          }
        }}
        disabled={blocked}
      ></textarea>
      <button type="submit" disabled={!input.trim() || blocked}>Send</button> <!-- Disable send if no input/key -->
    </form>
  </div>
</div>
