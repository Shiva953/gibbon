import { GibworkApiError } from '@gibwork/sdk';
import type { GibworkClient, WalletTaskSummary } from '@gibwork/sdk';
import type { LiveTask, SyncState } from '../types.js';
import { toLiveTask } from './normalize.js';

const PAGE_LIMIT = 50;

/** Walks every page of tasks.list for the signing wallet. */
export async function listAllSummaries(
  client: GibworkClient,
  signal?: AbortSignal,
): Promise<WalletTaskSummary[]> {
  const all: WalletTaskSummary[] = [];
  const options = signal ? { signal } : undefined;
  let page = 1;

  for (;;) {
    const response = await client.tasks.list({ page, limit: PAGE_LIMIT }, options);
    all.push(...response.results);
    if (response.results.length === 0 || page >= response.lastPage) break;
    page += 1;
  }

  return all;
}

/**
 * Builds the live half of the diff.
 *
 * `tasks.list()` omits `content` and `tags`, so a real diff needs one
 * `tasks.get()` per task — and only for tasks the state file tracks, since the
 * diff ignores the rest anyway.
 *
 * A tracked task that 404s is omitted, leaving the diff to block a mapping
 * with no live counterpart rather than silently recreate it.
 */
export async function fetchLiveTasks(
  client: GibworkClient,
  state: SyncState,
  signal?: AbortSignal,
): Promise<{ live: LiveTask[]; summaries: WalletTaskSummary[]; missing: string[] }> {
  const options = signal ? { signal } : undefined;
  const summaries = await listAllSummaries(client, signal);
  const summaryById = new Map(summaries.map((summary) => [summary.id, summary]));

  const trackedIds = [...new Set(Object.values(state.tasks).map((task) => task.taskId))];
  const live: LiveTask[] = [];
  const missing: string[] = [];

  for (const taskId of trackedIds) {
    try {
      const details = await client.tasks.get(taskId, options);
      live.push(toLiveTask(details, summaryById.get(taskId)));
    } catch (error) {
      if (error instanceof GibworkApiError && error.status === 404) {
        missing.push(taskId);
        continue;
      }
      throw error;
    }
  }

  return { live, summaries, missing };
}
