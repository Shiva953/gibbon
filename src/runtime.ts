import { DEFAULT_GIBWORK_API_URL } from '@gibwork/sdk';
import type { GibworkClient, WalletSigner } from '@gibwork/sdk';
import { getProfile, loadConfig, selectedProfileName } from './lib/config.js';
import { buildClient, resolveCredential } from './lib/gibworkClient.js';
import type { CredentialSource } from './lib/gibworkClient.js';
import { CliError, EXIT } from './lib/errors.js';
import { assertProductionApiOrigin, validateApiUrl } from './lib/productionOrigin.js';
import type { Environment } from './types.js';

/**
 * Everything a sync command needs in order to talk to Gibwork.
 *
 * The field names mirror @gibwork/cli's own `createRuntime()` return value
 * deliberately. gibwork-sync ships as its own binary and claims no part of the
 * official CLI's command namespace — but if the Gibwork team ever wanted to
 * absorb this work, matching this shape means the sync commands drop in
 * against their runtime unchanged, and this file is the only thing deleted.
 */
export interface Runtime {
  client: GibworkClient;
  signer: WalletSigner;
  signal?: AbortSignal;
  output: { json: boolean; quiet: boolean };
  walletAddress: string;
  credentialSource: CredentialSource;
  profileName: string;
  environment: Environment;
  apiUrl: string;
  timeoutMs?: number;
}

export interface RuntimeOptions {
  keypair?: string;
  privateKeyStdin?: boolean;
  profile?: string;
  environment?: Environment;
  apiUrl?: string;
  timeout?: number;
  allowInsecureHttp?: boolean;
  json?: boolean;
  quiet?: boolean;
  signal?: AbortSignal;
}

/**
 * Produces a Runtime. The host owns this: standalone gibwork-sync uses the
 * implementation below, while an embedding CLI would supply its own.
 */
export type RuntimeFactory = () => Promise<Runtime>;

const MAX_TIMEOUT_MS = 10 * 60 * 1000;

function parseEnvironmentValue(value: unknown, origin: string): Environment | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'stage' || value === 'production') return value;
  throw new CliError(
    `${origin} must be either 'stage' or 'production'.`,
    'CONFIG_ERROR',
    EXIT.CREDENTIAL,
  );
}

function resolveTimeout(value: number | string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const ms = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(ms) || ms <= 0 || ms > MAX_TIMEOUT_MS) {
    throw new CliError(
      `Timeout must be a positive whole number of milliseconds, at most ${MAX_TIMEOUT_MS}.`,
      'CONFIG_ERROR',
      EXIT.CREDENTIAL,
    );
  }
  return ms;
}

/**
 * The standalone implementation.
 *
 * Resolution is flag -> environment variable -> profile -> default for every
 * setting, exactly as the official CLI resolves them, so a wallet configured
 * with `gibwork config set` works here with no extra setup.
 */
export async function createRuntime(options: RuntimeOptions = {}): Promise<Runtime> {
  const config = await loadConfig();
  const profileName = selectedProfileName(config, options.profile);
  const profile = getProfile(config, profileName);

  const environment =
    options.environment ??
    parseEnvironmentValue(process.env.GIBWORK_ENVIRONMENT?.trim(), 'GIBWORK_ENVIRONMENT') ??
    profile.environment ??
    'stage';

  const apiUrl = validateApiUrl(
    options.apiUrl ?? process.env.GIBWORK_API_URL?.trim() ?? profile.apiUrl ?? DEFAULT_GIBWORK_API_URL,
    options.allowInsecureHttp,
  );
  // Production may only ever talk to the official origin.
  assertProductionApiOrigin(environment, apiUrl);

  const timeoutMs = resolveTimeout(
    options.timeout ?? process.env.GIBWORK_TIMEOUT_MS?.trim() ?? profile.timeoutMs,
  );

  const credential = await resolveCredential(
    {
      ...(options.keypair ? { keypair: options.keypair } : {}),
      ...(options.privateKeyStdin ? { privateKeyStdin: true } : {}),
    },
    profile,
  );

  const client = buildClient({
    signer: credential.signer,
    environment,
    apiUrl,
    ...(timeoutMs ? { timeoutMs } : {}),
  });

  return {
    client,
    signer: credential.signer,
    ...(options.signal ? { signal: options.signal } : {}),
    output: { json: options.json ?? false, quiet: options.quiet ?? false },
    walletAddress: credential.walletAddress,
    credentialSource: credential.source,
    profileName,
    environment,
    apiUrl,
    ...(timeoutMs ? { timeoutMs } : {}),
  };
}
