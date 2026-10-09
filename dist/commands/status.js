import { EXIT } from '../lib/errors.js';
import { emitJson } from '../lib/render.js';
import { resolveOperation } from '../lib/resolve.js';
import { assertStateMatches, loadState, saveState } from '../lib/state.js';
import { loadBounties } from '../lib/yaml.js';
const SYMBOL = {
    'never-landed': 'x',
    'in-flight': '~',
    succeeded: 'v',
    'rolled-back': 'x',
};
/**
 * The reconciliation watchdog: reads back every operation a previous `apply`
 * started but never confirmed, and settles the local record against what
 * Gibwork shows. Only ever READS from the API, but rewrites
 * .gibwork/state.json — which is what unblocks `apply`.
 */
export async function statusCommand(runtime, options) {
    const { client, walletAddress, environment, credentialSource, signal, output } = runtime;
    const state = loadState();
    if (state.pending.length === 0) {
        const tracked = Object.keys(state.tasks).length;
        if (output.json) {
            emitJson({ wallet: walletAddress, environment, resolved: [], pending: 0, tracked });
        }
        else {
            process.stdout.write(`\nNo unresolved operations. ${tracked} bounty(s) tracked in .gibwork/state.json.\n\n`);
        }
        return;
    }
    // Only needed to hash an adopted task; a missing file must never stop recovery.
    let entriesById = new Map();
    try {
        entriesById = new Map(loadBounties(options.file).map((entry) => [entry.id, entry]));
    }
    catch {
        if (!output.json && !output.quiet) {
            process.stdout.write(`\n(could not read ${options.file}; resolving without it)\n`);
        }
    }
    assertStateMatches(state, walletAddress, environment);
    if (!output.json && !output.quiet) {
        process.stdout.write(`\nwallet ${walletAddress}  ·  ${environment}  ·  credentials from ${credentialSource}\n` +
            `\nResolving ${state.pending.length} unresolved operation(s)...\n\n`);
    }
    let next = state;
    const resolutions = [];
    // Iterate a snapshot: `next` is rewritten as each operation settles.
    for (const op of [...state.pending]) {
        const result = await resolveOperation(client, next, op, entriesById.get(op.id), signal);
        next = result.state;
        resolutions.push(result.resolution);
        if (!output.json) {
            const { verdict, detail } = result.resolution;
            process.stdout.write(`  ${SYMBOL[verdict]} ${op.kind.padEnd(7)} ${op.id.padEnd(16)} ${detail}\n`);
            process.stdout.write(`            task ${op.taskId ?? 'unknown'}\n`);
        }
    }
    const asJson = () => ({
        wallet: walletAddress,
        environment,
        dryRun: options.dryRun ?? false,
        resolved: resolutions.map((r) => ({
            id: r.op.id,
            kind: r.op.kind,
            taskId: r.op.taskId ?? null,
            verdict: r.verdict,
            detail: r.detail,
            cleared: r.cleared,
        })),
        pending: next.pending.length,
    });
    if (options.dryRun) {
        if (output.json)
            emitJson(asJson());
        else
            process.stdout.write('\n--dry-run: .gibwork/state.json was not modified.\n\n');
        return;
    }
    saveState(next);
    const stillPending = next.pending.length;
    if (output.json) {
        emitJson(asJson());
        if (stillPending > 0)
            process.exitCode = EXIT.UNRESOLVED;
        return;
    }
    if (stillPending > 0) {
        process.stdout.write(`\n${stillPending} operation(s) still settling. ` +
            'apply stays blocked until they clear — re-run status shortly.\n\n');
        process.exitCode = EXIT.UNRESOLVED;
        return;
    }
    const adopted = resolutions.filter((r) => r.verdict === 'succeeded').length;
    const retryable = resolutions.filter((r) => r.verdict === 'never-landed' || r.verdict === 'rolled-back').length;
    process.stdout.write(`\nAll clear. ${adopted} confirmed, ${retryable} safe to apply again.\n` +
        'Run `gibbon plan` to see what is left to do.\n\n');
}
//# sourceMappingURL=status.js.map