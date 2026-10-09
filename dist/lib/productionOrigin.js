import { CliError, EXIT } from './errors.js';
/** The only origin production operations may talk to. */
export const OFFICIAL_PRODUCTION_API_ORIGIN = 'https://sdk.gib.work';
function assertOfficialOrigin(url, direction) {
    if (url.origin !== OFFICIAL_PRODUCTION_API_ORIGIN || url.username !== '' || url.password !== '') {
        throw new CliError(`Refusing production ${direction} for untrusted API origin ${url.origin}.`, 'CONFIG_ERROR', EXIT.CREDENTIAL);
    }
}
/**
 * Refuses to point a production wallet anywhere but the official API —
 * otherwise --api-url would route a production signing wallet at an endpoint
 * the caller controls. Stage stays configurable on purpose.
 */
export function assertProductionApiOrigin(environment, apiUrl) {
    if (environment !== 'production')
        return;
    const url = new URL(apiUrl);
    if (url.origin !== OFFICIAL_PRODUCTION_API_ORIGIN ||
        url.username !== '' ||
        url.password !== '' ||
        url.pathname !== '/' ||
        url.search !== '' ||
        url.hash !== '') {
        throw new CliError(`Production operations must use ${OFFICIAL_PRODUCTION_API_ORIGIN}.`, 'CONFIG_ERROR', EXIT.CREDENTIAL);
    }
}
/**
 * Re-checks the origin on the way out and on the way back, and refuses
 * redirects — a redirect would carry wallet-signed auth headers off the
 * official origin.
 */
async function pinnedFetch(input, init) {
    const requestUrl = typeof input === 'string'
        ? new URL(input)
        : input instanceof URL
            ? new URL(input.toString())
            : new URL(input.url);
    assertOfficialOrigin(requestUrl, 'request');
    const response = await globalThis.fetch(input, { ...init, redirect: 'error' });
    if (response.url)
        assertOfficialOrigin(new URL(response.url), 'response');
    return response;
}
/** Bun's ambient `typeof fetch` declares a `preconnect` helper Node's does not. */
export const pinnedProductionFetch = pinnedFetch;
/** Validates an API URL before it reaches the SDK. */
export function validateApiUrl(value, allowInsecureHttp = false) {
    let url;
    try {
        url = new URL(value.trim());
    }
    catch (cause) {
        throw new CliError('API URL must be a valid URL.', 'CONFIG_ERROR', EXIT.CREDENTIAL, undefined, {
            cause,
        });
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new CliError('API URL must use HTTPS or HTTP.', 'CONFIG_ERROR', EXIT.CREDENTIAL);
    }
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol === 'http:' && !loopback && !allowInsecureHttp) {
        throw new CliError('Refusing plain HTTP for a non-loopback API URL. Pass --allow-insecure-http to override.', 'CONFIG_ERROR', EXIT.CREDENTIAL);
    }
    return url.toString();
}
//# sourceMappingURL=productionOrigin.js.map