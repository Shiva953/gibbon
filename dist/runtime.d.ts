import type { GibworkClient, WalletSigner } from '@gibwork/sdk';
import type { CredentialSource } from './lib/gibworkClient.js';
import type { Environment } from './types.js';
/**
 * Everything a sync command needs in order to talk to Gibwork.
 *
 * The field names mirror @gibwork/cli's own `createRuntime()` return value, so
 * the commands would drop into their runtime unchanged if this work were ever
 * upstreamed — this file being the only thing deleted.
 */
export interface Runtime {
    client: GibworkClient;
    signer: WalletSigner;
    signal?: AbortSignal;
    output: {
        json: boolean;
        quiet: boolean;
    };
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
/** The host owns this: standalone uses the implementation below, an embedding CLI its own. */
export type RuntimeFactory = () => Promise<Runtime>;
/**
 * The standalone implementation. Every setting resolves flag -> env -> profile
 * -> default, exactly as the official CLI does.
 */
export declare function createRuntime(options?: RuntimeOptions): Promise<Runtime>;
//# sourceMappingURL=runtime.d.ts.map