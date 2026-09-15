/**
 * Paces requests against the documented per-wallet limits: prepare 2/minute,
 * submit 5/minute. Exceeding them would fail mid-apply, which for a signed
 * operation is exactly the ambiguous state this tool exists to avoid — so the
 * executor waits rather than retries.
 *
 * `sleep` is injectable so tests can assert pacing without real time passing.
 */
export const PREPARE_INTERVAL_MS = 30_000; // 2 per minute
export const SUBMIT_INTERVAL_MS = 12_000; // 5 per minute

export type Sleep = (ms: number) => Promise<void>;

const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Pacer {
  private lastPrepare = 0;
  private lastSubmit = 0;

  constructor(
    private readonly sleep: Sleep = realSleep,
    private readonly now: () => number = Date.now,
    private readonly prepareIntervalMs: number = PREPARE_INTERVAL_MS,
    private readonly submitIntervalMs: number = SUBMIT_INTERVAL_MS,
  ) {}

  async prepare(): Promise<void> {
    this.lastPrepare = await this.gate(this.lastPrepare, this.prepareIntervalMs);
  }

  async submit(): Promise<void> {
    this.lastSubmit = await this.gate(this.lastSubmit, this.submitIntervalMs);
  }

  private async gate(last: number, intervalMs: number): Promise<number> {
    if (last !== 0) {
      const elapsed = this.now() - last;
      if (elapsed < intervalMs) await this.sleep(intervalMs - elapsed);
    }
    return this.now();
  }

  /**
   * Honors a Retry-After value, which the API may send as seconds or as an
   * HTTP date. An unparseable value falls back to one prepare interval.
   */
  async backoff(retryAfter?: string): Promise<void> {
    await this.sleep(parseRetryAfter(retryAfter, this.now()) ?? this.prepareIntervalMs);
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
