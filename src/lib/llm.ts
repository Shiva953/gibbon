import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { BountyEntry } from '../types.js';
import { MAX_BOUNTY_AMOUNT, MIN_BOUNTY_AMOUNT } from '../types.js';
import { CliError, EXIT } from './errors.js';

/** Opus 5. Override with --model. */
export const DEFAULT_MODEL = 'claude-opus-5';

const AgentResult = z.object({
  /** The complete new bounties.yaml. Always the whole file, never a patch. */
  yaml: z.string(),
  /** One line per entry the edit touched. */
  changes: z.array(
    z.object({
      id: z.string(),
      action: z.enum(['create', 'update', 'remove', 'unchanged']),
      detail: z.string(),
    }),
  ),
  /** Requests that cannot be satisfied, and why. */
  refused: z.array(z.object({ request: z.string(), reason: z.string() })),
  /** Anything the model had to assume because the prompt did not say. */
  assumptions: z.array(z.string()),
});

export type AgentResult = z.infer<typeof AgentResult>;

const SYSTEM = `You edit a bounties.yaml file for gibbon, a declarative tool that
reconciles a Gibwork bounty program against this file. You ONLY edit the file. You never
create, fund, or refund anything — a human reviews your edit and runs \`gibbon apply\`.

FILE FORMAT — a YAML list. Each entry:
  id             required, stable key chosen by the maintainer. NOT the Gibwork UUID.
  title          required, string
  content        required, HTML string (e.g. "<p>...</p>")
  tags           required, list of strings
  amount         required, QUOTED decimal string between ${MIN_BOUNTY_AMOUNT.toFixed(2)} and ${MAX_BOUNTY_AMOUNT.toFixed(2)}
  minSubmission  optional, quoted decimal string; defaults to the full amount
  issue          optional, local reference like "#142"; never sent to Gibwork
  deadline       optional, ISO 8601
  allowOnlyVerifiedSubmissions  optional, boolean

HARD RULES:
1. amount MUST be a quoted string. Unquoted 40.00 becomes the float 40 and loses precision.
2. amount MUST be within ${MIN_BOUNTY_AMOUNT.toFixed(2)}-${MAX_BOUNTY_AMOUNT.toFixed(2)}. Gibwork rejects anything outside.
3. An entry's \`id\` is PERMANENT once live. Renaming one reads as "refund the old, create a new".
4. On an entry that is ALREADY LIVE, these fields are IMMUTABLE: title, tags, amount, mint,
   minSubmission. If asked to change one, DO NOT write it. Put it in \`refused\` and explain that
   it needs a refund and a replacement entry.
5. On a live entry only content, deadline and allowOnlyVerifiedSubmissions can change.
6. A NOT-yet-live entry has no restrictions — any field may be set freely.
7. REMOVING an entry refunds real money. Only remove one if the request clearly asks to stop
   funding it. Record it in \`changes\` with action "remove" so the human sees it.
8. NEVER invent an amount. If a new bounty is requested without one, put the requirement in
   \`assumptions\` and use the minimum ${MIN_BOUNTY_AMOUNT.toFixed(2)}.
9. Entries are referenced by \`id\`. If the request says "task 3" or similar positional wording,
   map it to the id at that position in the current file and say so in \`assumptions\`.
10. Preserve every entry and field the request does not mention. Return the COMPLETE file.

Write bounty content for a stranger with no access to the repo: self-contained, with clear
deliverables. Return valid YAML only in the \`yaml\` field — no markdown fences.`;

export interface EditRequest {
  prompt: string;
  currentYaml: string;
  entries: BountyEntry[];
  /** ids that exist on Gibwork right now, so the immutability rules apply. */
  liveIds: string[];
  model?: string;
}

/**
 * Fails before the request when no credential source exists. The SDK's own
 * error for this is about internal resolution and useless to a user, so check
 * the same sources first and say what to actually do.
 */
export function assertAnthropicCredentials(): void {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return;
  if (process.env.ANTHROPIC_AUTH_TOKEN?.trim()) return;
  if (existsSync(join(homedir(), '.config', 'anthropic'))) return;

  throw new CliError(
    [
      'No Anthropic credentials found. `agent` calls Claude to edit the file.',
      '',
      '  export ANTHROPIC_API_KEY=sk-ant-...     from console.anthropic.com',
      '  ant auth login                          if you use the Anthropic CLI',
      '',
      'Every other gibbon command works without this — only `agent` needs it.',
    ].join('\n'),
    'CREDENTIAL_ERROR',
    EXIT.CREDENTIAL,
  );
}

/**
 * Asks Claude to rewrite bounties.yaml. The result is never trusted: the
 * caller re-parses it with our own loader, and `plan` checks it against live
 * state afterwards. The model produces a reviewable file, not an action.
 */
export async function requestEdit(request: EditRequest): Promise<AgentResult> {
  assertAnthropicCredentials();
  const client = new Anthropic();

  const liveNote =
    request.liveIds.length > 0
      ? `These ids are ALREADY LIVE on Gibwork (immutability rules apply): ${request.liveIds.join(', ')}`
      : 'No entries are live on Gibwork yet, so nothing is immutable.';

  let response;
  try {
    response = await client.messages.parse({
      model: request.model ?? DEFAULT_MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            liveNote,
            '',
            'Current bounties.yaml:',
            '```yaml',
            request.currentYaml.trim() || '[]',
            '```',
            '',
            'Requested change:',
            request.prompt,
          ].join('\n'),
        },
      ],
      output_config: { format: zodOutputFormat(AgentResult) },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new CliError(
        'Anthropic credentials were rejected. Set ANTHROPIC_API_KEY, or run `ant auth login`.',
        'CREDENTIAL_ERROR',
        EXIT.CREDENTIAL,
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new CliError('Anthropic rate limit reached. Retry shortly.', 'RATE_LIMIT', EXIT.NETWORK);
    }
    if (error instanceof Anthropic.APIError) {
      throw new CliError(`Anthropic API error ${error.status}: ${error.message}`, 'API_ERROR', EXIT.API);
    }
    throw error;
  }

  if (!response.parsed_output) {
    throw new CliError(
      'The model did not return a usable edit. Re-run, or edit bounties.yaml by hand.',
      'PROTOCOL_ERROR',
      EXIT.INTERNAL,
    );
  }

  return response.parsed_output;
}
