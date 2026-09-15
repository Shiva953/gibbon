import { CliError, EXIT } from './errors.js';

/**
 * Paces requests against the documented per-wallet limits: prepare 2/minute,
 * submit 5/minute. Exceeding them would fail mid-apply, which for a signed
 * operation is exactly the ambiguous state this tool exists to avoid — so the
 * executor waits rather than retries.
 *
 * `sleep` and `now` are injectable so tests can assert pacing without real
 * time passing.
 */
export const PREPARE_INTERVAL_MS = 30_000; // 2 per minute
export const SUBMIT_INTERVAL_MS = 12_000; // 5 per minute

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

function cancelled(): CliError {
  return new CliError('Cancelled.', 'CANCELLED', EXIT.CANCELLED);
}

/** Interruptible: a 30s pace wait must not swallow Ctrl-C. */
const realSleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(cancelled());
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(cancelled());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export interface PacerOptions {
  sleep?: Sleep;
  now?: () => number;
  prepareIntervalMs?: number;
  submitIntervalMs?: number;
  signal?: AbortSignal;
}

export class Pacer {
  private lastPrepare = 0;
  private lastSubmit = 0;

  private readonly sleep: Sleep;
  private readonly now: () => number;
  private readonly prepareIntervalMs: number;
  private readonly submitIntervalMs: number;
  private readonly signal: AbortSignal | undefined;

  constructor(options: PacerOptions = {}) {
    this.sleep = options.sleep ?? realSleep;
    this.now = options.now ?? Date.now;
    this.prepareIntervalMs = options.prepareIntervalMs ?? PREPARE_INTERVAL_MS;
    this.submitIntervalMs = options.submitIntervalMs ?? SUBMIT_INTERVAL_MS;
    this.signal = options.signal;
  }

  async prepare(): Promise<void> {
    this.lastPrepare = await this.gate(this.lastPrepare, this.prepareIntervalMs);
  }

  async submit(): Promise<void> {
    this.lastSubmit = await this.gate(this.lastSubmit, this.submitIntervalMs);
  }

  private async gate(last: number, intervalMs: number): Promise<number> {
    // Checked before waiting and again after, so a cancel during the wait stops
    // the run before the next signed operation starts.
    if (this.signal?.aborted) throw cancelled();
    if (last !== 0) {
      const elapsed = this.now() - last;
      if (elapsed < intervalMs) await this.sleep(intervalMs - elapsed, this.signal);
    }
    if (this.signal?.aborted) throw cancelled();
    return this.now();
  }

  /**
   * Honors a Retry-After value, which the API may send as seconds or as an
   * HTTP date. An unparseable value falls back to one prepare interval.
   */
  async backoff(retryAfter?: string): Promise<void> {
    await this.sleep(parseRetryAfter(retryAfter, this.now()) ?? this.prepareIntervalMs, this.signal);
  }
}

export function parseRetryAfter(retryAfter: string | undefined, now: number): number | null {
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(retryAfter);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}
