<!-- llm-ui/src/components/TaskPanel.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	// Ensure Conversation is imported along with other types/functions
	import { db, listTasks, addTask, deleteTask, type Task, type TaskStatus, type Conversation } from '$lib/db';
	import { startAgent, stopAgent, isAgentActive } from '$lib/babyAgi';
	import { liveQuery } from 'dexie';

	// --- Props ---
    export let conversationId: string | null = null; // Accept conversationId as a prop

	// --- State ---
	let newTaskContent = '';
	// Use const for the liveQuery observable itself
	const tasks = liveQuery<Task[]>(() => listTasks());
	let agentStatus = isAgentActive(); // Needs let, updated by interval/handlers
	let agentStatusInterval: number | null = null; // Needs let

	// TODO: Get these from global state/settings later
	// Use const as these are only read once on component init in this version
	const apiKey = localStorage.getItem('openai_api_key') || '';
	const model = 'gpt-3.5-turbo';
	// Removed state variable, use prop directly

	// Reactive derived state for easier filtering in the template
	// Add explicit type Task to the filter parameter 't'
	$: pendingTasks = $tasks?.filter((t: Task) => t.status === 'pending') ?? [];
	$: processingTasks = $tasks?.filter((t: Task) => t.status === 'processing') ?? [];
	$: completedTasks = $tasks?.filter((t: Task) => t.status === 'completed') ?? [];
	$: failedTasks = $tasks?.filter((t: Task) => t.status === 'failed') ?? [];

	// --- Lifecycle ---
	onMount(() => {
		// Periodically check agent status
		agentStatusInterval = window.setInterval(() => {
			agentStatus = isAgentActive();
		}, 1000);

        // Remove placeholder logic for getting conversation ID
        // It will now be passed as a prop 'conversationId'
	});

	onDestroy(() => {
		if (agentStatusInterval !== null) {
			window.clearInterval(agentStatusInterval);
		}
		// Optional: Stop agent if panel is destroyed
		// if (isAgentActive()) { stopAgent(); }
	});

	// --- Handlers ---
	async function handleAddTask() {
		if (!newTaskContent.trim()) return;
		try {
			await addTask(newTaskContent.trim());
			newTaskContent = ''; // Clear input
		} catch (error) {
			console.error('Failed to add task:', error);
			// TODO: Show user-friendly error
		}
	}

	async function handleStartAgent() {
		if (!apiKey) {
			alert('Please set your API Key in Settings first.');
			return;
		}
        // Use the prop 'conversationId' directly
        if (!conversationId) {
            alert('Cannot start agent: No active conversation selected.');
            return;
        }
		startAgent(apiKey, model, conversationId);
		agentStatus = true; // Update status immediately
	}

	function handleStopAgent() {
		stopAgent();
		agentStatus = false; // Update status immediately
	}

	async function handleDeleteTask(id: number | undefined) {
		if (id === undefined) return;
		if (confirm(`Are you sure you want to delete task ${id}?`)) {
			try {
				await deleteTask(id);
			} catch (error) {
				console.error(`Failed to delete task ${id}:`, error);
				// TODO: Show user-friendly error
			}
		}
	}

    function formatResult(result: string | undefined): string {
        if (!result) return 'N/A';
        const maxLength = 100;
        // Use template literal
        return result.length > maxLength ? `${result.substring(0, maxLength)}...` : result;
    }
</script>

