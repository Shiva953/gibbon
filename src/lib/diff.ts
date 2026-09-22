import type {
  BlockedChange,
  BountyEntry,
  ImmutableField,
  LiveTask,
  Plan,
  PlannedUpdate,
  SyncState,
  UpdatableField,
} from '../types.js';
import { contentEquals, normalizeAmount, resolveEntry, sameOptional } from './normalize.js';

export interface DiffInput {
  /** Desired state, from bounties.yaml. */
  desired: BountyEntry[];
  /** Live state, already normalized from the SDK. */
  live: LiveTask[];
  /** Local id -> taskId mapping from .gibwork/state.json. */
  state: SyncState;
}

/** Order-insensitive tag comparison. */
function sameTags(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((tag, index) => tag === right[index]);
}

/** Immutable fields that differ between the file and the live task. */
function immutableDrift(entry: BountyEntry, live: LiveTask): ImmutableField[] {
  const resolved = resolveEntry(entry);
  const drift: ImmutableField[] = [];

  if (resolved.title !== live.title) drift.push('title');
  if (!sameTags(resolved.tags, live.tags)) drift.push('tags');
  if (normalizeAmount(resolved.amount) !== live.amount) drift.push('amount');

  // null from the API means "not reported", not "empty", so skip those.
  if (live.mint !== null && resolved.mint !== live.mint) drift.push('mint');
  if (
    live.minSubmission !== null &&
    normalizeAmount(resolved.minSubmission) !== live.minSubmission
  ) {
    drift.push('minSubmission');
  }

  return drift;
}

/**
 * Updatable fields that differ — the ones tasks.update can fix.
 *
 * An omitted optional field is UNMANAGED, not "must be empty": if we do not
 * send a field on create, we do not diff it. Gibwork assigns its own defaults
 * (a bounty created with no deadline comes back with one), and diffing those
 * yields an update that can never converge.
 */
function updatableDrift(entry: BountyEntry, live: LiveTask): UpdatableField[] {
  const drift: UpdatableField[] = [];

  if (!contentEquals(entry.content, live.content)) drift.push('content');

  if (entry.deadline !== undefined && !sameOptional(entry.deadline, live.deadline)) {
    drift.push('deadline');
  }

  if (
    entry.allowOnlyVerifiedSubmissions !== undefined &&
    entry.allowOnlyVerifiedSubmissions !== live.allowOnlyVerifiedSubmissions
  ) {
    drift.push('allowOnlyVerifiedSubmissions');
  }

  return drift;
}

/**
 * Reconciles desired (bounties.yaml) against live (Gibwork) state.
 *
 * Pure: no I/O, no SDK, no clock. Every decision that can move money is made
 * here and nowhere else, which is what makes them exhaustively table-testable.
 *
 * The rules:
 *   in file, no state mapping                  -> create
 *   in file, mapped, live missing              -> blocked (never silently recreate)
 *   in file, mapped, live closed/refunded      -> blocked (never silently recreate)
 *   in file, mapped, immutable drift           -> blocked (needs refund + recreate)
 *   in file, mapped, only updatable drift      -> update
 *   in file, mapped, no drift                  -> unchanged
 *   mapped, absent from file, live and open    -> refund
 *   mapped, absent from file, already closed   -> dropped silently
 *   live but never tracked                     -> ignored entirely
 */
export function computePlan(input: DiffInput): Plan {
  const { desired, live, state } = input;

  const liveByTaskId = new Map(live.map((task) => [task.taskId, task]));
  const desiredIds = new Set(desired.map((entry) => entry.id));

  const toCreate: BountyEntry[] = [];
  const toUpdate: PlannedUpdate[] = [];
  const toRefund: Plan['toRefund'] = [];
  const unchanged: BountyEntry[] = [];
  const blocked: BlockedChange[] = [];

  for (const entry of desired) {
    const tracked = state.tasks[entry.id];

    if (!tracked) {
      toCreate.push(entry);
      continue;
    }

    const liveTask = liveByTaskId.get(tracked.taskId);

    // Tracked, but the wallet cannot see it. Recreating risks a second
    // funded bounty, so this always needs a human.
    if (!liveTask) {
      blocked.push({
        id: entry.id,
        entry,
        taskId: tracked.taskId,
        fields: [],
        reason:
          `tracked task ${tracked.taskId} was not returned by this wallet. ` +
          'Verify it with `gibwork task get`, then remove the entry or fix state.json. ' +
          'gibwork-sync will not recreate it automatically.',
      });
      continue;
    }

    // Completed or refunded on the platform: nothing we can act on.
    if (!liveTask.isOpen) {
      blocked.push({
        id: entry.id,
        entry,
        taskId: tracked.taskId,
        fields: [],
        reason:
          `task is no longer open (status: ${liveTask.status}). ` +
          'Remove it from the file, or give the entry a new id to fund a fresh bounty.',
      });
      continue;
    }

    const immutable = immutableDrift(entry, liveTask);
    if (immutable.length > 0) {
      blocked.push({
        id: entry.id,
        entry,
        taskId: tracked.taskId,
        fields: immutable,
        reason:
          `${immutable.join(', ')} cannot be changed on a live bounty. ` +
          'Refund this bounty and create a replacement, or revert the file.',
      });
      continue;
    }

    const changes = updatableDrift(entry, liveTask);
    if (changes.length > 0) {
      toUpdate.push({ entry, taskId: tracked.taskId, changes });
    } else {
      unchanged.push(entry);
    }
  }

  // Tracked tasks the file no longer asks for. Only ever tasks gibwork-sync
  // recorded itself — an untracked live task is never touched, which is what
  // makes adopting the tool on an established wallet safe.
  for (const [id, tracked] of Object.entries(state.tasks)) {
    if (desiredIds.has(id)) continue;

    const liveTask = liveByTaskId.get(tracked.taskId);

    if (!liveTask || !liveTask.isOpen) continue;

    // Open, but not refundable by this wallet — usually pending submissions
    // holding the escrow. Skipping quietly would leave the maintainer's funds
    // locked behind an empty plan.
    if (!liveTask.canRefund) {
      blocked.push({
        id,
        taskId: tracked.taskId,
        fields: [],
        reason:
          'removed from the file, but this wallet cannot refund it right now ' +
          `(status: ${liveTask.status}). Pending submissions usually hold the escrow — ` +
          'approve or reject them, then re-run apply. The entry stays tracked until then.',
      });
      continue;
    }

    toRefund.push({ id, taskId: tracked.taskId, title: liveTask.title });
  }

  return { toCreate, toUpdate, toRefund, unchanged, blocked };
}
