import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GibworkClient } from '@gibwork/sdk';
import type { WalletSigner } from '@gibwork/sdk';
import { createKeypairSigner } from '@gibwork/sdk/node';
import type { Environment } from '../types.js';
import { expandHome } from './config.js';
import type { Profile } from './config.js';
import { CliError, EXIT } from './errors.js';
import { pinnedProductionFetch } from './productionOrigin.js';

/**
 * Credential resolution, matching @gibwork/cli. Ambiguity is an error rather
 * than a silent winner:
 *   1. --keypair <path>            (exclusive with --private-key-stdin)
 *   2. --private-key-stdin         (piped only; never prompts, never echoes)
 *   3. GIBWORK_KEYPAIR_PATH        (error if GIBWORK_PRIVATE_KEY is also set)
 *   4. GIBWORK_PRIVATE_KEY
 *   5. the selected profile's keypair-path
 *
 * Never accepts a raw key as a CLI argument, and never loads .env implicitly.
 */

export const MAX_KEY_BYTES = 16 * 1024;

/** A printable description of where the key came from. Never key material. */
export type CredentialSource = string;

export class CredentialError extends CliError {
  override readonly name = 'CredentialError';
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'CREDENTIAL_ERROR', EXIT.CREDENTIAL, undefined, options);
  }
}

export interface CredentialOptions {
  keypair?: string;
  privateKeyStdin?: boolean;
}

export interface ResolvedCredential {
  signer: WalletSigner;
  walletAddress: string;
  source: CredentialSource;
}

/**
 * Loads a keypair file with the checks the official CLI performs: realpath
 * defeats symlink redirection, the mode check refuses a world-readable key,
 * and the size bound stops a mistyped path being read in as "a key".
 */
async function loadKeypairFile(pathValue: string): Promise<{ path: string; contents: Buffer }> {
  const requested = resolve(expandHome(pathValue.trim()));

  let path: string;
  let metadata: Awaited<ReturnType<typeof stat>>;
  try {
    path = await realpath(requested);
    metadata = await stat(path);
  } catch (cause) {
    throw new CredentialError(`Could not access keypair file at ${requested}.`, { cause });
  }

  if (!metadata.isFile()) {
    throw new CredentialError(`Keypair path is not a regular file: ${path}`);
  }
  if (metadata.size > MAX_KEY_BYTES) {
    throw new CredentialError(`Keypair file exceeds the ${MAX_KEY_BYTES}-byte limit.`);
  }
  // 0o77: any permission at all for group or other.
  if (process.platform !== 'win32' && (metadata.mode & 0o77) !== 0) {
    throw new CredentialError(
      `Keypair file permissions are too broad: ${path}. Run chmod 600 on the file.`,
    );
  }

  const contents = await readFile(path);
  if (contents.byteLength > MAX_KEY_BYTES) {
    contents.fill(0);
    throw new CredentialError(`Keypair file exceeds the ${MAX_KEY_BYTES}-byte limit.`);
  }
  return { path, contents };
}

async function readBoundedStdin(limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > limit) {
      for (const previous of chunks) previous.fill(0);
      buffer.fill(0);
      throw new CredentialError(`Private key exceeds the ${limit}-byte limit.`);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/** Resolves the signing wallet. The key never leaves this function as a value. */
export async function resolveCredential(
  options: CredentialOptions,
  profile: Profile = {},
): Promise<ResolvedCredential> {
  if (options.keypair && options.privateKeyStdin) {
    throw new CredentialError('Use either --keypair or --private-key-stdin, not both.');
  }

  let privateKey: string | undefined;
  let source: string | undefined;
  let mutableBuffer: Buffer | undefined;

  if (options.keypair) {
    const loaded = await loadKeypairFile(options.keypair);
    privateKey = loaded.contents.toString('utf8').trim();
    mutableBuffer = loaded.contents;
    source = loaded.path;
  } else if (options.privateKeyStdin) {
    if (process.stdin.isTTY) {
      throw new CredentialError(
        '--private-key-stdin requires piped input; it will not echo or prompt for a key.',
      );
    }
    mutableBuffer = await readBoundedStdin(MAX_KEY_BYTES);
    privateKey = mutableBuffer.toString('utf8').trim();
    source = 'stdin';
  } else {
    const environmentPath = process.env.GIBWORK_KEYPAIR_PATH?.trim();
    const environmentKey = process.env.GIBWORK_PRIVATE_KEY?.trim();

    // Which wallet signs must never be decided silently.
    if (environmentPath && environmentKey) {
      throw new CredentialError(
        'Both GIBWORK_KEYPAIR_PATH and GIBWORK_PRIVATE_KEY are set; keep only one.',
      );
    }

    if (environmentPath) {
      const loaded = await loadKeypairFile(environmentPath);
      privateKey = loaded.contents.toString('utf8').trim();
      mutableBuffer = loaded.contents;
      source = `GIBWORK_KEYPAIR_PATH (${loaded.path})`;
    } else if (environmentKey) {
      privateKey = environmentKey;
      source = 'GIBWORK_PRIVATE_KEY';
      // So nothing spawned later inherits the key.
      delete process.env.GIBWORK_PRIVATE_KEY;
    } else if (profile.keypairPath) {
      const loaded = await loadKeypairFile(profile.keypairPath);
      privateKey = loaded.contents.toString('utf8').trim();
      mutableBuffer = loaded.contents;
      source = `profile keypair (${loaded.path})`;
    } else {
      throw new CredentialError(
        'No wallet configured. Use --keypair, --private-key-stdin, GIBWORK_KEYPAIR_PATH, ' +
          'GIBWORK_PRIVATE_KEY, or set keypair-path in a profile.\n\n' +
          'gibbon never reads .env on its own. Load it explicitly:\n' +
          '  node --env-file=.env $(which gibbon) plan',
      );
    }
  }

  if (!privateKey) {
    mutableBuffer?.fill(0);
    throw new CredentialError('The private key is empty.');
  }

  try {
    const signer = createKeypairSigner(privateKey);
    return { signer, walletAddress: signer.publicKey.toBase58(), source };
  } catch (cause) {
    if (cause instanceof CliError) throw cause;
    throw new CredentialError('Could not read the private key.', { cause });
  } finally {
    mutableBuffer?.fill(0);
  }
}

/** Stage unless production is asked for by name. */
export function resolveEnvironment(env?: Environment): Environment {
  return env === 'production' ? 'production' : 'stage';
}

export interface ClientOptions {
  signer: WalletSigner;
  environment: Environment;
  apiUrl: string;
  timeoutMs?: number;
}

/**
 * Builds the SDK client. The environment is client-wide and immutable, so
 * prepare and submit can never straddle stage and production. Production also
 * gets the pinned fetch, which refuses redirects and non-official origins.
 */
export function buildClient(options: ClientOptions): GibworkClient {
  return new GibworkClient({
    signer: options.signer,
    production: options.environment === 'production',
    baseUrl: options.apiUrl,
    ...(options.environment === 'production' ? { fetch: pinnedProductionFetch } : {}),
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
  });
}
