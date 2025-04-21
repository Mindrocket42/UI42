import {
    getNextPendingTask,
    updateTaskStatus,
    appendMessage,
    type Task,
    type Message,
    type ChatRole
} from './db';
import { streamChat } from './chatApi';

// Use a regular string as no interpolation is needed
const AGENT_SYSTEM_PROMPT = 'You are an autonomous assistant. Your goal is to complete the given task. Respond concisely with the result of the task.';

let agentLoopTimeoutId: number | null = null;
let isAgentRunning = false;
let currentAbortController: AbortController | null = null;

// Configuration (to be passed in or managed globally)
let agentApiKey: string | null = null;
let agentModel: string | null = null;
let agentConversationId: string | null = null; // Target conversation for agent replies

/**
 * Processes a single task using the LLM.
 */
async function processTask(task: Task): Promise<void> {
    if (!agentApiKey || !agentModel || !agentConversationId) {
        console.error("Agent configuration (API Key, Model, Conversation ID) is missing.");
        // Ensure task.id is not null before using it
        if (task.id === undefined || task.id === null) {
             console.error("Task ID is missing, cannot update status.");
             return;
        }
        await updateTaskStatus(task.id, 'failed', 'Agent configuration missing.');
        return;
    }

    // Ensure task.id is not null before proceeding
    if (task.id === undefined || task.id === null) {
        console.error("Task ID is missing, cannot process task.");
        return;
    }
    const taskId = task.id; // Use a non-null variable

    console.log(`Processing task ${taskId}: ${task.content}`);
    await updateTaskStatus(taskId, 'processing');

    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    const messages: Pick<Message, 'role' | 'content'>[] = [
        { role: 'system', content: AGENT_SYSTEM_PROMPT },
        { role: 'user', content: task.content }
    ];

    let fullResponse = '';
    let errorResult: string | null = null;

    try {
        // Cast messages to the expected type for streamChat, excluding fields like id, createdAt etc.
        // This cast assumes streamChat handles objects with only role/content correctly.
        const apiMessages = messages as Message[];

        for await (const chunk of streamChat(agentApiKey, apiMessages, agentModel, signal)) {
            if (signal.aborted) {
                console.log(`Task ${taskId} aborted.`);
                errorResult = 'Task aborted by user.';
                break;
            }
            fullResponse += chunk;
        }

        if (errorResult) {
             await updateTaskStatus(taskId, 'failed', errorResult);
        } else {
            console.log(`Task ${taskId} completed. Result: ${fullResponse.substring(0, 100)}...`);
            await updateTaskStatus(taskId, 'completed', fullResponse);

            // Append the result as an assistant message to the designated conversation
            await appendMessage({
                conversationId: agentConversationId,
                role: 'assistant',
                content: `Task Result (ID: ${taskId}):\n${fullResponse}`
                // createdAt will be set by appendMessage
            });

            // TODO: Implement logic to parse fullResponse for new tasks to enqueue (BabyAGI style)
        }

    // Use 'unknown' for type safety and check the type before accessing properties
    } catch (error: unknown) {
        console.error(`Error processing task ${taskId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        await updateTaskStatus(taskId, 'failed', errorMessage);
    } finally {
         currentAbortController = null; // Clear the controller once done
    }
}

/**
 * The main agent loop. Fetches and processes tasks sequentially.
 */
async function runAgentLoop(): Promise<void> {
    if (!isAgentRunning) {
        console.log("Agent loop stopped.");
        return;
    }

    let taskToProcess: Task | undefined;
    try {
        taskToProcess = await getNextPendingTask();
    } catch (error) {
        console.error("Error fetching next task:", error);
        // Schedule next check even if fetching failed
        agentLoopTimeoutId = window.setTimeout(runAgentLoop, 5000); // Check again in 5s
        return;
    }


    if (taskToProcess) {
        await processTask(taskToProcess);
        // Process next task immediately after finishing one
        agentLoopTimeoutId = window.setTimeout(runAgentLoop, 100); // Short delay
    } else {
        // No pending tasks, check again later
        agentLoopTimeoutId = window.setTimeout(runAgentLoop, 5000); // Check again in 5s
    }
}

/**
 * Starts the agent loop.
 * Requires API key, model, and the target conversation ID for replies.
 */
export function startAgent(apiKey: string, model: string, conversationId: string): void {
    if (isAgentRunning) {
        console.log("Agent is already running.");
        return;
    }
    if (!apiKey || !model || !conversationId) {
        console.error("Cannot start agent: API Key, Model, or Conversation ID is missing.");
        return;
    }
    console.log(`Starting agent loop for conversation ${conversationId}...`);
    agentApiKey = apiKey;
    agentModel = model;
    agentConversationId = conversationId;
    isAgentRunning = true;
    // Clear any existing timeout just in case
    if (agentLoopTimeoutId !== null) {
        window.clearTimeout(agentLoopTimeoutId);
    }
    runAgentLoop(); // Start the first iteration
}

/**
 * Stops the agent loop.
 */
export function stopAgent(): void {
    if (!isAgentRunning) {
        console.log("Agent is not running.");
        return;
    }
    console.log("Stopping agent loop...");
    isAgentRunning = false;
    if (agentLoopTimeoutId !== null) {
        window.clearTimeout(agentLoopTimeoutId);
        agentLoopTimeoutId = null;
    }
    // Abort any ongoing fetch request
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }
    agentApiKey = null;
    agentModel = null;
    agentConversationId = null;
}

/**
 * Checks if the agent loop is currently active.
 */
export function isAgentActive(): boolean {
    return isAgentRunning;
}