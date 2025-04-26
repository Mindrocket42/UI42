import Dexie from 'dexie';
import type { Table, WhereClause, Collection } from 'dexie'; // Import specific types

/**
 * Simple Dexie wrapper for chat data.
 *
 * Schema v4
 * ----------
 * conversations: primary key id (string, UUID)
 * messages:      primary key ++id (auto‑increment),
 *                indexed conversationId, createdAt, model
 * prompts:       primary key ++id (auto-increment),
 *                indexed name, updatedAt
 * tasks:         primary key ++id (auto-increment),
 *                indexed status, createdAt, [status+createdAt] // Added compound index
 */

export interface Conversation {
  id: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatRole = 'system' | 'user' | 'assistant';

export interface Message {
  id?: number;
  conversationId: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
  model?: string; // store the model used for this message
}

export interface Prompt {
  id?: number; // Auto-incrementing primary key
  name: string; // Name/title of the prompt
  content: string; // The actual prompt text
  createdAt: Date;
  updatedAt: Date;
}

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Task {
  id?: number; // Auto-incrementing primary key
  status: TaskStatus;
  content: string; // The task description
  result?: string; // Output or error message
  createdAt: Date;
  updatedAt: Date;
}


class ChatDB extends Dexie {
  conversations!: Table<Conversation, string>;
  messages!: Table<Message, number>;
  prompts!: Table<Prompt, number>;
  tasks!: Table<Task, number>;

  constructor() {
    super('chatDB');
    // Increment version number for schema change (v4)
    this.version(4).stores({
      conversations: 'id, updatedAt',
      messages: '++id, conversationId, createdAt, model',
      prompts: '++id, name, updatedAt',
      tasks: '++id, status, createdAt, [status+createdAt]' // Added compound index
    }).upgrade(tx => {
      console.log("Upgrading database schema to version 4");
      // Dexie handles adding the new index automatically.
      return Promise.resolve();
    });

    // Keep v3 schema definition for backward compatibility during upgrade
    this.version(3).stores({
        conversations: 'id, updatedAt',
        messages: '++id, conversationId, createdAt',
        prompts: '++id, name, updatedAt',
        tasks: '++id, status, createdAt' // Schema before compound index
    }).upgrade(tx => {
      console.log("Upgrading database schema to version 3");
      return Promise.resolve();
    });

    // Keep v2 schema definition
    this.version(2).stores({
      conversations: 'id, updatedAt',
      messages: '++id, conversationId, createdAt',
      prompts: '++id, name, updatedAt'
    }).upgrade(tx => {
      console.log("Upgrading database schema to version 2");
      return Promise.resolve();
    });

    // Keep v1 schema definition
    this.version(1).stores({
       conversations: 'id, updatedAt',
       messages: '++id, conversationId, createdAt'
    });
  }

