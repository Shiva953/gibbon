/**
 * Core types. The constraint that drives most of the design: `UpdateTaskInput`
 * accepts only `content`, `allowOnlyVerifiedSubmissions` and `deadline` —
 * title, tags and amount are immutable once a task is live. So the diff engine
 * must tell "changed and updatable" from "changed but impossible to apply".
 */

/** Mainnet USDC. Used when an entry does not name its own mint. */
export const DEFAULT_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/**
 * The reward range Gibwork accepts, per the stage API's own 400. Checked at
 * parse time so an out-of-range amount fails before any network call.
 */
export const MIN_BOUNTY_AMOUNT = 1;
export const MAX_BOUNTY_AMOUNT = 100_000;

/** Fields the Gibwork API allows changing on an already-live task. */
export const UPDATABLE_FIELDS = [
  'content',
  'deadline',
  'allowOnlyVerifiedSubmissions',
] as const;
export type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

/** Fields that are fixed for the life of a task once it has been created. */
export const IMMUTABLE_FIELDS = ['title', 'tags', 'amount', 'mint', 'minSubmission'] as const;
export type ImmutableField = (typeof IMMUTABLE_FIELDS)[number];

/**
 * One entry in bounties.yaml.
 *
 * `id` is a stable, human-chosen key — NOT the Gibwork UUID — and is what
 * matches a line in this file to a real task across runs, via the id -> taskId
 * mapping in .gibwork/state.json. Changing an applied entry's `id` reads as
 * "refund the old one, create a new one".
 */
export interface BountyEntry {
  id: string;
  /** Optional local reference, e.g. "#142". Never sent to Gibwork. */
  issue?: string;
  title: string;
  content: string;
  tags: string[];
  /** Decimal string in whole tokens, e.g. "40.00". */
  amount: string;
  /** SPL mint for the reward. Defaults to DEFAULT_MINT (USDC). */
  mint?: string;
  /** Decimal string, e.g. "5.00". */
  minSubmission?: string;
  /** ISO 8601. Updatable after creation. */
  deadline?: string;
  /** Updatable after creation. */
  allowOnlyVerifiedSubmissions?: boolean;
}

/** Which environment a wallet's tasks live in. Stage and production never mix. */
export type Environment = 'stage' | 'production';

/**
 * An apply operation that started but has not been confirmed finished.
 *
 * The heart of the interrupted-transaction protection: `apply` writes one
 * BEFORE any signed operation and clears it only on a confirmed terminal
 * state. Anything left behind blocks the next `apply` until `status` resolves it.
 */
export interface PendingOperation {
  /** The bounties.yaml `id` this operation was for. */
  id: string;
  kind: 'create' | 'update' | 'refund';
  startedAt: string;
  /** Known for update/refund; for create it only exists once the API replies. */
  taskId?: string;
  /** Returned by prepare; the handle needed to re-read an interrupted intent. */
  intentId?: string;
  txHash?: string;
  /** Last status we observed, if we got far enough to observe one. */
  lastKnownStatus?: string;
  /** Populated when the operation failed loudly rather than vanishing. */
  error?: string;
}

/** A task gibwork-sync has successfully created and is tracking. */
export interface TrackedTask {
  taskId: string;
  /** Hash of the applied entry, used to detect drift on the next run. */
  lastAppliedHash: string;
  /** ISO timestamp of the last confirmed successful apply. */
  lastSyncedAt: string;
}

/**
 * Local state file (.gibwork/state.json). Gitignored: it is per-wallet,
 * per-environment, and regenerable via `gibwork-sync import`.
 */
export interface SyncState {
  version: 1;
  /** Guards against pointing one state file at two different wallets. */
  wallet?: string;
  environment?: Environment;
  tasks: Record<string, TrackedTask>;
  /** Unresolved operations. A non-empty array blocks the next apply. */
  pending: PendingOperation[];
}

/** A BountyEntry with every optional field resolved to its effective value. */
export interface ResolvedEntry extends BountyEntry {
  mint: string;
  minSubmission: string;
}

/**
 * The live view of one task, narrowed to the fields the diff cares about and
 * normalized into the representation the YAML uses. Deliberately not the SDK's
 * `TaskDetails`, so the diff engine stays pure with no SDK import.
 */
export interface LiveTask {
  taskId: string;
  title: string;
  content: string;
  tags: string[];
  /** Whole-token decimal string, normalized from the API's numeric amount. */
  amount: string;
  mint: string | null;
  minSubmission: string | null;
  deadline: string | null;
  allowOnlyVerifiedSubmissions: boolean;
  isOpen: boolean;
  status: string;
  canRefund: boolean;
}

/** A change the file asks for that the Gibwork API cannot perform in place. */
export interface BlockedChange {
  /** The bounties.yaml id. Present even when the entry itself was deleted. */
  id: string;
  /** Absent when the entry has been removed from the file. */
  entry?: BountyEntry;
  taskId: string;
  fields: ImmutableField[];
  reason: string;
}

/** An update the API can perform, plus exactly which fields differ. */
export interface PlannedUpdate {
  entry: BountyEntry;
  taskId: string;
  changes: UpdatableField[];
}

/** The result of diffing bounties.yaml against live Gibwork state. */
export interface Plan {
  toCreate: BountyEntry[];
  toUpdate: PlannedUpdate[];
  toRefund: { id: string; taskId: string; title?: string }[];
  unchanged: BountyEntry[];
  /** Entries whose requested change is impossible without refund + recreate. */
  blocked: BlockedChange[];
}

/** True when a plan would perform no writes. */
export function isNoOp(plan: Plan): boolean {
  return (
    plan.toCreate.length === 0 && plan.toUpdate.length === 0 && plan.toRefund.length === 0
  );
}
