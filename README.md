# gibwork-sync

Declarative, version-controlled bounty management for [Gibwork](https://gibwork.fun).

Describe the bounties that *should* exist in a `bounties.yaml` file, preview
the diff against live Gibwork state, then apply it — the same
`plan` → review → `apply` loop as Terraform, pointed at bounties instead of
infrastructure.

Built on the **[@gibwork/sdk](https://www.npmjs.com/package/@gibwork/sdk)**.
It is a terminal tool: no web app, no dashboard, no browser.

> **Status: `plan`, `apply` and `status` are implemented** and covered by 62
> offline tests. `import` is the remaining stub. See [Roadmap](#roadmap).

---

## The problem

Gibwork creators manage bounties one at a time, through the web app or
`@gibwork/cli`:

- **Creating N bounties takes N commands.** There is no way to declare "here
  are the ten bounties I want funded" and have it happen in one reviewed step.
- **Editing a live bounty means first finding its UUID.** Run
  `gibwork task list --all`, scan the output, copy the ID, then
  `gibwork task update <uuid> …`. Nothing locally remembers that "the fix-142
  bounty" is `3f9c…`, so you rediscover it every single time.
- **There is no audit trail.** Nothing records who raised a reward, when, or
  why — only the state that happens to exist right now.
- **Interrupted operations stay unresolved.** `tasks.create` and friends run a
  prepare → sign → submit sequence that a dropped connection or a killed
  process can interrupt, leaving an intent `pending`, `submitted`, or
  `requires_review`. The SDK ships idempotency keys and recovery files
  precisely because this happens — but nothing re-checks them for you.

`gibwork-sync` puts the bounty set in a file, in git, and reconciles it.

### Honest note on time saved

For a **single one-off bounty this tool saves you nothing** — use
`@gibwork/cli` directly. The value shows up in two places:

1. **Batch creation.** The platform's rate limits mean wall-clock time is
   roughly the same, but *human attention* drops from babysitting N
   confirmations to one review and one confirmation.
2. **Ongoing edits.** The tool already knows the `id → taskId` mapping, so
   there is no UUID lookup. Over repeated use this is the single biggest
   practical win.

**Who this is for:** maintainers running more than a handful of bounties, or
an ongoing bounty program. **Who it is not for:** someone posting one ad-hoc
bounty, and bounty hunters — Gibwork's own apps cover that side.

---

## How it works

```
bounties.yaml  ──┐
                 ├─▶  gibwork-sync plan   ──▶  diff (read-only, no writes)
live Gibwork  ───┘                                    │
                                                 human review
                                                      │
                                              gibwork-sync apply
                                                      │
                            tasks.create / tasks.update / tasks.refund
                                                      │
                                          .gibwork/state.json
                                     (id → taskId + content hash)
```

`.gibwork/state.json` is what makes the loop work across runs: it maps your
stable local `id` to the real Gibwork UUID, stores a content hash to detect
drift, and records any operation that started but never confirmed.

### A bounty entry

```yaml
- id: fix-142                  # stable local key, never the Gibwork UUID
  issue: "#142"                # optional local reference, not sent to Gibwork
  title: "Fix memory leak in parser"
  content: "<p>Long-running processes accumulate memory. See #142.</p>"
  tags: [bug, rust]
  amount: "40.00"              # quoted — see below
  minSubmission: "5.00"
```

Two rules worth internalizing:

- **`id` is yours and permanent.** Changing it reads as "refund the old
  bounty, create a new one".
- **Amounts are quoted strings.** Unquoted `40.00` is parsed by YAML as the
  float `40`. Escrow amounts must never be rounded, so the loader rejects it.

### What can and cannot change after creation

The Gibwork API's `UpdateTaskInput` accepts only three fields. This is a
platform constraint, not a limitation of this tool:

| Field | Changeable on a live bounty? |
|---|---|
| `content` | yes |
| `deadline` | yes |
| `allowOnlyVerifiedSubmissions` | yes |
| `title`, `tags`, `amount`, `mint`, `minSubmission` | **no** |

Editing an immutable field is reported by `plan` as **blocked** rather than
silently ignored: applying it would require refunding the bounty and creating
a replacement, which is a real money movement and your decision to make.

---

## Setup

Requires **Node.js 22+** (the Gibwork SDK's floor). [Bun](https://bun.com) is
used for development; the published CLI is plain Node and needs no Bun.

```bash
git clone <this-repo> && cd gibwork-sync
bun install
bun run build
```

### Credentials

Resolved in this order:

1. `--keypair <path>` — path to a Solana keypair JSON file
2. `GIBWORK_PRIVATE_KEY` — base58 key, or a JSON array of 32/64 bytes
3. `GIBWORK_KEYPAIR_PATH` — path to a keypair file

Two deliberate safety rules:

- **A raw private key is never accepted as a command-line argument.** It would
  land in your shell history and in `ps` output for every other user on the
  machine.
- **`.env` is never loaded implicitly.** Opt in explicitly:

```bash
cp .env.example .env     # then fill it in
node --env-file=.env dist/index.js plan
```

### Environments

`--env stage` (default) and `--env production` map to the SDK's `production`
flag. The setting is client-wide, so prepare and submit for one operation
always hit the same backend. **Stage is the default on purpose** — nothing
touches production funds unless you ask for it by name.

---

## Usage

```bash
gibwork-sync plan    [-f, --file <path>]              # read-only diff
gibwork-sync apply   [-f, --file <path>] [-y]         # execute the diff
gibwork-sync import  [-f, --file <path>]              # bootstrap from live state
gibwork-sync status  [-f, --file <path>] [--dry-run]  # resolve interrupted runs
```

Global: `-k, --keypair <path>`, `-e, --environment <stage|production>` (spelled
the same as `@gibwork/cli`, so muscle memory carries across).

**Exit codes** — `apply` and `plan` are designed to be gated on in CI:

| Code | Meaning |
|---|---|
| 0 | applied, or nothing to do |
| 1 | failed |
| 2 | blocked entries remain (desired state not reached) |
| 3 | unresolved operations — run `status` before applying again |

### Typical loop

```bash
$EDITOR bounties.yaml
node --env-file=.env dist/index.js plan      # review the diff
node --env-file=.env dist/index.js apply     # confirm, then execute
```

### Adopting an existing bounty set

```bash
node --env-file=.env dist/index.js import    # writes bounties.yaml + state.json
node --env-file=.env dist/index.js plan      # must report zero changes
```

That zero-diff round trip is the acceptance check. If `plan` shows changes
immediately after `import`, the import was lossy — fix that before trusting
the file as your source of truth.

### After an interrupted run

```bash
node --env-file=.env dist/index.js status            # resolve
node --env-file=.env dist/index.js status --dry-run  # inspect only
```

`apply` writes a pending marker to `state.json` *before* it signs anything and
clears it only on a confirmed terminal state. Anything left behind means the
process died mid-flight, and `apply` refuses to touch that entry until it is
resolved — that refusal happens before any network call, so it costs nothing.

`status` reads each interrupted operation back from Gibwork and settles the
local record. It only ever READS from the API — no transaction is signed and no
funds move — but it does rewrite `state.json`, which is what unblocks `apply`:

| What `tasks.get(taskId)` shows | Verdict | Result |
|---|---|---|
| 404 | never landed | marker cleared, safe to apply again |
| `status: creating` | still settling | **marker kept** — retrying could double-fund |
| open / live | succeeded | adopted into `tasks`, marker cleared |
| `status: refunded` | rolled back | dropped, safe to apply again |

This works only because `prepareCreate` returns the `taskId` before any funds
move. There is no `tasks.getIntent()` in the SDK — reading the task back *is*
the reconciliation.

---

## Development

```bash
bun run typecheck     # tsc --noEmit
bun test              # offline suite: no network, no funds
bun run build         # emit dist/
bun run dev -- plan   # run from source
```

The offline suite covers the diff engine, the YAML loader, and the state store
with no network access. Live tests hit the **stage** environment and spend
stage funds, so they are opt-in:

```bash
GIBWORK_LIVE_TEST=1 bun --env-file=.env test test/live
```

The test that matters most is in `test/live/interrupt.test.ts`: kill `apply`
mid-flight, then verify `status` identifies the unresolved operation, refuses
to re-apply, and that exactly one bounty was created — not zero, not two.

### CI

`.github/workflows/sync.yml` typechecks and tests every PR, runs a read-only
`plan` on branch PRs, and on merge to `main` runs `status` then `apply`.

Because `apply` moves real funds, the apply job is pinned to a GitHub
Environment named `gibwork` — add a required reviewer there so a merge cannot
spend from the wallet without a human approving the run. Set the
`GIBWORK_PRIVATE_KEY` secret and, to target production, the `GIBWORK_ENV`
variable.

---

## How apply stays safe

`CreateTaskInput` carries **no idempotency key**, so re-running an interrupted
create allocates a *new* task and funds a second bounty. The platform will not
stop you. That is the risk this tool exists to remove.

`prepareCreate()` returns the `taskId` *before* any funds move, so `apply` uses
the split prepare/sign/submit path rather than the all-in-one `tasks.create()`,
and writes the task id to disk before a signature exists anywhere:

```
① prepareCreate(input)        → { intentId, taskId, serializedTransaction }
② saveState(pending{taskId})  ← atomic temp+rename   ◄── crash window opens
③ signPreparedTransaction()     local only, no network
④ submitCreate(intentId, tx)    funds move here
⑤ status==='confirmed' → recordTask + clearPending   ◄── window closes
```

Killed anywhere between ② and ⑤, the marker survives *with the task id*, and
`status` resolves it by reading the task back. `status: 'processing'` is not
treated as success. `tasks.update` gets none of this, deliberately — it signs
nothing, so retrying it is free.

## Roadmap

- [x] CLI surface, credential resolution, YAML loader, state store
- [x] `src/lib/diff.ts` — the reconciliation engine (pure, table-tested)
- [x] `plan` wired to the engine
- [x] `apply` with the crash barrier and rate-limit pacing (prepare 2/min,
      submit 5/min)
- [x] `status` — resolves pending markers via `tasks.get(taskId)`
- [ ] `import` round-trip
- [ ] Verify HTML round-tripping on stage, then loosen `contentEquals`
- [ ] Confirm whether `TaskDetails.asset.amount` is whole tokens or base units
- [ ] Live stage test for the interrupted-apply case

## License

MIT
