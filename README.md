# gibwork-sync

**For open source projects and protocols that want to fund their issue backlog
on Gibwork.**

If your core is open source, you probably have a list of issues you would pay
to get fixed. This tool is for turning that list into funded bounties, keeping
it current as issues get resolved, and doing it with more than one maintainer
involved.

You keep the bounties you want funded in a `bounties.yaml` file next to your
code. One command shows what would change on Gibwork. A second makes it happen.

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

Nothing happened there. That was a preview. `gibwork-sync apply` does it.

This is a terminal tool built on the [Gibwork SDK](https://www.npmjs.com/package/@gibwork/sdk).
There is no web app and no dashboard.

**Status:** all five commands work. 92 automated tests. `plan`, `apply`,
`import` and `status` have been run against the live Gibwork stage API.

---

## The problem

Say you run bounties for your open source project, and ten are live. Today you
manage them one at a time: to edit one, you list them all, find it, copy its
UUID, and paste it into an update command. To close three, you do that three
more times.

An AI agent can do the typing, so typing is not the real problem. These four
things are:

**1. You cannot see what is about to happen.** There is no preview. You run a
command and find out afterwards.

**2. Running the same thing twice creates duplicates.** Ask an agent twice for
"two bounties for the parser bugs" and you get four bounties and a bill for
four. A list of instructions repeats. A file does not.

**3. Nothing records what you meant, only what currently exists.** Six weeks
later you cannot tell who raised a reward from 1 to 5, when, or why, or whether
someone edited a bounty in the mobile app so it no longer matches your intent.

**4. If a bounty creation gets interrupted, you are stuck.** Creating a bounty
sends a real Solana transaction. If your laptop sleeps halfway through, you
cannot tell whether the money moved. Gibwork's task creation has no idempotency
key, so trying again funds a second bounty.

gibwork-sync fixes all four by making the bounty list a file in git, previewing
every change, and never letting anything except a reviewed diff move money.

If your reaction is *"Gibwork already has an AI agent that can do all this"*,
that is the right question. [There is a section on it below](#but-gibwork-already-has-an-ai-agent-for-this)
with four things you can try yourself.

---

## How it works

Three things get compared every time you run `plan`:

| | what it is | where it lives |
|---|---|---|
| what you want | your bounty list | `bounties.yaml` |
| what you made | a map from your names to Gibwork's UUIDs | `.gibwork/state.json` |
| what exists | your live bounties | Gibwork |

The middle one is why you never type a UUID. You call a bounty `fix-142`,
Gibwork calls it `3f9c8a21-...`, and the tool remembers which is which.

| command | what it does | costs money |
|---|---|---|
| `import` | Read your existing bounties and write the file for you. Run once. | no |
| `plan` | Show what would change. Changes nothing. | no |
| `apply` | Make the changes. | **yes** |
| `status` | Clean up after an interrupted `apply`. | no |
| `agent` | Rewrite the file from a plain English request. | no (needs an AI key) |

---

## Install

You need Node.js 22 or newer and [Bun](https://bun.sh) to build.

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

Otherwise use a keypair file (recommended) or the key itself:

```bash
export GIBWORK_KEYPAIR_PATH=~/.config/gibwork/id.json
export GIBWORK_PRIVATE_KEY=your-base58-key      # or this, not both
```

Or pass the file directly: `gibwork-sync plan --keypair ~/.config/gibwork/id.json`

| variable | what it does |
|---|---|
| `GIBWORK_KEYPAIR_PATH` | path to a Solana keypair JSON file |
| `GIBWORK_PRIVATE_KEY` | the key itself, base58 or a JSON byte array |
| `GIBWORK_PROFILE` | which profile from the Gibwork config to use |
| `GIBWORK_ENVIRONMENT` | `stage` or `production` |
| `ANTHROPIC_API_KEY` | only needed for `gibwork-sync agent` |

Three rules the tool follows:

- It never accepts a private key as a command line argument, because arguments
  show up in shell history and in `ps` output for other users.
- It never reads `.env` on its own. Use `node --env-file=.env` if you want that.
- Setting both `GIBWORK_KEYPAIR_PATH` and `GIBWORK_PRIVATE_KEY` is an error,
  not a guess. You should never be unsure which wallet signed.

> **Stage is not free.** Gibwork's `stage` environment keeps test bounties out
> of the main marketplace, but settles in **real mainnet USDC**. The minimum
> bounty is 1.00 USDC. Creating is fee free and refunding costs about 0.01
> USDC, so a create and refund cycle costs about a cent.

---

## Quick start

Create `bounties.yaml`:

```yaml
- id: proxy-env
  title: "Respect the HTTPS_PROXY variable"
  content: "<p>A reused session ignores HTTPS_PROXY. See issue #142.</p>"
  tags: [bug, python]
  amount: "1.00"
  minSubmission: "1.00"
```

Then preview and apply:

```
$ gibwork-sync plan --profile stage
wallet 9K1Zp3wokoer3AVVTExhJkoudkfKSD939xGBJ4u6cx2h  ·  stage  ·  credentials from profile keypair

  + create   proxy-env        1.00

Plan: 1 to create, 0 to update, 0 to refund.

$ gibwork-sync apply --profile stage
  + create   proxy-env        1.00

Plan: 1 to create, 0 to update, 0 to refund.
Apply these changes to stage? [y/N] y

  created proxy-env -> fcfb7a61-edd5-42f7-ad2e-59ae229bbac9

Applied: 1 created, 0 updated, 0 refunded.
```

Your bounty is live, and the tool wrote down which UUID it got:

```bash
$ cat .gibwork/state.json
{
  "version": 1,
  "wallet": "9K1Zp3wokoer3AVVTExhJkoudkfKSD939xGBJ4u6cx2h",
  "environment": "stage",
  "tasks": {
    "proxy-env": {
      "taskId": "fcfb7a61-edd5-42f7-ad2e-59ae229bbac9",
      "lastAppliedHash": "2011b853086adb6c",
      "lastSyncedAt": "2026-09-18T10:42:22.519Z"
    }
  },
  "pending": []
}
```

Keep that file. It is the only thing connecting `proxy-env` to that UUID. Delete
it and the tool forgets the bounty exists, with your money still in escrow.

For one bounty, the official CLI is just as good: `gibwork task create` with
six flags is the same length as the YAML. The difference starts at the second
bounty, and at the second time you run anything.

---

## What a normal Friday looks like

You have five bounties live. One got fixed upstream, two need clearer
descriptions, and a new bug needs funding.

### With the official CLI

First find out what you have, then copy a UUID out of the list for each change:

```
$ gibwork task list --profile stage --limit 5
ID                                    STATUS       OPEN   TITLE
fcfb7a61-edd5-42f7-ad2e-59ae229bbac9  in progress  true   Connection leak on streamed responses
7b2e1f04-9c31-4a8d-b6e2-1f0a5c8d3e44  in progress  true   Rewrite the quickstart guide
3d5f8a10-4b2c-49e7-8f31-0c7a9e6b2d55  in progress  true   Clearer timeout error messages
9c04ab13-2e77-4b10-a3f5-6d8e0b2c1a99  in progress  true   Jittered retry backoff
b8e07c94-1a6d-4f52-9e88-2c4b7d0a3f61  in progress  true   Persist the cookie jar across sessions

$ gibwork task refund fcfb7a61-edd5-42f7-ad2e-59ae229bbac9 --profile stage
$ gibwork task update 7b2e1f04-9c31-4a8d-b6e2-1f0a5c8d3e44 --profile stage --content-file docs.html
$ gibwork task update 3d5f8a10-4b2c-49e7-8f31-0c7a9e6b2d55 --profile stage --content-file timeout.html
$ gibwork task create --profile stage \
    --title "HTTP/2 ALPN negotiation fails on macOS" \
    --content-file alpn.html --tag bug --tag macos \
    --amount 1.00 --min-submission 1.00
```

Four commands, four confirmations, **three UUIDs copied by hand**, and no
preview.
Paste the wrong UUID into a refund and you close a bounty somebody is actively
working on. Nothing warns you.

### With gibwork-sync

Edit one file: delete one entry, change two `content:` lines, add one.

```diff
$ git diff bounties.yaml
-- id: stream-leak
-  title: "Connection leak on streamed responses"
-  content: "<p>Streamed responses never release their socket.</p>"
-  tags: [bug, python]
-  amount: "1.00"
-
 - id: docs-quickstart
-  content: "<p>The quickstart is out of date.</p>"
+  content: "<p>The quickstart is out of date. Cover install, first request and auth.</p>"
+
+- id: http2-alpn
+  title: "HTTP/2 ALPN negotiation fails on macOS"
+  content: "<p>ALPN falls back to HTTP/1.1 on macOS only. See #211.</p>"
+  tags: [bug, macos]
+  amount: "1.00"
```

```
$ gibwork-sync plan --profile stage
  + create   http2-alpn       1.00
  ~ update   docs-quickstart  content  (7b2e1f04)
  ~ update   timeout-msg      content  (3d5f8a10)
  - refund   stream-leak      Connection leak on streamed responses  (fcfb7a61)
    2 unchanged

Plan: 1 to create, 2 to update, 1 to refund.

$ gibwork-sync apply --profile stage
Apply these changes to stage? [y/N] y
```

**One screen showing everything that will happen, before any of it happens.**
One confirmation instead of four. No UUID typed at any point. The short hashes
in brackets are output you can cross-check, not input you have to get right.
And because it is a `git diff`, a teammate can review a bounty change in a pull
request before it spends money.

**The part that is not about convenience:** run the CLI block twice and you get
a second "HTTP/2 ALPN negotiation fails on macOS" bounty and another 1.00 USDC
gone.
Run `apply` twice and the second run prints:

```
    5 unchanged

No changes. bounties.yaml matches live Gibwork state.
```

A command is an instruction, so it runs every time. A file describes how things
should be, so running it twice is the same as running it once.

---

## But Gibwork already has an AI agent for this

It does, and for a single bounty it is better than this. `gibwork skills
install claude` lets you say "create a bounty for the parser leak at 1 USDC"
and it happens. It finds UUIDs by title, loops over operations, and writes the
flags for you. Any claim this tool made about saving keystrokes would be
nonsense.

Here are four situations where it is not about keystrokes. You can run every
one yourself.

### 1. Doing the same thing twice

**Monday** you tell the agent: *create a bounty for the parser memory leak, 1
USDC, tags bug and rust.* **Friday** you forget, and ask again:

```
$ gibwork task list --profile stage
bb24ca91  in progress  Fix memory leak in parser
ea07dd2a  in progress  Fix memory leak in parser
```

Two bounties, 2 USDC locked, no warning. With the file:

```
$ gibwork-sync apply --profile stage
  created parser-leak -> bb24ca91-1b4f-4d91-8fa3-fed2501972f4
Applied: 1 created, 0 updated, 0 refunded.

$ gibwork-sync apply --profile stage
    1 unchanged
No changes. bounties.yaml matches live Gibwork state.
```

This takes sixty seconds and 2 USDC to check yourself. It is the clearest of
the four.

### 2. Asking whether anything changed without you

Someone on your team edits a bounty description in the Gibwork mobile app.

The agent can run `task list` and read you the current description. It cannot
tell you it *changed*, because nothing on your machine records what it was
supposed to say. With the file:

```
$ gibwork-sync plan --profile stage
  ~ update   docs-cli         content  (7b2e1f04)

Plan: 0 to create, 1 to update, 0 to refund.
```

Free, read-only, two seconds. And `git log -p bounties.yaml` tells you when it
was last changed, by whom, in which commit, and why.

### 3. Raising a reward

*Raise the parser bounty to 5 USDC.* Gibwork does not allow this: a live
bounty's amount is permanent. Only the description, deadline and
verified-only setting can change. The agent either fails partway or improvises
a refund and recreate, which is two transactions you did not ask for. The
official CLI just says:

```
$ gibwork task update bb24ca91-1b4f-4d91-8fa3-fed2501972f4 --profile stage --amount 5.00
error: unknown option '--amount'
```

That tells you a flag is missing, not that the field is permanent or what to do
instead. With the file, change `amount: "1.00"` to `"5.00"`:

```
$ gibwork-sync plan --profile stage
  ! blocked  parser-leak      (bb24ca91)
             amount cannot be changed on a live bounty. Refund this bounty and
             create a replacement, or revert the file.

Plan: 0 to create, 0 to update, 0 to refund, 1 blocked.
```

Exit code 30. No request reached Gibwork. It names the constraint, gives you
the options, and does not pick one for you.

### 4. The session dying halfway through

Your laptop sleeps while a bounty is being created. The agent was mid tool
call; nothing recorded the UUID, so you cannot tell whether the USDC moved. Ask
it to try again and you fund a second bounty.

gibwork-sync writes the new bounty's UUID to disk **before** it signs anything:

```
1. ask Gibwork to prepare the bounty      (nothing has been paid yet)
2. write the UUID to .gibwork/state.json   <-- the important bit
3. sign the transaction                    (still offline)
4. send it                                 (money moves here)
5. mark it done
```

Kill the process anywhere between steps 2 and 5 and the next run can ask
Gibwork what actually happened. This is a real transcript from testing, where
`kill -9` landed *after* the payment went through:

```
$ cat .gibwork/state.json
"pending": [{
  "id": "probe-c",
  "taskId": "ea07dd2a-c115-4f4b-9fe3-8ae4ece43a38",
  "startedAt": "2026-09-21T06:27:45.394Z"
}]

$ gibwork-sync apply --profile stage
apply refused: resolve the operations above first.        # exit 31

$ gibwork-sync status --profile stage
  v create  probe-c   task exists (status: CREATED). Adopted into state.
All clear.

$ gibwork task list --profile stage
ea07dd2a  in progress  gibwork-sync probe C               # exactly one
```

`status` handles all four possible answers:

| what Gibwork says | what it means | what happens |
|---|---|---|
| not found | it never got created | safe to try again |
| still creating | the payment has not settled | **stays blocked**, try again in a minute |
| open | it worked | adopted, you are done |
| refunded | it got rolled back | safe to try again |

The official CLI cannot do this. It has recovery for *submissions*
(`--recovery-file`, `gibwork submission resume`) but nothing for creating a
bounty. If `gibwork task create` dies after the transaction is sent, nothing on
your machine knows the UUID, so you either guess from `task list` or run it
again and risk paying twice.

### So when is each one right?

Use the **Gibwork app or the agent skill** when you are posting a bounty now,
it needs images or rich formatting, or you post one every few weeks.

Use **gibwork-sync** when the same set of bounties exists over months, when
more than one person changes it, when a mistake costs money, or when it has to
run unattended in CI.

The line is not agent versus file. It is one-off versus ongoing. Most projects
will use both.

---

## Already have bounties? Use import

If you posted bounties through the Gibwork app or CLI, run this once:

```
$ gibwork-sync import --profile stage
Reading live tasks...
  respect-the-https-proxy-variable  1.00  (fcfb7a61)
  add-a-dry-run-flag                1.00  (7b2e1f04)

Imported 2 bounty(s) into bounties.yaml.
Verified: the generated file reports zero changes against live state.
```

It writes both files. The last line is a safety check: before writing
anything, it compares the file it built against your live bounties, and if they
do not match exactly it writes nothing.

**Do not skip this step.** If you hand write a file describing bounties you
already have, the tool has no record connecting them, so `plan` will say
"create" for every one and `apply` will duplicate them all with real money.

---

## Writing the file with AI

If you would rather describe the change than edit YAML:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
gibwork-sync agent "add a bounty for the flaky test in #88 at 2 USDC, and close the docs one" --dry-run
```

It edits the file and stops. It never talks to Gibwork and never spends
anything; you still run `plan` and `apply` yourself. It knows the rules, so it
tells you when a request cannot be done:

```
Not applied:
  ! change the reward on fix-142 to 7
    amount is immutable on a live bounty. Refund it and create a replacement.
```

Whatever it writes is checked with the same parser `plan` uses before it
reaches disk, so a bad edit fails here instead of later.

The difference from Gibwork's agent skill is what the AI is allowed to touch.
Theirs calls the platform directly, so the model picks which UUID to refund and
asking twice creates two bounties. This one writes a text file you read before
anything happens, and a model that hallucinates a UUID produces a file that
fails to parse instead of a refunded bounty.

---

## Reference

### Commands

```
gibwork-sync plan    [-f <file>]                 preview changes
gibwork-sync apply   [-f <file>] [-y]            make changes
gibwork-sync import  [-f <file>] [--force]       build the file from live bounties
gibwork-sync status  [-f <file>] [--dry-run]     fix an interrupted apply
gibwork-sync agent   "<request>" [--dry-run]     edit the file with AI

Options on every command:
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

Two things that will bite you:

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

The split create path is deliberate. The SDK's one call `tasks.create()` only
returns after the money has moved. The split version hands you the UUID first,
which is what makes crash recovery possible.

Three things we found by testing against the live API, all handled in the code:

- `asset.amount` comes back in base units as a string (`"1000000"` for 1 USDC),
  while `minSubmissionAmount` on the same object comes back in whole tokens as
  a number (`1`). The SDK's own type says `amount` is a number. It is a string.
- Gibwork assigns a deadline even when you do not ask for one. Treating that as
  a difference caused an update that could never finish, so fields you leave
  out of the file are left alone.
- A bounty reward must be between 1.00 and 100000.00.

### What this does not do

- **It cannot upload images.** Bounties needing screenshots or design files
  should be written in the Gibwork app.
- **It does not handle submissions.** Reviewing and paying people is done in
  the app or the official CLI. This tool only manages the bounties themselves.
- **It is not worth it for one bounty.** This is for people running a set of
  bounties over time.
- **`agent` needs an Anthropic API key.** Every other command works without it.

---

## Running the tests

```bash
bun install
bun run typecheck
bun run test        # 92 tests, no network, no money
bun run build
```

The tests cover the comparison logic, the file parser, the state file, crash
recovery, and the import round trip. None of them touch the network. A separate
live test spends stage funds and is opt in:

```bash
GIBWORK_LIVE_TEST=1 bun test test/live
```

---

## Using it in CI

This repository's own workflow only builds and tests; it cannot reach Gibwork.
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

Two things there are not optional:

- **`.gibwork/state.json` has to survive between runs.** It is gitignored by
  default because it belongs to one wallet, but a fresh checkout without it
  sees an empty map, calls every bounty new, and duplicates all of them. Commit
  it as shown. Nothing in it is secret.
- **Put the apply job behind a GitHub Environment with a required reviewer.**
  A merge should not be able to spend from your wallet on its own.

You can script the official CLI in CI, but you cannot make it safe to re-run.
With no record of what already exists, a re-run creates everything again,
which is fine for a deploy script and not fine when each run costs money.

---

## Demo

Video: _add your link here_

Screenshots: see [`docs/screenshots/`](docs/screenshots/)

To reproduce every example in this README yourself, follow [`demo/`](demo/).

---

## License

MIT. This is a community tool built for the Gibwork Developer Hackathon. It is
not an official Gibwork product.
