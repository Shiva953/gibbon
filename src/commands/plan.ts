import { computePlan } from '../lib/diff.js';
import { EXIT } from '../lib/errors.js';
import { fetchLiveTasks } from '../lib/live.js';
import { emitJson, pendingToJson, planToJson, renderPending, renderPlan } from '../lib/render.js';
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
  const { client, walletAddress, environment, credentialSource, profileName, signal, output } =
    runtime;

  const desired = loadBounties(options.file);
  const state = loadState();
  assertStateMatches(state, walletAddress, environment);

  if (!output.json && !output.quiet) {
    process.stdout.write(
      `\nwallet ${walletAddress}  ·  ${environment}  ·  credentials from ${credentialSource}\n`,
    );
  }

  const { live } = await fetchLiveTasks(client, state, signal);
  const plan = computePlan({ desired, live, state });

  if (output.json) {
    emitJson({
      wallet: walletAddress,
      environment,
      profile: profileName,
      ...planToJson(plan),
      pending: pendingToJson(state.pending),
    });
  } else {
    process.stdout.write(renderPlan(plan));
    if (state.pending.length > 0) process.stdout.write(renderPending(state.pending));
  }

  if (state.pending.length > 0) process.exitCode = EXIT.UNRESOLVED;
}
