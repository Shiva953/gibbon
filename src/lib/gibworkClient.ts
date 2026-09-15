import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createKeypairSigner } from '@gibwork/sdk/node';
import { GibworkClient } from '@gibwork/sdk';
import type { WalletSigner } from '@gibwork/sdk';
import type { Environment } from '../types.js';
import { CliError, EXIT } from './errors.js';

/**
 * Credential resolution, matching the safety rules @gibwork/cli follows:
 *
 *   1. --keypair <path>          (explicit, highest priority)
 *   2. GIBWORK_PRIVATE_KEY       (env var holding the key material)
 *   3. GIBWORK_KEYPAIR_PATH      (env var holding a path to a keypair file)
 *
 * Two things this deliberately never does:
 *   - accept a raw private key as a bare CLI argument (it would land in shell
 *     history and in `ps` output for every other user on the machine), and
 *   - load .env implicitly. The caller opts in explicitly, e.g.
 *     `node --env-file=.env` or `bun --env-file=.env`.
 */

export interface CredentialOptions {
  /** Path to a Solana keypair JSON file, from --keypair. */
  keypair?: string;
  /** Target environment. Defaults to stage; production is always opt-in. */
  env?: Environment;
  /** Request timeout in ms, passed through to the SDK. */
  timeoutMs?: number;
}

/** Where the key came from, safe to print. Never contains key material. */
export type CredentialSource =
  | { kind: 'keypair-flag'; path: string }
  | { kind: 'env-private-key' }
  | { kind: 'env-keypair-path'; path: string };

export class CredentialError extends CliError {
  override readonly name = 'CredentialError';
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CREDENTIAL_ERROR', EXIT.CREDENTIAL, details);
  }
}

const SETUP_HINT = [
  'No Gibwork wallet credentials found. Provide exactly one of:',
  '  --keypair <path>              path to a Solana keypair JSON file',
  '  GIBWORK_PRIVATE_KEY=...       base58 key, or a JSON array of bytes',
  '  GIBWORK_KEYPAIR_PATH=<path>   path to a Solana keypair JSON file',
  '',
  'gibwork-sync never reads .env on its own. Load it explicitly:',
  '  node --env-file=.env $(which gibwork-sync) plan',
].join('\n');

function readKeypairFile(path: string): string {
  const absolute = resolve(path);
  let raw: string;
  try {
    raw = readFileSync(absolute, 'utf8');
  } catch (cause) {
    // Report the path but never the contents.
    const reason = cause instanceof Error ? cause.message : 'unreadable';
    throw new CredentialError(`Could not read keypair file at ${absolute}: ${reason}`);
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new CredentialError(`Keypair file at ${absolute} is empty.`);
  }
  return trimmed;
}

/**
 * Resolves the signing key without ever returning it alongside anything that
 * gets logged. The returned `source` is the printable half.
 */
export function resolveCredentials(options: CredentialOptions = {}): {
  privateKey: string;
  source: CredentialSource;
} {
  if (options.keypair) {
    return {
      privateKey: readKeypairFile(options.keypair),
      source: { kind: 'keypair-flag', path: resolve(options.keypair) },
    };
  }

  const inlineKey = process.env.GIBWORK_PRIVATE_KEY?.trim();
  if (inlineKey) {
    return { privateKey: inlineKey, source: { kind: 'env-private-key' } };
  }

  const keypairPath = process.env.GIBWORK_KEYPAIR_PATH?.trim();
  if (keypairPath) {
    return {
      privateKey: readKeypairFile(keypairPath),
      source: { kind: 'env-keypair-path', path: resolve(keypairPath) },
    };
  }

  throw new CredentialError(SETUP_HINT);
}

/** A one-line, key-free description of where credentials came from. */
export function describeCredentialSource(source: CredentialSource): string {
  switch (source.kind) {
    case 'keypair-flag':
      return `keypair file (--keypair ${source.path})`;
    case 'env-private-key':
      return 'GIBWORK_PRIVATE_KEY';
    case 'env-keypair-path':
      return `keypair file (GIBWORK_KEYPAIR_PATH=${source.path})`;
  }
}

/** Resolves the target environment. Stage unless production is asked for. */
export function resolveEnvironment(env?: Environment): Environment {
  return env === 'production' ? 'production' : 'stage';
}

/**
 * Builds an SDK client AND hands back the signer that backs it.
 *
 * Returning the signer is not incidental. `GibworkClient` takes a signer in its
 * constructor, passes it to its two resources, and never exposes it again — but
 * `signPreparedTransaction(serializedTransaction, signer)` needs one. Without a
 * reference of our own we would be forced onto the all-in-one `tasks.create()`,
 * which runs prepare -> sign -> submit internally and only returns at the end.
 * That path is unrecoverable: `CreateTaskInput` carries no idempotency key, so
 * a process killed mid-flight leaves a possibly-funded task whose UUID exists
 * nowhere on disk. Keeping the signer is what buys us the split flow, and with
 * it the taskId that `prepareCreate` hands over before any money moves.
 *
 * The environment is client-wide and immutable after construction, so prepare
 * and submit for one operation can never straddle stage and production.
 */
export function createClient(options: CredentialOptions = {}): {
  client: GibworkClient;
  signer: WalletSigner;
  walletAddress: string;
  environment: Environment;
  credentialSource: CredentialSource;
} {
  const { privateKey, source } = resolveCredentials(options);
  const environment = resolveEnvironment(options.env);

  const signer = createKeypairSigner(privateKey);
  const client = new GibworkClient({
    signer,
    production: environment === 'production',
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
  });

  return {
    client,
    signer,
    walletAddress: signer.publicKey.toBase58(),
    environment,
    credentialSource: source,
  };
}
