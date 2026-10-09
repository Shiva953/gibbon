import type { PendingOperation, Plan } from '../types.js';
/** Renders a plan as reviewable terminal output. Pure: returns a string. */
export declare function renderPlan(plan: Plan): string;
/** Renders unresolved operations. Used by `status` and by `apply`'s gate. */
export declare function renderPending(pending: PendingOperation[]): string;
/** Writes one success envelope: a single, newline-terminated line. */
export declare function emitJson(data: unknown): void;
/** A stable, serializable view of a plan. */
export declare function planToJson(plan: Plan): Record<string, unknown>;
/** A stable, serializable view of unresolved operations. */
export declare function pendingToJson(pending: PendingOperation[]): Record<string, unknown>[];
/** A minimal LCS line diff, so `agent` can show its edit without needing git. */
export declare function diffLines(before: string, after: string): string[];
//# sourceMappingURL=render.d.ts.map