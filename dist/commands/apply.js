import { createInterface } from 'node:readline/promises';
import { GibworkAmbiguousSubmitError } from '@gibwork/sdk';
import { computePlan } from '../lib/diff.js';
import { CliError, EXIT, normalizeError } from '../lib/errors.js';
import { execCreate, execRefund, execUpdate, parseFaultPauseMs } from '../lib/executor.js';
import { fetchLiveTasks } from '../lib/live.js';
import { Pacer } from '../lib/pacer.js';
import { emitJson, pendingToJson, planToJson, renderPending, renderPlan } from '../lib/render.js';
import { assertStateMatches, loadState, saveState, stampState } from '../lib/state.js';
import { loadBounties } from '../lib/yaml.js';
import { isNoOp } from '../types.js';
async function confirm(question) {
    // Refuse rather than hang when there is nobody to answer.
    if (!process.stdin.isTTY || !process.stderr.isTTY) {
        throw new Error('No TTY available to confirm. Re-run with --yes to apply without prompting.');
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = await rl.question(`${question} [y/N] `);
        return answer.trim().toLowerCase() === 'y';
    }
    finally {
        rl.close();
    }
}
/** Turns a failure into recovery instructions instead of a bare stack trace. */
function reportFailure(error) {
    if (error instanceof GibworkAmbiguousSubmitError) {
        const { operation, taskId, intentId, environment } = error.context;
        process.stderr.write([
            '',
            'AMBIGUOUS SUBMIT — the transaction may or may not have landed.',
            `  operation:   ${operation}`,
            `  task:        ${taskId ?? 'unknown'}`,
            `  intent:      ${intentId}`,
            `  environment: ${environment ?? 'unknown'}`,
            '',
            'This has been recorded in .gibwork/state.json. Do NOT re-run apply.',
            'Run `gibbon status` to read the real state back from Gibwork.',
            '',
        ].join('\n'));
        return;
    }
    const { code, message } = normalizeError(error);
    process.stderr.write(`\napply failed [${code}]: ${message}\n\nRun \`gibbon status\` before retrying.\n\n`);
}
/**
 * Reconciles live Gibwork state to match bounties.yaml.
 *
 * The order is deliberate: refuse to start while a previous run is unresolved,
 * recompute the plan, confirm, then updates before creates and refunds.
 *
 * Exit codes follow @gibwork/cli: 0 applied · 30 blocked · 31 unresolved ·
 * 2/10/20/21/22 for usage, credential, API, network and ambiguous submit.
 */
export async function applyCommand(runtime, options) {
    const { client, signer, walletAddress, environment, credentialSource, signal, output } = runtime;
    // A prompt would corrupt the JSON stream, so automation must say so up front.
    if (output.json && !options.yes) {
        throw new CliError('--json requires --yes, because apply cannot prompt.', 'USAGE_ERROR', EXIT.USAGE);
    }
    // Crash-test switch. Parsed up front so a bad value fails before any network call.
    const faultPauseMs = parseFaultPauseMs(process.env.GIBBON_FAULT_PAUSE_MS);
    const initial = loadState();
    // The watchdog gate, before any network call or any money.
    if (initial.pending.length > 0) {
        if (output.json) {
            emitJson({
                wallet: walletAddress,
                environment,
                applied: false,
                reason: 'unresolved-operations',
                pending: pendingToJson(initial.pending),
            });
        }
        else {
            process.stdout.write(renderPending(initial.pending));
            process.stderr.write('apply refused: resolve the operations above first.\n');
        }
        process.exitCode = EXIT.UNRESOLVED;
        return;
    }
    const desired = loadBounties(options.file);
    assertStateMatches(initial, walletAddress, environment);
    if (!output.json && !output.quiet) {
        process.stdout.write(`\nwallet ${walletAddress}  ·  ${environment}  ·  credentials from ${credentialSource}\n`);
    }
    // Recompute: the plan you confirm is the plan that runs.
    const { live } = await fetchLiveTasks(client, initial, signal);
    const plan = computePlan({ desired, live, state: initial });
    if (!output.json)
        process.stdout.write(renderPlan(plan));
    if (isNoOp(plan)) {
        if (output.json) {
            emitJson({ wallet: walletAddress, environment, applied: true, ...planToJson(plan) });
        }
        if (plan.blocked.length > 0)
            process.exitCode = EXIT.BLOCKED;
        return;
    }
    if (!options.yes) {
        const approved = await confirm(`Apply these changes to ${environment}?`);
        if (!approved) {
            process.stdout.write('Aborted. Nothing was changed.\n');
            return;
        }
    }
    let state = stampState(initial, walletAddress, environment);
    saveState(state);
    const deps = {
        client,
        signer,
        pacer: new Pacer(signal ? { signal } : {}),
        ...(signal ? { signal } : {}),
        save: (next) => saveState(next),
        ...(output.json || output.quiet
            ? {}
            : { log: (message) => process.stdout.write(`  ${message}\n`) }),
        ...(faultPauseMs > 0 ? { faultPauseMs } : {}),
    };
    let unresolved = 0;
    if (!output.json && !output.quiet)
        process.stdout.write('\n');
    if (faultPauseMs > 0) {
        // Always said out loud: a run with injected pauses must never pass for a normal one.
        process.stderr.write(`  fault injection on (GIBBON_FAULT_PAUSE_MS=${faultPauseMs}): each submit is held ` +
            'before it is recorded.\n');
    }
    try {
        // Updates sign nothing, so running them first banks them against a later crash.
        for (const update of plan.toUpdate) {
            state = (await execUpdate(deps, state, update)).state;
        }
        // Then the operations that move funds.
        for (const entry of plan.toCreate) {
            const result = await execCreate(deps, state, entry);
            state = result.state;
            if (result.outcome === 'unresolved')
                unresolved += 1;
        }
        for (const target of plan.toRefund) {
            const result = await execRefund(deps, state, target);
            state = result.state;
            if (result.outcome === 'unresolved')
                unresolved += 1;
        }
    }
    catch (error) {
        // The executor already persisted a marker before anything was signed.
        if (!output.json)
            reportFailure(error);
        process.exitCode = normalizeError(error).exitCode;
        return;
    }
    if (output.json) {
        emitJson({
            wallet: walletAddress,
            environment,
            applied: true,
            created: plan.toCreate.length,
            updated: plan.toUpdate.length,
            refunded: plan.toRefund.length,
            unresolved,
            blocked: plan.blocked.length,
        });
    }
    else {
        process.stdout.write(`\nApplied: ${plan.toCreate.length} created, ${plan.toUpdate.length} updated, ` +
            `${plan.toRefund.length} refunded.\n`);
        if (unresolved > 0) {
            process.stdout.write(`\n${unresolved} operation(s) did not reach a confirmed state. ` +
                'Run `gibbon status` to resolve them.\n');
        }
        process.stdout.write('\n');
    }
    if (unresolved > 0)
        process.exitCode = EXIT.UNRESOLVED;
    else if (plan.blocked.length > 0)
        process.exitCode = EXIT.BLOCKED;
}
//# sourceMappingURL=apply.js.map