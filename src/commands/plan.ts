import { computePlan } from '../lib/diff.js';
import { createClient } from '../lib/gibworkClient.js';
import { fetchLiveTasks } from '../lib/live.js';
import { renderPending, renderPlan } from '../lib/render.js';
import { assertStateMatches, loadState } from '../lib/state.js';
import { loadBounties } from '../lib/yaml.js';
import type { Environment } from '../types.js';

export interface PlanOptions {
  file: string;
  keypair?: string;
  env: Environment;
}

/**
 * Read-only. Diffs bounties.yaml against live Gibwork state and prints the
 * result. Calls only tasks.list and tasks.get — nothing here writes, signs,
 * or moves funds.
 *
 * Exits 3 when unresolved operations exist, so the same gate `apply` enforces
 * is visible before you get there.
 */
export async function planCommand(options: PlanOptions): Promise<void> {
  const desired = loadBounties(options.file);
  const state = loadState();

  const { client, wallet, environment, source } = createClient({
    ...(options.keypair ? { keypair: options.keypair } : {}),
    env: options.env,
  });
  assertStateMatches(state, wallet, environment);

  process.stdout.write(
    `\nwallet ${wallet}  ·  ${environment}  ·  credentials from ${source.kind}\n`,
  );

  const { live } = await fetchLiveTasks(client, state);
  const plan = computePlan({ desired, live, state });

  process.stdout.write(renderPlan(plan));

  if (state.pending.length > 0) {
    process.stdout.write(renderPending(state.pending));
    process.exitCode = 3;
  }
}
