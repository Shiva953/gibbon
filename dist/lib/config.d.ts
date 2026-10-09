import type { Environment } from '../types.js';
/**
 * Reads the same configuration file @gibwork/cli writes, so profiles set with
 * `gibwork config set` work here with no extra setup. Read-only: the file is
 * owned by the official CLI.
 */
export interface Profile {
    environment?: Environment;
    apiUrl?: string;
    timeoutMs?: number;
    keypairPath?: string;
}
export interface GibworkConfig {
    version: 1;
    defaultProfile: string;
    profiles: Record<string, Profile>;
}
export declare function expandHome(path: string): string;
export declare function defaultConfig(): GibworkConfig;
/** Matches the official CLI's platform-specific resolution exactly. */
export declare function configFilePath(): string;
/** An absent file is not an error — it just means no profiles are configured. */
export declare function loadConfig(): Promise<GibworkConfig>;
/** Flag, then GIBWORK_PROFILE, then the file's defaultProfile. */
export declare function selectedProfileName(config: GibworkConfig, commandLineProfile?: string): string;
/** An unknown profile name resolves to an empty profile, as in the official CLI. */
export declare function getProfile(config: GibworkConfig, name: string): Profile;
//# sourceMappingURL=config.d.ts.map