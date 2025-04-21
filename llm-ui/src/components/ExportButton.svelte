<script lang="ts">
  import { saveAs } from 'file-saver';
  import { listMessages, db } from '../lib/db'; // Import db to get conversation title
  import { chatToMarkdown } from '../lib/markdown';
  import type { Conversation } from '../lib/db'; // Import Conversation type

  export let conversationId: string;
  let isLoading = false;
  let error: string | null = null;

  async function handleExport() {
    if (!conversationId) {
      error = 'No conversation selected.';
      return;
    }

    isLoading = true;
    error = null;

    try {
      // Fetch messages and conversation details concurrently
      const [messages, conversation] = await Promise.all([
        listMessages(conversationId),
        db.conversations.get(conversationId)
      ]);

      if (!messages || messages.length === 0) {
        error = 'No messages found for this conversation.';
        isLoading = false;
        return;
      }

      const markdownContent = chatToMarkdown(messages);
      const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });

      // Generate a filename (use title if available, otherwise ID)
      const safeTitle = conversation?.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || `conversation_${conversationId.substring(0, 8)}`;
      const filename = `${safeTitle}.md`;

      saveAs(blob, filename);

    } catch (err) {
      console.error('Export failed:', err);
      error = `Export failed: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      isLoading = false;
    }
  }
</script>

<button on:click={handleExport} disabled={isLoading || !conversationId}>
  {#if isLoading}
    Exporting...
  {:else}
    Export .md
  {/if}
</button>

{#if error}
  <p style="color: red;">{error}</p>
{/if}

<style>
  button {
    padding: 0.5em 1em;
    cursor: pointer;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: #f0f0f0;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  button:hover:not(:disabled) {
    background-color: #e0e0e0;
  }
  p {
    font-size: 0.8em;
    margin-top: 0.5em;
  }
</style>