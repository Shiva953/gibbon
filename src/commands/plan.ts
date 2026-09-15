import { computePlan } from '../lib/diff.js';
import { EXIT } from '../lib/errors.js';
import { fetchLiveTasks } from '../lib/live.js';
import { renderPending, renderPlan } from '../lib/render.js';
import { assertStateMatches, loadState } from '../lib/state.js';
import { loadBounties } from '../lib/yaml.js';
import type { Runtime } from '../runtime.js';

export interface PlanOptions {
  file: string;
}

/**
 * Read-only. Diffs bounties.yaml against live Gibwork state and prints the
 * result. Calls only tasks.list and tasks.get — nothing here writes, signs,
 * or moves funds.
 *
 * Exits UNRESOLVED (31) when an interrupted operation is outstanding, so the
 * gate `apply` enforces is visible before you get there.
 */
export async function planCommand(runtime: Runtime, options: PlanOptions): Promise<void> {
  const { client, walletAddress, environment, credentialSource } = runtime;

  const desired = loadBounties(options.file);
  const state = loadState();
  assertStateMatches(state, walletAddress, environment);

  process.stdout.write(
    `\nwallet ${walletAddress}  ·  ${environment}  ·  credentials from ${credentialSource.kind}\n`,
  );

  const { live } = await fetchLiveTasks(client, state);
  const plan = computePlan({ desired, live, state });

  process.stdout.write(renderPlan(plan));

  if (state.pending.length > 0) {
    process.stdout.write(renderPending(state.pending));
    process.exitCode = EXIT.UNRESOLVED;
  }
}
