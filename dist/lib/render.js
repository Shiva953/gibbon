import { isNoOp } from '../types.js';
function shortId(taskId) {
    return taskId.slice(0, 8);
}
/** Renders a plan as reviewable terminal output. Pure: returns a string. */
export function renderPlan(plan) {
    const lines = [''];
    for (const entry of plan.toCreate) {
        lines.push(`  + create   ${entry.id.padEnd(16)} ${entry.amount}`);
    }
    for (const update of plan.toUpdate) {
        lines.push(`  ~ update   ${update.entry.id.padEnd(16)} ${update.changes.join(', ')}` +
            `  (${shortId(update.taskId)})`);
    }
    for (const refund of plan.toRefund) {
        lines.push(`  - refund   ${refund.id.padEnd(16)} ${refund.title ?? ''}  (${shortId(refund.taskId)})`);
    }
    for (const block of plan.blocked) {
        lines.push(`  ! blocked  ${block.id.padEnd(16)} (${shortId(block.taskId)})`);
        lines.push(`             ${block.reason}`);
    }
    if (plan.unchanged.length > 0) {
        lines.push(`    ${plan.unchanged.length} unchanged`);
    }
    lines.push('');
    if (isNoOp(plan) && plan.blocked.length === 0) {
        lines.push('No changes. bounties.yaml matches live Gibwork state.');
    }
    else {
        const parts = [
            `${plan.toCreate.length} to create`,
            `${plan.toUpdate.length} to update`,
            `${plan.toRefund.length} to refund`,
        ];
        if (plan.blocked.length > 0)
            parts.push(`${plan.blocked.length} blocked`);
        lines.push(`Plan: ${parts.join(', ')}.`);
    }
    lines.push('');
    return lines.join('\n');
}
/** Renders unresolved operations. Used by `status` and by `apply`'s gate. */
export function renderPending(pending) {
    const lines = ['', 'Unresolved operations from a previous run:', ''];
    for (const op of pending) {
        lines.push(`  ! ${op.kind.padEnd(7)} ${op.id.padEnd(16)} task ${op.taskId ?? 'unknown'}`);
        lines.push(`            intent ${op.intentId ?? 'unknown'}  started ${op.startedAt}`);
        if (op.lastKnownStatus)
            lines.push(`            last known status: ${op.lastKnownStatus}`);
    }
    lines.push('');
    lines.push('Run `gibbon status` to resolve them before applying again.');
    lines.push('');
    return lines.join('\n');
}
/* Machine-readable output. The envelope matches @gibwork/cli exactly —
   {"ok":true,"data":...} / {"ok":false,"error":{code,message}} — so a script
   can parse either tool's output with the same code path. */
/** Writes one success envelope: a single, newline-terminated line. */
export function emitJson(data) {
    process.stdout.write(`${JSON.stringify({ ok: true, data })}\n`);
}
/** A stable, serializable view of a plan. */
export function planToJson(plan) {
    return {
        summary: {
            create: plan.toCreate.length,
            update: plan.toUpdate.length,
            refund: plan.toRefund.length,
            blocked: plan.blocked.length,
            unchanged: plan.unchanged.length,
        },
        create: plan.toCreate.map((entry) => ({
            id: entry.id,
            title: entry.title,
            amount: entry.amount,
        })),
        update: plan.toUpdate.map((update) => ({
            id: update.entry.id,
            taskId: update.taskId,
            changes: update.changes,
        })),
        refund: plan.toRefund.map((refund) => ({
            id: refund.id,
            taskId: refund.taskId,
            ...(refund.title ? { title: refund.title } : {}),
        })),
        blocked: plan.blocked.map((block) => ({
            id: block.id,
            taskId: block.taskId,
            fields: block.fields,
            reason: block.reason,
        })),
        unchanged: plan.unchanged.map((entry) => entry.id),
    };
}
/** A stable, serializable view of unresolved operations. */
export function pendingToJson(pending) {
    return pending.map((op) => ({
        id: op.id,
        kind: op.kind,
        taskId: op.taskId ?? null,
        intentId: op.intentId ?? null,
        startedAt: op.startedAt,
        ...(op.lastKnownStatus ? { lastKnownStatus: op.lastKnownStatus } : {}),
    }));
}
/** A minimal LCS line diff, so `agent` can show its edit without needing git. */
export function diffLines(before, after) {
    const a = before.split('\n');
    const b = after.split('\n');
    // lcs[i][j] = length of the longest common subsequence of a[i:] and b[j:]
    const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i -= 1) {
        for (let j = b.length - 1; j >= 0; j -= 1) {
            lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
        }
    }
    const out = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            out.push(`  ${a[i]}`);
            i += 1;
            j += 1;
        }
        else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
            out.push(`- ${a[i]}`);
            i += 1;
        }
        else {
            out.push(`+ ${b[j]}`);
            j += 1;
        }
    }
    while (i < a.length)
        out.push(`- ${a[i++]}`);
    while (j < b.length)
        out.push(`+ ${b[j++]}`);
    return out;
}
//# sourceMappingURL=render.js.map