<div class="task-panel">
	<h2>Task Queue</h2>

	<!-- Agent Control -->
	<div class="agent-controls">
		{#if agentStatus}
			<button on:click={handleStopAgent} class="stop-button">Stop Agent</button>
			<span>Status: Running</span>
		{:else}
			<button on:click={handleStartAgent} class="start-button" disabled={!apiKey || !conversationId}>Start Agent</button>
			<span>Status: Idle</span>
		{/if}
        {#if !apiKey}
            <small style="color: orange; margin-left: 10px;">(API Key needed)</small>
        {/if}
         {#if !conversationId} <!-- Check the prop -->
            <small style="color: orange; margin-left: 10px;">(Select a conversation)</small>
        {/if}
	</div>

	<!-- Add Task -->
	<div class="add-task">
		<input
			type="text"
			bind:value={newTaskContent}
			placeholder="Enter new task description..."
			on:keydown={(e) => e.key === 'Enter' && handleAddTask()}
		/>
		<button on:click={handleAddTask} disabled={!newTaskContent.trim()}>Add Task</button>
	</div>

	<!-- Task Lists -->
	<div class="task-lists">
		<section>
			<h3>Pending ({pendingTasks.length})</h3>
			{#if pendingTasks.length === 0}
				<p>No pending tasks.</p>
			{:else}
				<ul>
					{#each pendingTasks as task (task.id)}
						<li>
							<span>{task.content}</span>
							<button on:click={() => handleDeleteTask(task.id)} class="delete-button" title="Delete Task">🗑️</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section>
			<h3>Processing ({processingTasks.length})</h3>
			{#if processingTasks.length === 0}
				<p>No tasks processing.</p>
			{:else}
				<ul>
					{#each processingTasks as task (task.id)}
						<li>{task.content}</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section>
			<h3>Completed ({completedTasks.length})</h3>
			{#if completedTasks.length === 0}
				<p>No completed tasks.</p>
			{:else}
				<ul>
					{#each completedTasks as task (task.id)}
						<li>
                            <details>
                                <summary>{task.content}</summary>
                                <p><strong>Result:</strong> {formatResult(task.result)}</p>
                            </details>
							<button on:click={() => handleDeleteTask(task.id)} class="delete-button" title="Delete Task">🗑️</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section>
			<h3>Failed ({failedTasks.length})</h3>
			{#if failedTasks.length === 0}
				<p>No failed tasks.</p>
			{:else}
				<ul>
					{#each failedTasks as task (task.id)}
						<li>
                            <details>
                                <summary style="color: red;">{task.content}</summary>
                                <p><strong>Error:</strong> {formatResult(task.result)}</p>
                            </details>
							<button on:click={() => handleDeleteTask(task.id)} class="delete-button" title="Delete Task">🗑️</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</div>

<style>
	.task-panel {
		padding: 1rem;
		border-left: 1px solid #ccc;
        height: 100%;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        min-width: 300px; /* Ensure panel has some width */
        max-width: 400px; /* Limit width */
        background-color: #f9f9f9; /* Light background for the panel */
	}

    h2, h3 {
        margin-top: 0;
        margin-bottom: 0.5rem;
        color: #333;
    }
    h3 {
        font-size: 1.1em;
        border-bottom: 1px solid #eee;
        padding-bottom: 0.3rem;
        margin-bottom: 0.5rem;
    }

    .agent-controls {
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #eee;
        display: flex;
        align-items: center;
        flex-wrap: wrap; /* Allow wrapping if needed */
        gap: 0.5rem;
    }
    .agent-controls span {
        font-style: italic;
        color: #555;
        font-size: 0.9em;
    }
    .start-button, .stop-button {
        padding: 0.3rem 0.6rem;
        cursor: pointer;
        border-radius: 4px;
        border: 1px solid transparent;
        font-size: 0.9em;
    }
    .start-button { background-color: #d4edda; border-color: #c3e6cb; color: #155724; }
    .stop-button { background-color: #f8d7da; border-color: #f5c6cb; color: #721c24; }
    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }


	.add-task {
		display: flex;
		margin-bottom: 1rem;
	}
	.add-task input {
		flex-grow: 1;
		margin-right: 0.5rem;
        padding: 0.4rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 0.95em;
	}
    .add-task button {
        padding: 0.4rem 0.8rem;
        cursor: pointer;
        border: 1px solid #007bff;
        background-color: #007bff;
        color: white;
        border-radius: 4px;
        font-size: 0.95em;
    }
     .add-task button:hover:not(:disabled) {
        background-color: #0056b3;
    }


	.task-lists {
        flex-grow: 1; /* Allow lists to take remaining space */
        overflow-y: auto; /* Enable scrolling for lists if needed */
        display: flex;
        flex-direction: column;
        gap: 1rem;
	}

    section {
        border: 1px solid #e0e0e0;
        padding: 0.75rem;
        border-radius: 4px;
        background-color: #fff; /* White background for sections */
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

	ul {
		list-style: none;
		padding: 0;
        margin: 0;
        max-height: 150px; /* Limit height */
        overflow-y: auto; /* Scroll within list */
	}
    ul p { /* Style for 'No tasks' messages */
        color: #777;
        font-style: italic;
        font-size: 0.9em;
        text-align: center;
        padding: 0.5rem 0;
    }

	li {
		padding: 0.4rem 0;
		border-bottom: 1px solid #f0f0f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.95em;
	}
    li:last-child {
        border-bottom: none;
    }
    li span { /* For pending/processing tasks */
        flex-grow: 1;
        word-break: break-word; /* Prevent long text overflow */
    }
    li details { /* For completed/failed tasks */
        flex-grow: 1;
        cursor: pointer;
    }
    li details summary {
        /* Use default browser summary styling or customize */
        word-break: break-word;
        padding: 0.2rem 0; /* Add some padding */
    }
    li details summary:hover {
        background-color: #f5f5f5; /* Slight hover effect */
    }
    li details p {
        margin-top: 0.4rem;
        font-size: 0.9em;
        color: #333;
        background-color: #f0f0f0;
        padding: 0.4rem;
        border-radius: 3px;
        word-break: break-word;
        white-space: pre-wrap; /* Preserve whitespace in results */
    }

    .delete-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.2rem;
        font-size: 1em; /* Make icon slightly larger */
        color: #aaa;
        line-height: 1; /* Prevent extra spacing */
        opacity: 0.7;
        transition: color 0.2s, opacity 0.2s;
    }
    .delete-button:hover {
        color: red;
        opacity: 1;
    }

</style>