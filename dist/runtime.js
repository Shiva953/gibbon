import { DEFAULT_GIBWORK_API_URL } from '@gibwork/sdk';
import { getProfile, loadConfig, selectedProfileName } from './lib/config.js';
import { buildClient, resolveCredential } from './lib/gibworkClient.js';
import { CliError, EXIT } from './lib/errors.js';
import { assertProductionApiOrigin, validateApiUrl } from './lib/productionOrigin.js';
const MAX_TIMEOUT_MS = 10 * 60 * 1000;
function parseEnvironmentValue(value, origin) {
    if (value === undefined || value === null || value === '')
        return undefined;
    if (value === 'stage' || value === 'production')
        return value;
    throw new CliError(`${origin} must be either 'stage' or 'production'.`, 'CONFIG_ERROR', EXIT.CREDENTIAL);
}
function resolveTimeout(value) {
    if (value === undefined || value === '')
        return undefined;
    const ms = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(ms) || ms <= 0 || ms > MAX_TIMEOUT_MS) {
        throw new CliError(`Timeout must be a positive whole number of milliseconds, at most ${MAX_TIMEOUT_MS}.`, 'CONFIG_ERROR', EXIT.CREDENTIAL);
    }
    return ms;
}
/**
 * The standalone implementation. Every setting resolves flag -> env -> profile
 * -> default, exactly as the official CLI does.
 */
export async function createRuntime(options = {}) {
    const config = await loadConfig();
    const profileName = selectedProfileName(config, options.profile);
    const profile = getProfile(config, profileName);
    const environment = options.environment ??
        parseEnvironmentValue(process.env.GIBWORK_ENVIRONMENT?.trim(), 'GIBWORK_ENVIRONMENT') ??
        profile.environment ??
        'stage';
    const apiUrl = validateApiUrl(options.apiUrl ?? process.env.GIBWORK_API_URL?.trim() ?? profile.apiUrl ?? DEFAULT_GIBWORK_API_URL, options.allowInsecureHttp);
    // Production may only ever talk to the official origin.
    assertProductionApiOrigin(environment, apiUrl);
    const timeoutMs = resolveTimeout(options.timeout ?? process.env.GIBWORK_TIMEOUT_MS?.trim() ?? profile.timeoutMs);
    const credential = await resolveCredential({
        ...(options.keypair ? { keypair: options.keypair } : {}),
        ...(options.privateKeyStdin ? { privateKeyStdin: true } : {}),
    }, profile);
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
//# sourceMappingURL=runtime.js.map