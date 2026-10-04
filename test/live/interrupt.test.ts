import { describe, expect, test } from 'bun:test';

/**
 * Live stage-environment tests. These spend real (stage) funds and hit the
 * network, so they never run as part of `bun test` — the default script only
 * points at the offline suites. Run them deliberately:
 *
 *   GIBWORK_LIVE_TEST=1 bun --env-file=.env test test/live
 *
 * The critical case below is the reason this project exists: the SDK's
 * prepare -> sign -> submit flow can be interrupted, leaving an intent in
 * pending / submitted / requires_review. gibbon must notice and refuse
 * to blindly re-apply over it rather than risk a double spend.
 */

const LIVE = process.env.GIBWORK_LIVE_TEST === '1';
const describeLive = LIVE ? describe : describe.skip;

describeLive('interrupted apply (stage)', () => {
  test('a guard is in place so live tests never touch production', () => {
    expect(process.env.GIBWORK_SYNC_ENV ?? 'stage').not.toBe('production');
  });

  test.todo('apply killed mid-create leaves a pending marker in state.json');
  test.todo('status reports the unresolved create and exits non-zero');
  test.todo('apply refuses to re-run over the unresolved entry');
  test.todo('status resolves the intent once the task is readable, unblocking apply');
  test.todo('the interrupted create produced exactly one task, not two');
});
