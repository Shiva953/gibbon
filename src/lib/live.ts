import { GibworkApiError } from '@gibwork/sdk';
import type { GibworkClient, WalletTaskSummary } from '@gibwork/sdk';
import type { LiveTask, SyncState } from '../types.js';
import { toLiveTask } from './normalize.js';

const PAGE_LIMIT = 50;

/** Walks every page of tasks.list for the signing wallet. */
export async function listAllSummaries(client: GibworkClient): Promise<WalletTaskSummary[]> {
  const all: WalletTaskSummary[] = [];
  let page = 1;

  for (;;) {
    const response = await client.tasks.list({ page, limit: PAGE_LIMIT });
    all.push(...response.results);
    if (response.results.length === 0 || page >= response.lastPage) break;
    page += 1;
  }

  return all;
}

/**
 * Builds the live half of the diff.
 *
 * `tasks.list()` returns summaries with no `content` and no `tags`, so a real
 * content diff needs one `tasks.get()` per task. We only fan out for tasks this
 * wallet's state file actually tracks: untracked live tasks are ignored by the
 * diff entirely, so fetching them would be requests spent on data we discard.
 *
 * A tracked task that 404s is simply omitted. The diff then sees a mapping with
 * no live counterpart and blocks it, which is the correct, human-in-the-loop
 * outcome — never a silent recreate.
 */
export async function fetchLiveTasks(
  client: GibworkClient,
  state: SyncState,
): Promise<{ live: LiveTask[]; summaries: WalletTaskSummary[]; missing: string[] }> {
  const summaries = await listAllSummaries(client);
  const summaryById = new Map(summaries.map((summary) => [summary.id, summary]));

  const trackedIds = [...new Set(Object.values(state.tasks).map((task) => task.taskId))];
  const live: LiveTask[] = [];
  const missing: string[] = [];

  for (const taskId of trackedIds) {
    try {
      const details = await client.tasks.get(taskId);
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
