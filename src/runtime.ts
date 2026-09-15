import { DEFAULT_GIBWORK_API_URL } from '@gibwork/sdk';
import type { GibworkClient, WalletSigner } from '@gibwork/sdk';
import { createClient } from './lib/gibworkClient.js';
import type { CredentialSource } from './lib/gibworkClient.js';
import type { Environment } from './types.js';

/**
 * Everything a sync command needs in order to talk to Gibwork.
 *
 * The field names mirror @gibwork/cli's own `createRuntime()` return value
 * deliberately. gibwork-sync ships as its own binary and claims no part of
 * the official CLI's command namespace — but if the Gibwork team ever wanted
 * to absorb this work, matching this shape means the sync commands drop in
 * against their runtime unchanged, and this file is the only thing deleted.
 *
 * `profileName`, `apiUrl` overrides and `signal` are part of the contract and
 * are populated as the matching flags land; the shape is fixed now so command
 * code never has to change again.
 */
export interface Runtime {
  client: GibworkClient;
  signer: WalletSigner;
  signal?: AbortSignal;
  output: { json: boolean; quiet: boolean };
  walletAddress: string;
  credentialSource: CredentialSource;
  profileName?: string;
  environment: Environment;
  apiUrl: string;
  timeoutMs?: number;
}

export interface RuntimeOptions {
  keypair?: string;
  environment?: Environment;
  timeoutMs?: number;
  json?: boolean;
  quiet?: boolean;
}

/**
 * Produces a Runtime. The host owns this: standalone gibwork-sync uses the
 * implementation below, while an embedding CLI would supply its own.
 */
export type RuntimeFactory = () => Promise<Runtime>;

/** The standalone implementation. Async to match the CLI's own signature. */
export async function createRuntime(options: RuntimeOptions = {}): Promise<Runtime> {
  const { client, signer, walletAddress, environment, credentialSource } = createClient({
    ...(options.keypair ? { keypair: options.keypair } : {}),
    ...(options.environment ? { env: options.environment } : {}),
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
  });

  return {
    client,
    signer,
    output: { json: options.json ?? false, quiet: options.quiet ?? false },
    walletAddress,
    credentialSource,
    environment,
    // Overriding the API URL requires the production origin pinning the
    // official CLI performs, so no --api-url flag is exposed until that lands.
    apiUrl: DEFAULT_GIBWORK_API_URL,
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
  };
}
