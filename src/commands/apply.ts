import { createInterface } from 'node:readline/promises';
import { GibworkAmbiguousSubmitError } from '@gibwork/sdk';
import { computePlan } from '../lib/diff.js';
import { EXIT, normalizeError } from '../lib/errors.js';
import { execCreate, execRefund, execUpdate } from '../lib/executor.js';
import type { ExecutorDeps } from '../lib/executor.js';
import { fetchLiveTasks } from '../lib/live.js';
import { Pacer } from '../lib/pacer.js';
import { renderPending, renderPlan } from '../lib/render.js';
import { assertStateMatches, loadState, saveState, stampState } from '../lib/state.js';
import { loadBounties } from '../lib/yaml.js';
import type { Runtime } from '../runtime.js';
import type { SyncState } from '../types.js';
import { isNoOp } from '../types.js';

export interface ApplyOptions {
  file: string;
  /** Skip the interactive confirmation. For CI. */
  yes?: boolean;
}

async function confirm(question: string): Promise<boolean> {
  // Refuse rather than hang when there is nobody to answer. @gibwork/cli
  // checks both streams, so match it.
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error('No TTY available to confirm. Re-run with --yes to apply without prompting.');
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

/** Turns a failure into recovery instructions instead of a bare stack trace. */
function reportFailure(error: unknown): void {
  if (error instanceof GibworkAmbiguousSubmitError) {
    const { operation, taskId, intentId, environment } = error.context;
    process.stderr.write(
      [
        '',
        'AMBIGUOUS SUBMIT — the transaction may or may not have landed.',
        `  operation:   ${operation}`,
        `  task:        ${taskId ?? 'unknown'}`,
        `  intent:      ${intentId}`,
        `  environment: ${environment ?? 'unknown'}`,
        '',
        'This has been recorded in .gibwork/state.json. Do NOT re-run apply.',
        'Run `gibwork-sync status` to read the real state back from Gibwork.',
        '',
      ].join('\n'),
    );
    return;
  }

  const { code, message } = normalizeError(error);
  process.stderr.write(
    `\napply failed [${code}]: ${message}\n\nRun \`gibwork-sync status\` before retrying.\n\n`,
  );
}

/**
 * Reconciles live Gibwork state to match bounties.yaml.
 *
 * Order of operations is deliberate:
 *   1. refuse to start if a previous run left anything unresolved
 *   2. recompute the plan (never trust a stale one)
 *   3. confirm
 *   4. updates first — they are free and sign nothing, so a crash during the
 *      expensive phase still banks them
 *   5. creates, then refunds, each with the prepare/persist/sign/submit barrier
 *
 * Exit codes follow @gibwork/cli: 0 applied · 30 blocked entries remain
 * · 31 unresolved operations · 2/10/20/21/22 for usage, credential, API,
 * network and ambiguous-submit failures.
 */
export async function applyCommand(runtime: Runtime, options: ApplyOptions): Promise<void> {
  const { client, signer, walletAddress, environment, credentialSource } = runtime;

  const initial = loadState();

  // (1) The watchdog gate. Before any network call, before any money.
  if (initial.pending.length > 0) {
    process.stdout.write(renderPending(initial.pending));
    process.stderr.write('apply refused: resolve the operations above first.\n');
    process.exitCode = EXIT.UNRESOLVED;
    return;
  }

  const desired = loadBounties(options.file);
  assertStateMatches(initial, walletAddress, environment);

  process.stdout.write(
    `\nwallet ${walletAddress}  ·  ${environment}  ·  credentials from ${credentialSource.kind}\n`,
  );

  // (2) Recompute. The plan you confirm is the plan that runs.
  const { live } = await fetchLiveTasks(client, initial);
  const plan = computePlan({ desired, live, state: initial });
  process.stdout.write(renderPlan(plan));

  if (isNoOp(plan)) {
    if (plan.blocked.length > 0) process.exitCode = EXIT.BLOCKED;
    return;
  }

  // (3) Confirm.
  if (!options.yes) {
    const approved = await confirm(`Apply these changes to ${environment}?`);
    if (!approved) {
      process.stdout.write('Aborted. Nothing was changed.\n');
      return;
    }
  }

  let state: SyncState = stampState(initial, walletAddress, environment);
  saveState(state);

  const deps: ExecutorDeps = {
    client,
    signer,
    pacer: new Pacer(),
    save: (next) => saveState(next),
    log: (message) => process.stdout.write(`  ${message}\n`),
  };

  let unresolved = 0;
  process.stdout.write('\n');

  try {
    // (4) Cheap and unsigned first.
    for (const update of plan.toUpdate) {
      state = (await execUpdate(deps, state, update)).state;
    }

    // (5) Then the operations that move funds.
    for (const entry of plan.toCreate) {
      const result = await execCreate(deps, state, entry);
      state = result.state;
      if (result.outcome === 'unresolved') unresolved += 1;
    }

    for (const target of plan.toRefund) {
      const result = await execRefund(deps, state, target);
      state = result.state;
      if (result.outcome === 'unresolved') unresolved += 1;
    }
  } catch (error) {
    // The executor already persisted a marker before anything was signed.
    reportFailure(error);
    process.exitCode = normalizeError(error).exitCode;
    return;
  }

  process.stdout.write(
    `\nApplied: ${plan.toCreate.length} created, ${plan.toUpdate.length} updated, ` +
      `${plan.toRefund.length} refunded.\n`,
  );

  if (unresolved > 0) {
    process.stdout.write(
      `\n${unresolved} operation(s) did not reach a confirmed state. ` +
        'Run `gibwork-sync status` to resolve them.\n',
    );
    process.exitCode = EXIT.UNRESOLVED;
  } else if (plan.blocked.length > 0) {
    process.exitCode = EXIT.BLOCKED;
  }

  process.stdout.write('\n');
}
