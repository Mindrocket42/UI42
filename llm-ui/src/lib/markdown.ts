import type { Message } from './db';

/**
 * Converts an array of chat messages into a Markdown string suitable for Obsidian.
 *
 * - Adds H2 headings for User and Assistant roles.
 * - Includes message content, preserving existing Markdown (including fenced code blocks).
 * - Ignores system messages.
 *
 * @param messages - Array of Message objects.
 * @returns A single Markdown string representing the conversation.
 */
export function chatToMarkdown(messages: Message[]): string {
  const markdownParts: string[] = [];

  for (const message of messages) {
    if (message.role === 'user') {
      markdownParts.push(`## User\n\n${message.content}\n`);
    } else if (message.role === 'assistant') {
      markdownParts.push(`## Assistant\n\n${message.content}\n`);
    }
    // System messages are ignored as per initial plan
  }

  return markdownParts.join('\n---\n\n'); // Use horizontal rules to separate messages
}