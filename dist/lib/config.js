import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { CliError, EXIT } from './errors.js';
const PROFILE_NAME = /^[A-Za-z0-9._-]+$/;
export function expandHome(path) {
    if (path === '~')
        return homedir();
    if (path.startsWith('~/') || path.startsWith('~\\'))
        return join(homedir(), path.slice(2));
    return path;
}
export function defaultConfig() {
    return { version: 1, defaultProfile: 'default', profiles: {} };
}
/** Matches the official CLI's platform-specific resolution exactly. */
export function configFilePath() {
    const override = process.env.GIBWORK_CONFIG_FILE?.trim();
    if (override)
        return resolve(expandHome(override));
    if (process.platform === 'darwin') {
        return join(homedir(), 'Library', 'Application Support', 'gibwork', 'config.json');
    }
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA?.trim();
        return join(appData || join(homedir(), 'AppData', 'Roaming'), 'gibwork', 'config.json');
    }
    const xdg = process.env.XDG_CONFIG_HOME?.trim();
    return join(xdg || join(homedir(), '.config'), 'gibwork', 'config.json');
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseProfile(raw, name) {
    if (!isRecord(raw)) {
        throw new CliError(`Profile "${name}" is not an object.`, 'CONFIG_ERROR', EXIT.CREDENTIAL);
    }
    const profile = {};
    const env = raw['environment'];
    if (env === 'stage' || env === 'production')
        profile.environment = env;
    if (typeof raw['apiUrl'] === 'string' && raw['apiUrl'])
        profile.apiUrl = raw['apiUrl'];
    if (typeof raw['timeoutMs'] === 'number' && Number.isInteger(raw['timeoutMs'])) {
        profile.timeoutMs = raw['timeoutMs'];
    }
    if (typeof raw['keypairPath'] === 'string' && raw['keypairPath']) {
        profile.keypairPath = raw['keypairPath'];
    }
    return profile;
}
/** An absent file is not an error — it just means no profiles are configured. */
export async function loadConfig() {
    const path = configFilePath();
    let text;
    try {
        text = await readFile(path, 'utf8');
    }
    catch (cause) {
        if (isRecord(cause) && cause['code'] === 'ENOENT')
            return defaultConfig();
        throw new CliError(`Could not read configuration at ${path}.`, 'CONFIG_ERROR', EXIT.CREDENTIAL, undefined, { cause });
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (cause) {
        throw new CliError(`Configuration at ${path} is not valid JSON.`, 'CONFIG_ERROR', EXIT.CREDENTIAL, undefined, { cause });
    }
    if (!isRecord(parsed) || parsed['version'] !== 1) {
        throw new CliError(`Configuration at ${path} is not a version 1 Gibwork config.`, 'CONFIG_ERROR', EXIT.CREDENTIAL);
    }
    const rawProfiles = isRecord(parsed['profiles']) ? parsed['profiles'] : {};
    const profiles = {};
    for (const [name, raw] of Object.entries(rawProfiles)) {
        profiles[name] = parseProfile(raw, name);
    }
    return {
        version: 1,
        defaultProfile: typeof parsed['defaultProfile'] === 'string' ? parsed['defaultProfile'] : 'default',
        profiles,
    };
}
/** Flag, then GIBWORK_PROFILE, then the file's defaultProfile. */
export function selectedProfileName(config, commandLineProfile) {
    const name = commandLineProfile?.trim() || process.env.GIBWORK_PROFILE?.trim() || config.defaultProfile;
    if (!PROFILE_NAME.test(name)) {
        throw new CliError('Profile names may contain letters, numbers, dots, underscores, and hyphens.', 'CONFIG_ERROR', EXIT.CREDENTIAL);
    }
    return name;
}
/** An unknown profile name resolves to an empty profile, as in the official CLI. */
export function getProfile(config, name) {
    return config.profiles[name] ?? {};
}
//# sourceMappingURL=config.js.map