  /** Upsert helper for conversations */
  async touchConversation(id: string) {
    const now = new Date();
    const existing = await this.conversations.get(id);
    await this.conversations.put({
      id,
      title: existing?.title,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    });
  }
}

export const db = new ChatDB();

/* ------------------------------------------------------------------ */
/* Helper functions                                                    */
/* ------------------------------------------------------------------ */

export async function getOrCreateConversation(): Promise<Conversation> {
  let convo = await db.conversations.orderBy('updatedAt').last();
  if (!convo) {
    const id = crypto.randomUUID();
    const now = new Date();
    convo = { id, title: `New Conversation ${now.toLocaleTimeString()}`, createdAt: now, updatedAt: now };
    await db.conversations.add(convo);
  }
  return convo;
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  // Correct: Use orderBy on the WhereClause before sortBy
  return db.messages
    .where('conversationId').equals(conversationId)
    .sortBy('createdAt'); // sortBy is correct here as it sorts the final array
}

export async function appendMessage(msg: Omit<Message, 'id' | 'createdAt'> & { createdAt?: Date }): Promise<number> {
    const messageToSave: Message = {
        id: undefined,
        conversationId: msg.conversationId,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt || new Date(),
        model: msg.model,
    };
    const id = await db.messages.add(messageToSave);
    await db.touchConversation(msg.conversationId);
    return id;
}

export async function branchConversation(originalConversationId: string, branchFromMessageId?: number): Promise<string> {
  const newConversationId = crypto.randomUUID();
  const now = new Date();
  const originalConvo = await db.conversations.get(originalConversationId);
  const newTitle = `Branch of ${originalConvo?.title || `Conversation ${originalConversationId.substring(0, 8)}`}`;

  await db.conversations.add({ id: newConversationId, title: newTitle, createdAt: now, updatedAt: now });

  let messagesToCopyQuery = db.messages.where('conversationId').equals(originalConversationId);

  if (branchFromMessageId !== undefined && branchFromMessageId !== null) {
    const branchMessage = await db.messages.get(branchFromMessageId);
    if (branchMessage) {
      // Filter messages created at or before the branch point
      messagesToCopyQuery = messagesToCopyQuery.filter(msg => msg.createdAt <= branchMessage.createdAt);
    } else {
      console.warn(`Branch message ID ${branchFromMessageId} not found. Copying all messages.`);
    }
  }

  // Correct: Use sortBy on the collection to sort the results before mapping
  const messagesToCopy = await messagesToCopyQuery.sortBy('createdAt');

  const newMessages = messagesToCopy.map(msg => ({
    ...msg,
    id: undefined,
    conversationId: newConversationId,
  }));

  if (newMessages.length > 0) {
    await db.messages.bulkAdd(newMessages);
  }

  console.log(`Branched conversation ${originalConversationId} to ${newConversationId}`);
  return newConversationId;
}

export async function createConversation(title?: string): Promise<string> {
  const newConversationId = crypto.randomUUID();
  const now = new Date();
  const defaultTitle = `New Conversation ${now.toLocaleTimeString()}`;
  await db.conversations.add({ id: newConversationId, title: title || defaultTitle, createdAt: now, updatedAt: now });
  console.log(`Created new conversation ${newConversationId}`);
  return newConversationId;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await db.transaction('rw', db.conversations, db.messages, db.tasks, async () => {
    await db.messages.where('conversationId').equals(conversationId).delete();
    await db.conversations.delete(conversationId);
  });
  console.log(`Deleted conversation ${conversationId} and its messages`);
}

/* ------------------------------------------------------------------ */
/* Prompt Helper functions                                            */
/* ------------------------------------------------------------------ */

export async function listPrompts(): Promise<Prompt[]> {
  return db.prompts.orderBy('name').toArray();
}

export async function addPrompt(name: string, content: string): Promise<number> {
  const now = new Date();
  const newPrompt: Prompt = { name, content, createdAt: now, updatedAt: now };
  const id = await db.prompts.add(newPrompt);
  console.log(`Added prompt "${name}" with id ${id}`);
  return id;
}

export async function updatePrompt(id: number, updates: Partial<Omit<Prompt, 'id' | 'createdAt'>>): Promise<number> {
  const updateData = { ...updates, updatedAt: new Date() };
  const count = await db.prompts.update(id, updateData);
  if (count > 0) console.log(`Updated prompt with id ${id}`);
  else console.warn(`Prompt with id ${id} not found for update.`);
  return count;
}

export async function deletePrompt(id: number): Promise<void> {
  await db.prompts.delete(id);
  console.log(`Deleted prompt with id ${id}`);
}

/* ------------------------------------------------------------------ */
/* Task Helper functions                                              */
/* ------------------------------------------------------------------ */

/** Adds a new task to the queue. */
export async function addTask(content: string): Promise<number> {
    const now = new Date();
    const newTask: Task = { status: 'pending', content, createdAt: now, updatedAt: now };
    const id = await db.tasks.add(newTask);
    console.log(`Added task "${content.substring(0, 50)}..." with id ${id}`);
    return id;
}

/** Retrieves the oldest pending task. */
export async function getNextPendingTask(): Promise<Task | undefined> {
    // Filter by status, then sort the results in memory using sortBy, then take the first.
    // This works around the TS error with chaining orderBy() after where().
    const pendingTasks = await db.tasks
        .where({ status: 'pending' })
        .sortBy('createdAt'); // Sorts the resulting collection (returns Promise<Task[]>)

    return pendingTasks.length > 0 ? pendingTasks[0] : undefined; // Return the first element or undefined
}

/** Updates the status and optionally the result of a task. */
export async function updateTaskStatus(id: number, status: TaskStatus, result?: string): Promise<number> {
    const updateData: Partial<Task> = { status, updatedAt: new Date() };
    if (result !== undefined) updateData.result = result;
    const count = await db.tasks.update(id, updateData);
    if (count > 0) console.log(`Updated task ${id} status to ${status}`);
    else console.warn(`Task with id ${id} not found for status update.`);
    return count;
}

/** Lists all tasks, optionally filtered by status. */
export async function listTasks(status?: TaskStatus): Promise<Task[]> {
    if (status) {
        // Filter by status, sort by update time. Use sortBy on the collection.
        return db.tasks.where({ status: status }).sortBy('updatedAt');
    }
    // No status filter: sort all tasks by creation time using orderBy on the table.
    // Removed the redundant 'else' based on Biome suggestion.
    return db.tasks.orderBy('createdAt').toArray();
}

/** Deletes a task by its ID. */
export async function deleteTask(id: number): Promise<void> {
    await db.tasks.delete(id);
    console.log(`Deleted task with id ${id}`);
}
