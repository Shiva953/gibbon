import { GibworkClient } from '@gibwork/sdk';
import type { WalletSigner } from '@gibwork/sdk';
import type { Environment } from '../types.js';
import type { Profile } from './config.js';
import { CliError } from './errors.js';
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
export declare const MAX_KEY_BYTES: number;
/** A printable description of where the key came from. Never key material. */
export type CredentialSource = string;
export declare class CredentialError extends CliError {
    readonly name = "CredentialError";
    constructor(message: string, options?: ErrorOptions);
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
/** Resolves the signing wallet. The key never leaves this function as a value. */
export declare function resolveCredential(options: CredentialOptions, profile?: Profile): Promise<ResolvedCredential>;
/** Stage unless production is asked for by name. */
export declare function resolveEnvironment(env?: Environment): Environment;
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
export declare function buildClient(options: ClientOptions): GibworkClient;
//# sourceMappingURL=gibworkClient.d.ts.map