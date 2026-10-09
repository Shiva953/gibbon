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
];
/** Fields that are fixed for the life of a task once it has been created. */
export const IMMUTABLE_FIELDS = ['title', 'tags', 'amount', 'mint', 'minSubmission'];
/** True when a plan would perform no writes. */
export function isNoOp(plan) {
    return (plan.toCreate.length === 0 && plan.toUpdate.length === 0 && plan.toRefund.length === 0);
}
//# sourceMappingURL=types.js.map