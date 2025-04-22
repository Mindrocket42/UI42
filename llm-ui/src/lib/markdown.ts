import type { Message } from './db';

/**
 * Converts an array of chat messages into a Markdown string suitable for Obsidian.
 *
 * - Adds H3 headings for User and Assistant roles with model info.
 * - Includes message content, preserving existing Markdown (including fenced code blocks).
 * - Adds visual separation between messages.
 * - Ignores system messages.
 *
 * @param messages - Array of Message objects.
 * @param model - Optional model name to include with Assistant messages.
 * @returns A single Markdown string representing the conversation.
 */
export function chatToMarkdown(messages: Message[], model?: string): string {
  const markdownParts: string[] = [];

  for (const message of messages) {
    if (message.role === 'user') {
      markdownParts.push(`### 👤 User\n\n${message.content}\n`);
    } else if (message.role === 'assistant') {
      const modelInfo = model ? ` (${model})` : '';
      markdownParts.push(`### 🤖 Assistant${modelInfo}\n\n${message.content}\n`);
    }
    // System messages are ignored as per initial plan
  }

  return markdownParts.join('\n---\n\n'); // Use horizontal rules to separate messages
}

/**
 * Creates a markdown representation of a single message for clipboard operations.
 * 
 * @param role - The role (user or assistant)
 * @param content - The message content
 * @param model - Optional model name for assistant messages
 * @returns Formatted markdown string
 */
export function messageToMarkdown(role: string, content: string, model?: string): string {
  if (role === 'user') {
    return `### 👤 User\n\n${content}\n`;
  } else if (role === 'assistant') {
    const modelInfo = model ? ` (${model})` : '';
    return `### 🤖 Assistant${modelInfo}\n\n${content}\n`;
  }
  return content;
}