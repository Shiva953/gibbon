# gibwork-sync

Declarative, version-controlled bounty management for [Gibwork](https://gibwork.fun).

Describe the bounties that *should* exist in a `bounties.yaml` file, preview
the diff against live Gibwork state, then apply it — the same
`plan` → review → `apply` loop as Terraform, pointed at bounties instead of
infrastructure.

Built on the **[@gibwork/sdk](https://www.npmjs.com/package/@gibwork/sdk)**.
It is a terminal tool: no web app, no dashboard, no browser.

> **Status: `plan`, `apply`, `status` and `agent` are implemented** and covered
> by 75 offline tests. `import` is the remaining stub. See
> [Roadmap](#roadmap).

---

## The problem

Every existing way to manage Gibwork bounties is **imperative** — you issue
actions, one at a time, through the app or `@gibwork/cli`. That is fine for a
single bounty. For a *set* that exists over time, four things go wrong, and an
agent driving the CLI only fixes the first:

- **Friction** *(an agent closes this)*. Ten bounties is ten commands, and
  editing one means running `gibwork task list`, scanning for it, and copying
  its UUID. A coding agent will do all of that for you, so this is the weakest
  of the four.
- **Re-running duplicates instead of converging.** Ask an agent twice for
  "two bounties named xanlo and preyce" and you get four bounties and a 4 USDC
  bill. Actions accumulate; state does not.
- **No record of what you intended.** Only the state that happens to exist
  right now. Nothing says who raised a reward from 1 to 5, when, or why — and
  nothing can tell you a bounty was edited in the app and no longer matches
  what you meant.
- **Interrupted creates are unrecoverable by default.** `tasks.create` runs a
  prepare → sign → submit sequence a dropped connection can interrupt. Unlike
  submissions, **`CreateTaskInput` carries no idempotency key** — so retrying
  does not resume, it funds a *second* bounty, and the platform will not stop
  you.

`gibwork-sync` puts the bounty set in a file, in git, and reconciles it — so
re-running converges, intent is versioned, and an interrupted create is
recoverable.

---

## Why not the app, or the CLI, or the CLI with an agent?

Gibwork already ships three ways to manage bounties, and **two of them are
better than this tool for most single operations.** Being precise about where
the line falls matters more than overselling:

| | Gibwork app | `@gibwork/cli` | CLI + agent skill | **gibwork-sync** |
|---|---|---|---|---|
| One ad-hoc bounty | **best** | good | good | worse |
| Rich content, images, media | **yes** | partial | partial | **no** |
| Finding a bounty's UUID | n/a | manual | agent does it | never needed |
| A batch of ten changes | ten UI flows | ~13 commands | one prompt | one `apply` |
| Preview every change first | no | no | model describes it | **`plan`, deterministic** |
| Re-run the same request twice | n/a | duplicates | **duplicates** | **converges** |
| Versioned record of intent | no | no | no | **yes (`git`)** |
| Detect drift from intent | no | no | no | **yes** |
| Runs with no LLM at all | yes | yes | **no** | **yes** |
| Recover an interrupted create | no | no | no | **yes** |
| Who decides what executes | you | you | **the model** | **a pure function** |

### What an agent closes, and what it doesn't

An agent driving `@gibwork/cli` genuinely removes most of the friction: it
finds UUIDs, loops over N operations, and writes the long flags for you. Any
claim that gibwork-sync wins on *convenience* is stale the moment you have a
coding agent open.

Five differences are not convenience, and no amount of agent cleverness closes
them:

1. **Idempotence.** `"create 2 bounties named xanlo and preyce"` run twice
   through an agent produces **four** bounties and spends 4 USDC. The same file
   applied twice produces two, then reports `No changes.` A file describes a
   *state*; a prompt describes an *action*.
2. **The model never touches money.** With the skill, the LLM *is* the
   executor — it picks which UUID to refund and calls the API. Here the LLM
   writes a text file, deterministic code computes the diff, a human approves,
   and deterministic code executes. A hallucinated UUID produces a file that
   fails to parse instead of a refunded bounty.
3. **A record of intent.** After an agent run you have bounties and a chat
   transcript. `git log bounties.yaml` tells you who raised a reward, when, and
   why — and makes bounty changes reviewable in a pull request.
4. **Drift detection.** Because intent is recorded, `plan` can tell you *"this
   bounty was edited in the app and no longer matches what you meant."* Without
   a recorded intent there is nothing to compare against.
5. **No LLM in the loop.** `plan` and `apply` need no API key, no tokens, no
   model. That is what makes CI, cron, and unattended runs possible — you do
   not want a model deciding what to refund at 3am.

### The core problem

**A bounty program is state, but every existing tool treats it as a series of
actions.**

Imperative tools work fine until you have a *set* that exists over time. Then
you need answers no action-based tool can give:

- What *should* exist, versus what *does*?
- What changed since I last looked, and who changed it?
- If I run this again, does it converge or duplicate?
- If it died halfway through, what actually happened?

gibwork-sync answers those by making the bounty set a file, diffing it against
live state with a pure function, and never letting anything but that diff move
money.

### Who it is for

**Maintainers running an ongoing bounty program** — a set that changes over
time, ideally reviewed by more than one person, and which must survive being
re-run.

**Not for:** a single ad-hoc bounty (use the app), bounties needing rich
formatting or images (use the app — this tool cannot upload media), or bounty
hunters (Gibwork's own apps cover that side).

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

gibwork-sync reads the **same configuration file `@gibwork/cli` writes**, so a
wallet you already set up with `gibwork config set` works here untouched:

```bash
gibwork config set keypair-path ~/.config/gibwork/id.json --profile stage
gibwork-sync plan --profile stage        # no other flags needed
```

Resolution is **flag → environment variable → profile → default** for every
setting, matching the official CLI exactly. For credentials specifically:

1. `--keypair <path>` — an owner-only keypair file
2. `--private-key-stdin` — piped only; never prompts, never echoes
3. `GIBWORK_KEYPAIR_PATH`
4. `GIBWORK_PRIVATE_KEY` — base58, or a JSON array of 32/64 bytes
5. the selected profile's `keypair-path`

Safety rules, all matching `@gibwork/cli`:

- **A raw private key is never accepted as a command-line argument.** It would
  land in your shell history and in `ps` output for every other user on the
  machine.
- **Ambiguity is an error, not a silent winner.** Setting both
  `GIBWORK_KEYPAIR_PATH` and `GIBWORK_PRIVATE_KEY` fails rather than quietly
  picking one — you should never be unsure which wallet signed.
- **Keypair files are checked before they are read**: symlinks resolved, must
  be a regular file, size-bounded, and rejected unless the mode is `0600` or
  stricter. The key buffer is zeroed after the signer is built, and
  `GIBWORK_PRIVATE_KEY` is deleted from the environment so nothing spawned
  later inherits it.
- **Production can only talk to the official API origin.** `--api-url` is
  available for stage, but in production a non-official origin, embedded
  credentials, or any redirect is refused — checked on both the request and the
  response.
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
gibwork-sync agent   "<prompt>" [--dry-run]           # rewrite the file from a request
```

Global flags, spelled exactly as `@gibwork/cli` spells them:

```
--profile <name>           --keypair <path>          --json
--environment <env>        --private-key-stdin       --quiet
--api-url <url>            --allow-insecure-http     --no-color
--timeout <milliseconds>
```

`--json` emits the same envelope the official CLI does — `{"ok":true,"data":…}`
on success, `{"ok":false,"error":{"code","message"}}` on failure — so a script
can parse either tool with one code path. `apply --json` requires `--yes`,
since a prompt would corrupt the stream.

Ctrl-C aborts in-flight work and exits `130`. State is written before anything
is signed, so an abort is always recoverable with `status`.

**Exit codes** — `apply` and `plan` are designed to be gated on in CI:

| Code | Meaning |
|---|---|
| 0 | applied, or nothing to do |
| 1 | internal / protocol / recovery error |
| 2 | usage error — bad flag, or invalid `bounties.yaml` |
| 10 | credential or config error |
| 20 | Gibwork API error |
| 21 | network error or timeout |
| 22 | ambiguous submit — run `status`, do **not** retry |
| 30 | blocked entries remain (desired state not reached) |
| 31 | unresolved operations — run `status` before applying again |
| 130 | cancelled |

Codes 0–29 and 130 are reproduced from `@gibwork/cli` so a CI script can treat
both tools identically. The 30s are gibwork-sync's own, and they are **not**
errors — the run succeeded, but live state is not what the file asked for. The
official CLI sets the same precedent with `gibwork mcp doctor`, which exits 30
for a non-error "not ready" verdict.

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
- [x] Verified live on stage: `asset.amount` is base units, HTML round-trips
      byte-identically, and Gibwork auto-assigns a deadline
- [ ] `import` round-trip
- [ ] Live stage test for the interrupted-apply case

## License

MIT
