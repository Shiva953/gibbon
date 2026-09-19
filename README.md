# gibwork-sync

Manage your Gibwork bounties as a file instead of as a list of commands.

You write down the bounties you want in `bounties.yaml`. You run one command to
see what would change. You run a second command to make it happen.

```bash
$ gibwork-sync plan --profile stage

  + create   docs-cli         1.00
  ~ update   fix-142          content  (3f9c8a21)
  - refund   old-audit        Old audit  (7b2e1f04)
  ! blocked  perf-bench       (9c04ab13)
             amount cannot be changed on a live bounty. Refund this bounty and
             create a replacement, or revert the file.

Plan: 1 to create, 1 to update, 1 to refund, 1 blocked.
```

Nothing happened there. That was a preview. You run `gibwork-sync apply` to
actually do it.

This is a terminal tool built on the [Gibwork SDK](https://www.npmjs.com/package/@gibwork/sdk).
There is no web app and no dashboard.

**Status:** all five commands work. 82 automated tests. `plan`, `apply`,
`import` and `status` have been run against the live Gibwork stage API.

---

## The problem

Say you run bounties for your open source project. You have ten of them live.

Today you manage them one at a time. To change the description of one bounty,
you list all your bounties, find the right one, copy its UUID, and run an
update command with that UUID pasted in. To close three of them, you do that
three more times.

An AI agent can do the typing for you, so that part is not the real problem.
These four things are:

**1. You cannot see what is about to happen.** There is no preview. You run a
command and find out afterwards.

**2. Running the same thing twice creates duplicates.** Ask an agent twice for
"two bounties for the parser bugs" and you get four bounties and a bill for
four. A list of instructions repeats. A file does not.

**3. Nothing records what you meant.** Only what currently exists. Six weeks
later you cannot tell who raised a reward from 1 to 5, or when, or why. You
also cannot tell if somebody edited a bounty in the mobile app and it no longer
matches what you intended.

**4. If a bounty creation gets interrupted, you are stuck.** Creating a bounty
sends a real Solana transaction. If your laptop sleeps halfway through, you
have no way to find out whether the money moved. Gibwork's task creation has no
idempotency key, so if you just try again you fund a second bounty. The
platform will not stop you.

gibwork-sync fixes 2, 3 and 4 by making the bounty list a file in git, and by
never letting anything except a reviewed diff move money.

---

## How it works

Three things get compared every time you run `plan`:

| | what it is | where it lives |
|---|---|---|
| what you want | your bounty list | `bounties.yaml` |
| what you made | a map from your names to Gibwork's UUIDs | `.gibwork/state.json` |
| what exists | your live bounties | Gibwork |

The middle one is why you never type a UUID. You call a bounty `fix-142`.
Gibwork calls it `3f9c8a21-...`. The tool remembers which is which.

Five commands:

| command | what it does | costs money |
|---|---|---|
| `import` | Read your existing bounties and write the file for you. Run once. | no |
| `plan` | Show what would change. Changes nothing. | no |
| `apply` | Make the changes. | **yes** |
| `status` | Clean up after an interrupted `apply`. | no |
| `agent` | Rewrite the file from a plain English request. | no (needs an AI key) |

---

## Install

You need Node.js 22 or newer.

```bash
npm install -g gibwork-sync
```

To run it from source instead:

```bash
git clone https://github.com/Shiva953/gibwork-sync
cd gibwork-sync
bun install && bun run build
alias gibwork-sync="node $PWD/dist/index.js"
```

## Set up your wallet

If you already use the official Gibwork CLI, **you are done.** gibwork-sync
reads the same config file. Just pass `--profile`:

```bash
gibwork-sync plan --profile stage
```

If you do not, pick one of these:

```bash
# a keypair file (recommended)
export GIBWORK_KEYPAIR_PATH=~/.config/gibwork/id.json

# or the key itself
export GIBWORK_PRIVATE_KEY=your-base58-key
```

Or pass the file directly: `gibwork-sync plan --keypair ~/.config/gibwork/id.json`

### Environment variables

| variable | what it does |
|---|---|
| `GIBWORK_KEYPAIR_PATH` | path to a Solana keypair JSON file |
| `GIBWORK_PRIVATE_KEY` | the key itself, base58 or a JSON byte array |
| `GIBWORK_PROFILE` | which profile from the Gibwork config to use |
| `GIBWORK_ENVIRONMENT` | `stage` or `production` |
| `ANTHROPIC_API_KEY` | only needed for `gibwork-sync agent` |

Three rules the tool follows:

- It never accepts a private key as a command line argument. Arguments show up
  in your shell history and in `ps` output for other users on the machine.
- It never reads `.env` on its own. Load it yourself with
  `node --env-file=.env` if you want that.
- Setting both `GIBWORK_KEYPAIR_PATH` and `GIBWORK_PRIVATE_KEY` is an error,
  not a guess. You should never be unsure which wallet signed.

### Stage is not free

Gibwork's `stage` environment keeps your test bounties out of the main
marketplace, but it settles in **real mainnet USDC**. The minimum bounty is
1.00 USDC. Creating a bounty is fee free and refunding one costs about 0.01
USDC, so a create and refund cycle costs about a cent.

---

## Quick start

```bash
mkdir my-bounties && cd my-bounties
```

Create `bounties.yaml`:

```yaml
- id: fix-142
  title: "Fix memory leak in parser"
  content: "<p>Long-running processes accumulate memory. See issue #142.</p>"
  tags: [bug, rust]
  amount: "1.00"
  minSubmission: "1.00"
```

Then:

```bash
gibwork-sync plan --profile stage
```

```
wallet 9K1Zp3wokoer3AVVTExhJkoudkfKSD939xGBJ4u6cx2h  ·  stage  ·  credentials from profile keypair

  + create   fix-142          1.00

Plan: 1 to create, 0 to update, 0 to refund.
```

```bash
gibwork-sync apply --profile stage
```

```
  + create   fix-142          1.00

Plan: 1 to create, 0 to update, 0 to refund.
Apply these changes to stage? [y/N] y

  created fix-142 -> fcfb7a61-edd5-42f7-ad2e-59ae229bbac9

Applied: 1 created, 0 updated, 0 refunded.
```

Your bounty is live. The tool wrote down which UUID it got:

```bash
$ cat .gibwork/state.json
{
  "version": 1,
  "wallet": "9K1Zp3wokoer3AVVTExhJkoudkfKSD939xGBJ4u6cx2h",
  "environment": "stage",
  "tasks": {
    "fix-142": {
      "taskId": "fcfb7a61-edd5-42f7-ad2e-59ae229bbac9",
      "lastAppliedHash": "2011b853086adb6c",
      "lastSyncedAt": "2026-09-18T10:42:22.519Z"
    }
  },
  "pending": []
}
```

Keep that file. It is the only thing connecting `fix-142` to that UUID. If you
delete it, the tool forgets the bounty exists and your money stays locked in
escrow.

### Why not just use the official CLI here?

For one bounty, you should. The equivalent is six lines, the same as the YAML:

```bash
gibwork task create --profile stage \
  --title "Fix memory leak in parser" \
  --content "<p>Long-running processes accumulate memory. See issue #142.</p>" \
  --tag bug --tag rust \
  --amount 1.00 --min-submission 1.00
```

It is not shorter and it does not need a file. The difference starts at the
second bounty, and at the second time you run anything.

---

## What a normal Friday looks like

This is where it stops being about typing. You have twelve bounties live. Three
got fixed upstream, two need clearer descriptions, and a new bug needs funding.

### With the official CLI

First, find out what you have:

```
$ gibwork task list --profile stage --all
ID                                    STATUS       OPEN   TITLE
------------------------------------  -----------  -----  ------------------------------
fcfb7a61-edd5-42f7-ad2e-59ae229bbac9  in progress  true   Fix memory leak in parser
7b2e1f04-9c31-4a8d-b6e2-1f0a5c8d3e44  in progress  true   Document the CLI flags
9c04ab13-2e77-4b10-a3f5-6d8e0b2c1a99  in progress  true   Add a benchmark suite
3d5f8a10-4b2c-49e7-8f31-0c7a9e6b2d55  in progress  true   Fix flaky auth test
b8e07c94-1a6d-4f52-9e88-2c4b7d0a3f61  in progress  true   Port config loader to TOML
e1c39b27-8f04-4d6a-b512-7a90c6e8f4d3  in progress  true   Windows path handling
                                             ... 6 more rows
```

Now, for each change, find the row, select the UUID, copy it, paste it:

```bash
$ gibwork task refund fcfb7a61-edd5-42f7-ad2e-59ae229bbac9 --profile stage
$ gibwork task refund 9c04ab13-2e77-4b10-a3f5-6d8e0b2c1a99 --profile stage
$ gibwork task refund e1c39b27-8f04-4d6a-b512-7a90c6e8f4d3 --profile stage
$ gibwork task update 7b2e1f04-9c31-4a8d-b6e2-1f0a5c8d3e44 --profile stage --content-file docs.html
$ gibwork task update 3d5f8a10-4b2c-49e7-8f31-0c7a9e6b2d55 --profile stage --content-file auth.html
$ gibwork task create --profile stage \
    --title "Fix Unicode crash in CSV export" \
    --content-file csv.html --tag bug --tag python \
    --amount 5.00 --min-submission 5.00
```

Six commands, six confirmations, **five UUIDs copied by hand**. There is no
preview, so you find out whether you got it right by watching it happen six
times. Paste the wrong UUID into one of those refunds and you close a bounty
somebody is actively working on. Nothing warns you.

### With gibwork-sync

You edit one file. Delete three entries, change two `content:` lines, add one
new entry. Then:

```bash
$ git diff bounties.yaml
```

```diff
-- id: parser-leak
-  title: "Fix memory leak in parser"
-  content: "<p>Long-running processes accumulate memory.</p>"
-  tags: [bug, rust]
-  amount: "3.00"
-
 - id: docs-cli
-  content: "<p>Every flag needs a line in the README.</p>"
+  content: "<p>Every flag needs a line in the README, with an example.</p>"
+
+- id: csv-unicode
+  title: "Fix Unicode crash in CSV export"
+  content: "<p>Non-ASCII column headers crash the exporter. See #211.</p>"
+  tags: [bug, python]
+  amount: "5.00"
```

```bash
$ gibwork-sync plan --profile stage
```

```
  + create   csv-unicode      5.00
  ~ update   docs-cli         content  (7b2e1f04)
  ~ update   auth-flaky       content  (3d5f8a10)
  - refund   parser-leak      Fix memory leak in parser  (fcfb7a61)
  - refund   bench-suite      Add a benchmark suite  (9c04ab13)
  - refund   win-paths        Windows path handling  (e1c39b27)
    6 unchanged

Plan: 1 to create, 2 to update, 3 to refund.
```

```bash
$ gibwork-sync apply --profile stage
Apply these changes to stage? [y/N] y
```

**One screen showing everything that will happen, before any of it happens.**
One confirmation instead of six. No UUID typed at any point, and the short
hashes in brackets are output you can cross-check, not input you have to get
right.

And `git diff` means a teammate can review a bounty change in a pull request
before it spends money, which is not possible when the change is six commands
in somebody's shell history.

### The part that is not about convenience

Run the CLI block twice and you get three more refunds that fail, two more
updates, and **a second "Fix Unicode crash in CSV export" bounty with a new
UUID and another 5.00 USDC gone.**

Run `gibwork-sync apply` twice and the second run prints:

```
    12 unchanged

No changes. bounties.yaml matches live Gibwork state.
```

A command is an instruction, so it runs every time. A file is a description of
how things should be, so running it twice is the same as running it once.

---

## Two more things worth seeing

### 1. It tells you when something is impossible

Gibwork does not let you change a bounty's reward after it is live. Only the
description, deadline and verified-only setting can change.

Change `amount: "1.00"` to `amount: "5.00"` and run plan:

```
  ! blocked  fix-142          (fcfb7a61)
             amount cannot be changed on a live bounty. Refund this bounty and
             create a replacement, or revert the file.

Plan: 0 to create, 0 to update, 0 to refund, 1 blocked.
```

Exit code 30. No request was sent to Gibwork at all. Compare that to trying the
same thing with the official CLI:

```bash
$ gibwork task update fcfb7a61-... --amount 5.00
error: unknown option '--amount'
```

That tells you a flag is missing. It does not tell you the field is permanent,
or what to do instead.

### 2. It survives being killed halfway through

This is the part that matters most, because creating a bounty moves real money.

`apply` writes the new bounty's UUID to disk **before** it signs anything:

```
1. ask Gibwork to prepare the bounty      (nothing has been paid yet)
2. write the UUID to .gibwork/state.json   <-- the important bit
3. sign the transaction                    (still offline)
4. send it                                 (money moves here)
5. mark it done
```

Kill the process anywhere between steps 2 and 5 and the UUID is still on disk,
so the next run can ask Gibwork what actually happened:

```bash
$ gibwork-sync apply --profile stage
  ! create  fix-142          task fcfb7a61-edd5-42f7-ad2e-59ae229bbac9
            last known status: processing
apply refused: resolve the operations above first.
# exit code 31

$ gibwork-sync status --profile stage
Resolving 1 unresolved operation(s)...

  x create  fix-142          task was never created. Safe to apply again.
            task fcfb7a61-edd5-42f7-ad2e-59ae229bbac9

All clear. 0 confirmed, 1 safe to apply again.
```

There are four possible answers, and `status` picks the right one:

| what Gibwork says | what it means | what happens |
|---|---|---|
| not found | it never got created | safe to try again |
| still creating | the payment has not settled | **stays blocked**, try again in a minute |
| open | it worked | adopted, you are done |
| refunded | it got rolled back | safe to try again |

Only some of those let you retry, and the tool knows which. Without this, a
retry funds a second bounty, because Gibwork's task creation has no idempotency
key to protect you.

> **Why not just use the official CLI here?** You cannot. The official CLI has
> recovery for *submissions* (`--recovery-file` and `gibwork submission
> resume`), but there is nothing equivalent for creating a bounty. If
> `gibwork task create` dies after the transaction is sent, nothing on your
> machine knows the UUID, so there is no way to ask what happened. Your options
> are to guess from `task list`, or run it again and risk paying twice.

---

## Already have bounties? Use import

If you posted bounties through the Gibwork app or CLI, run this once:

```bash
gibwork-sync import --profile stage
```

It reads your live bounties and writes both files for you.

```
Reading live tasks...
  fix-memory-leak-in-parser        1.00  (fcfb7a61)
  document-the-cli-flags           1.00  (7b2e1f04)

Imported 2 bounty(s) into bounties.yaml.
Verified: the generated file reports zero changes against live state.
```

That last line is a safety check. Before writing anything, it compares the file
it just built against your live bounties. If they do not match exactly, it
writes nothing and tells you.

**Do not skip this step.** If you hand write a file describing bounties you
already have, the tool has no record connecting them, so `plan` will say
"create" for every one and `apply` will duplicate them all with real money.

> **Why not just use the official CLI here?** There is nothing to import into.
> The official CLI keeps no local record of your bounties, so every command
> starts by asking the platform. This command only exists because gibwork-sync
> keeps that record, and it has to be built correctly the first time.

---

## Writing the file with AI

If you would rather describe the change than edit YAML:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
gibwork-sync agent "add a bounty for the flaky test in #88 at 2 USDC, and close the docs one" --dry-run
```

It edits the file and stops. It never talks to Gibwork and it never spends
anything. You still run `plan` and `apply` yourself.

It also knows the rules, so it tells you when you ask for something that cannot
be done:

```
Not applied:
  ! change the reward on fix-142 to 7
    amount is immutable on a live bounty. Refund it and create a replacement.
```

Whatever it writes is checked with the same parser `plan` uses before it
reaches disk, so a bad edit fails here instead of later.

> **Why not just use Gibwork's own agent skill?** Often you should.
> `gibwork skills install claude` lets an AI drive the official CLI, and for a
> one off bounty that is the simpler path. The difference is what the AI is
> allowed to touch. Theirs calls the platform directly, so the model picks
> which UUID to refund and asking twice creates two bounties. This one writes a
> text file that you read before anything happens, and a model that hallucinates
> a UUID here produces a file that fails to parse instead of a refunded bounty.

---

## All commands

```
gibwork-sync plan    [-f <file>]                 preview changes
gibwork-sync apply   [-f <file>] [-y]            make changes
gibwork-sync import  [-f <file>] [--force]       build the file from live bounties
gibwork-sync status  [-f <file>] [--dry-run]     fix an interrupted apply
gibwork-sync agent   "<request>" [--dry-run]     edit the file with AI
```

Options that work on every command:

```
--profile <name>          use a profile from the Gibwork config
--environment <env>       stage or production
--keypair <path>          path to a keypair file
--private-key-stdin       read the key from a pipe
--json                    machine readable output
--quiet                   less printing
```

### Exit codes

These match the official Gibwork CLI, so a script can treat both the same way.

| code | meaning |
|---|---|
| 0 | done, or nothing to do |
| 2 | bad flag, or a mistake in `bounties.yaml` |
| 10 | wallet or config problem |
| 20 | Gibwork returned an error |
| 21 | network problem or timeout |
| 22 | a payment result is unknown. run `status`, do not retry |
| 30 | some changes are impossible |
| 31 | an interrupted operation needs `status` |
| 130 | you pressed Ctrl-C |

### The file format

```yaml
- id: fix-142                 # your name for it. never changes. never sent to Gibwork
  issue: "#142"               # optional note for you
  title: "Fix memory leak"    # cannot change after the bounty is live
  content: "<p>HTML here</p>" # can change
  tags: [bug, rust]           # cannot change after the bounty is live
  amount: "1.00"              # cannot change. must be quoted. 1.00 to 100000.00
  minSubmission: "1.00"       # optional. defaults to the full amount
  deadline: "2026-10-01T12:00:00.000Z"   # optional. can change
  allowOnlyVerifiedSubmissions: false    # optional. can change
```

Two things that will bite you if you skip them:

- **Quote the amount.** Unquoted `1.00` becomes the number `1` in YAML, and
  rounding has no place near money. The tool refuses to load it.
- **Never rename an `id` after applying.** The tool reads a rename as "refund
  the old bounty, create a new one", and that moves real money.

---

## What this uses from Gibwork

Built entirely on the **Gibwork SDK** (`@gibwork/sdk`). No CLI wrapping and no
scraping.

| what it does | SDK call |
|---|---|
| read your bounties | `tasks.list()` |
| read one bounty in full | `tasks.get(taskId)` |
| create a bounty | `tasks.prepareCreate()`, `signPreparedTransaction()`, `tasks.submitCreate()` |
| edit a bounty | `tasks.update(taskId, input)` |
| close a bounty | `tasks.prepareRefund()`, `tasks.submitRefund()` |
| sign as your wallet | `createKeypairSigner()`, `new GibworkClient()` |

The split create path is deliberate. The SDK also offers a one call
`tasks.create()`, but that only returns after the money has moved. The split
version hands you the bounty's UUID first, which is what makes the crash
recovery above possible.

Three things we found by testing against the live API, all handled in the code:

- `asset.amount` comes back in base units as a string (`"1000000"` for 1 USDC),
  while `minSubmissionAmount` on the same object comes back in whole tokens as
  a number (`1`). The SDK's own type says `amount` is a number. It is a string.
- Gibwork assigns a deadline even when you do not ask for one. Treating that as
  a difference caused an update that could never finish, so fields you leave
  out of the file are now left alone instead.
- A bounty reward must be between 1.00 and 100000.00.

---

## What this does not do

- **It cannot upload images.** Bounties needing screenshots or design files
  should be written in the Gibwork app.
- **It does not handle submissions.** Reviewing and paying people is done in
  the app or the official CLI. This tool only manages the bounties themselves.
- **It is not worth it for one bounty.** If you post a single bounty now and
  then, use the app. This is for people running a set of bounties over time.
- **`agent` needs an Anthropic API key.** Every other command works without it.

---

## Running the tests

```bash
bun install
bun run typecheck
bun run test        # 82 tests, no network, no money
bun run build
```

The tests cover the comparison logic, the file parser, the state file, the
crash recovery, and the import round trip. None of them touch the network.

There is a separate live test file that spends stage funds. It is opt in:

```bash
GIBWORK_LIVE_TEST=1 bun test test/live
```

---

## Using it in CI

This repository's own workflow only builds and tests. It cannot reach Gibwork.

For your own project, the useful setup is a preview on every pull request and
an apply on merge:

```yaml
name: bounties
on:
  pull_request:
    paths: ['bounties.yaml']
  push:
    branches: [main]
    paths: ['bounties.yaml']

concurrency:
  group: bounties-${{ github.ref }}   # two applies at once creates duplicates
  cancel-in-progress: false

jobs:
  plan:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm i -g gibwork-sync
      - env: { GIBWORK_PRIVATE_KEY: "${{ secrets.GIBWORK_PRIVATE_KEY }}" }
        run: gibwork-sync plan --environment ${{ vars.GIBWORK_ENV }}

  apply:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: gibwork        # add a required reviewer to this environment
    steps:
      - uses: actions/checkout@v4
      - run: npm i -g gibwork-sync
      - env: { GIBWORK_PRIVATE_KEY: "${{ secrets.GIBWORK_PRIVATE_KEY }}" }
        run: |
          gibwork-sync status --environment ${{ vars.GIBWORK_ENV }}
          gibwork-sync apply --yes --environment ${{ vars.GIBWORK_ENV }}
      - run: |
          git config user.name github-actions
          git config user.email github-actions@github.com
          git add -f .gibwork/state.json
          git commit -m "chore: sync bounty state" || true
          git push
```

Two things there are not optional.

`.gibwork/state.json` has to survive between runs. It is gitignored by default
because it belongs to one wallet, but CI needs it. A fresh checkout without it
sees an empty map, calls every bounty new, and duplicates all of them. Commit
it as shown. Nothing in it is secret.

And put the apply job behind a GitHub Environment with a required reviewer. A
merge should not be able to spend from your wallet on its own.

> **Why not just script the official CLI in CI?** You can script it, but you
> cannot make it safe to re-run. With no record of what already exists, a
> re-run creates everything again. That is fine for a deploy script and very
> much not fine when each run costs money.

---

## Demo

Video: _add your link here_

Screenshots: see [`docs/screenshots/`](docs/screenshots/)

---

## License

MIT. This is a community tool built for the Gibwork Developer Hackathon. It is
not an official Gibwork product.
