import type { PendingOperation, Plan } from '../types.js';
import { isNoOp } from '../types.js';

function shortId(taskId: string): string {
  return taskId.slice(0, 8);
}

/** Renders a plan as reviewable terminal output. Pure: returns a string. */
export function renderPlan(plan: Plan): string {
  const lines: string[] = [''];

  for (const entry of plan.toCreate) {
    lines.push(`  + create   ${entry.id.padEnd(16)} ${entry.amount}`);
  }

  for (const update of plan.toUpdate) {
    lines.push(
      `  ~ update   ${update.entry.id.padEnd(16)} ${update.changes.join(', ')}` +
        `  (${shortId(update.taskId)})`,
    );
  }

  for (const refund of plan.toRefund) {
    lines.push(
      `  - refund   ${refund.id.padEnd(16)} ${refund.title ?? ''}  (${shortId(refund.taskId)})`,
    );
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
  } else {
    const parts = [
      `${plan.toCreate.length} to create`,
      `${plan.toUpdate.length} to update`,
      `${plan.toRefund.length} to refund`,
    ];
    if (plan.blocked.length > 0) parts.push(`${plan.blocked.length} blocked`);
    lines.push(`Plan: ${parts.join(', ')}.`);
  }

  lines.push('');
  return lines.join('\n');
}

/** Renders unresolved operations. Used by `status` and by `apply`'s gate. */
export function renderPending(pending: PendingOperation[]): string {
  const lines = ['', 'Unresolved operations from a previous run:', ''];
  for (const op of pending) {
    lines.push(`  ! ${op.kind.padEnd(7)} ${op.id.padEnd(16)} task ${op.taskId ?? 'unknown'}`);
    lines.push(`            intent ${op.intentId ?? 'unknown'}  started ${op.startedAt}`);
    if (op.lastKnownStatus) lines.push(`            last known status: ${op.lastKnownStatus}`);
  }
  lines.push('');
  lines.push('Run `gibwork-sync status` to resolve them before applying again.');
  lines.push('');
  return lines.join('\n');
}
