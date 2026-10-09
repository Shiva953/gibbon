import { computePlan } from '../lib/diff.js';
import { EXIT } from '../lib/errors.js';
import { fetchLiveTasks } from '../lib/live.js';
import { emitJson, pendingToJson, planToJson, renderPending, renderPlan } from '../lib/render.js';
import { assertStateMatches, loadState } from '../lib/state.js';
import { loadBounties } from '../lib/yaml.js';
/**
 * Diffs bounties.yaml against live Gibwork state and prints the result.
 * Read-only: calls only tasks.list and tasks.get, and signs nothing.
 */
export async function planCommand(runtime, options) {
    const { client, walletAddress, environment, credentialSource, profileName, signal, output } = runtime;
    const desired = loadBounties(options.file);
    const state = loadState();
    assertStateMatches(state, walletAddress, environment);
    if (!output.json && !output.quiet) {
        process.stdout.write(`\nwallet ${walletAddress}  ·  ${environment}  ·  credentials from ${credentialSource}\n`);
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
    }
    else {
        process.stdout.write(renderPlan(plan));
        if (state.pending.length > 0)
            process.stdout.write(renderPending(state.pending));
    }
    // Both are reportable in CI. Unresolved wins: it blocks apply entirely.
    if (plan.blocked.length > 0)
        process.exitCode = EXIT.BLOCKED;
    if (state.pending.length > 0)
        process.exitCode = EXIT.UNRESOLVED;
}
//# sourceMappingURL=plan.js.map