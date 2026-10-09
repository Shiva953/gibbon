/**
 * Paces requests against the per-wallet limits: prepare 2/minute, submit
 * 5/minute. Exceeding them fails mid-apply, which for a signed operation is
 * the ambiguous state this tool exists to avoid — so we wait rather than retry.
 *
 * `sleep` and `now` are injectable so tests need no real time.
 *
 * The intervals must be strictly GREATER than 60000/N: spacing exactly 60/N
 * apart puts N+1 requests in a sliding 60s window (0s, 30s and 60s all land in
 * [0,60]), which is how a third refund hit HTTP 429 on a live stage run.
 */
export declare const PREPARE_INTERVAL_MS = 35000;
export declare const SUBMIT_INTERVAL_MS = 16000;
export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;
/** Interruptible: a 35s pace wait must not swallow Ctrl-C. */
export declare const realSleep: Sleep;
export interface PacerOptions {
    sleep?: Sleep;
    now?: () => number;
    prepareIntervalMs?: number;
    submitIntervalMs?: number;
    signal?: AbortSignal;
}
export declare class Pacer {
    private lastPrepare;
    private lastSubmit;
    private readonly sleep;
    private readonly now;
    private readonly prepareIntervalMs;
    private readonly submitIntervalMs;
    private readonly signal;
    constructor(options?: PacerOptions);
    prepare(): Promise<void>;
    submit(): Promise<void>;
    private gate;
    /**
     * Honors a Retry-After value, which the API may send as seconds or as an
     * HTTP date. An unparseable value falls back to one prepare interval.
     */
    backoff(retryAfter?: string): Promise<void>;
    /**
     * Waits and retries once on HTTP 429. Only for calls that move no money: a
     * 429 was rejected before processing, so re-issuing a prepare is harmless,
     * but a submit must be resolved through `status`, never retried.
     */
    withRetry<T>(operation: () => Promise<T>): Promise<T>;
}
export declare function parseRetryAfter(retryAfter: string | undefined, now: number): number | null;
//# sourceMappingURL=pacer.d.ts.map