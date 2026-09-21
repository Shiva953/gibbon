import { describe, expect, test } from 'bun:test';
import { GibworkApiError } from '@gibwork/sdk';
import { PREPARE_INTERVAL_MS, Pacer, SUBMIT_INTERVAL_MS, parseRetryAfter } from '../src/lib/pacer.js';

/** How many requests land in the worst-case sliding 60s window at this spacing. */
function perWindow(intervalMs: number): number {
  return Math.floor(60_000 / intervalMs) + 1;
}

describe('rate limit arithmetic', () => {
  test('spacing exactly at the limit is over it', () => {
    // The original bug: 30s spacing for a 2/min limit puts requests at
    // 0s, 30s and 60s, and the window [0,60] holds all three.
    expect(perWindow(30_000)).toBe(3);
    expect(perWindow(12_000)).toBe(6);
  });

  test('the configured intervals stay within the documented limits', () => {
    expect(perWindow(PREPARE_INTERVAL_MS)).toBeLessThanOrEqual(2); // prepare 2/min
    expect(perWindow(SUBMIT_INTERVAL_MS)).toBeLessThanOrEqual(5); // submit 5/min
  });

  test('intervals are strictly greater than the naive 60/N', () => {
    expect(PREPARE_INTERVAL_MS).toBeGreaterThan(60_000 / 2);
    expect(SUBMIT_INTERVAL_MS).toBeGreaterThan(60_000 / 5);
  });
});

function rateLimited(retryAfter?: string): GibworkApiError {
  return new GibworkApiError(429, { message: 'slow down' }, 'POST', '/tasks/prepare', undefined, retryAfter);
}

describe('withRetry', () => {
  test('waits and retries once on 429', async () => {
    const slept: number[] = [];
    const pacer = new Pacer({ sleep: async (ms) => void slept.push(ms), now: () => 0 });

    let calls = 0;
    const result = await pacer.withRetry(async () => {
      calls += 1;
      if (calls === 1) throw rateLimited('2');
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(calls).toBe(2);
    expect(slept).toEqual([2000]); // honored Retry-After: 2 seconds
  });

  test('falls back to one prepare interval when Retry-After is absent', async () => {
    const slept: number[] = [];
    const pacer = new Pacer({ sleep: async (ms) => void slept.push(ms), now: () => 0 });

    let calls = 0;
    await pacer.withRetry(async () => {
      calls += 1;
      if (calls === 1) throw rateLimited();
      return 'ok';
    });

    expect(slept).toEqual([PREPARE_INTERVAL_MS]);
  });

  test('gives up after one retry rather than hammering', async () => {
    const pacer = new Pacer({ sleep: async () => {}, now: () => 0 });
    let calls = 0;
    await expect(
      pacer.withRetry(async () => {
        calls += 1;
        throw rateLimited('1');
      }),
    ).rejects.toThrow(GibworkApiError);
    expect(calls).toBe(2);
  });

  test('rethrows anything that is not a 429 immediately', async () => {
    const pacer = new Pacer({ sleep: async () => {}, now: () => 0 });
    let calls = 0;
    await expect(
      pacer.withRetry(async () => {
        calls += 1;
        throw new GibworkApiError(500, {}, 'POST', '/x');
      }),
    ).rejects.toThrow(GibworkApiError);
    expect(calls).toBe(1);
  });
});

describe('parseRetryAfter', () => {
  test('reads seconds', () => {
    expect(parseRetryAfter('30', 0)).toBe(30_000);
  });

  test('reads an HTTP date', () => {
    const now = Date.parse('2026-09-21T06:00:00.000Z');
    expect(parseRetryAfter('Mon, 21 Sep 2026 06:00:45 GMT', now)).toBe(45_000);
  });

  test('returns null when there is nothing usable', () => {
    expect(parseRetryAfter(undefined, 0)).toBeNull();
    expect(parseRetryAfter('later', 0)).toBeNull();
  });
});
