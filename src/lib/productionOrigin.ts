import type { FetchImplementation } from '@gibwork/sdk';
import type { Environment } from '../types.js';
import { CliError, EXIT } from './errors.js';

/** The only origin production operations may talk to. */
export const OFFICIAL_PRODUCTION_API_ORIGIN = 'https://sdk.gib.work';

function assertOfficialOrigin(url: URL, direction: 'request' | 'response'): void {
  if (url.origin !== OFFICIAL_PRODUCTION_API_ORIGIN || url.username !== '' || url.password !== '') {
    throw new CliError(
      `Refusing production ${direction} for untrusted API origin ${url.origin}.`,
      'CONFIG_ERROR',
      EXIT.CREDENTIAL,
    );
  }
}

/**
 * Refuses to point a production wallet anywhere but the official API.
 *
 * Without this, exposing --api-url would hand anyone a way to route a
 * production signing wallet at an endpoint they control. Stage is left
 * configurable on purpose; production is not.
 */
export function assertProductionApiOrigin(environment: Environment, apiUrl: string): void {
  if (environment !== 'production') return;
  const url = new URL(apiUrl);
  if (
    url.origin !== OFFICIAL_PRODUCTION_API_ORIGIN ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new CliError(
      `Production operations must use ${OFFICIAL_PRODUCTION_API_ORIGIN}.`,
      'CONFIG_ERROR',
      EXIT.CREDENTIAL,
    );
  }
}

type FetchArgs = Parameters<typeof fetch>;

/**
 * A fetch that re-checks the origin on the way out AND on the way back, and
 * refuses redirects. A redirect to another host would otherwise carry the
 * wallet-signed auth headers off the official origin.
 */
async function pinnedFetch(input: FetchArgs[0], init?: FetchArgs[1]): Promise<Response> {
  const requestUrl =
    typeof input === 'string'
      ? new URL(input)
      : input instanceof URL
        ? new URL(input.toString())
        : new URL(input.url);

  assertOfficialOrigin(requestUrl, 'request');

  const response = await globalThis.fetch(input, { ...init, redirect: 'error' });
  if (response.url) assertOfficialOrigin(new URL(response.url), 'response');
  return response;
}

/**
 * Bun's ambient `typeof fetch` declares a `preconnect` helper that Node's does
 * not. The SDK only ever calls the function itself, so widening here is safe
 * and keeps the shim free of runtime-specific shims.
 */
export const pinnedProductionFetch = pinnedFetch as unknown as FetchImplementation;

/** Validates an API URL before it reaches the SDK. */
export function validateApiUrl(value: string, allowInsecureHttp = false): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch (cause) {
    throw new CliError('API URL must be a valid URL.', 'CONFIG_ERROR', EXIT.CREDENTIAL, undefined, {
      cause,
    });
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new CliError('API URL must use HTTPS or HTTP.', 'CONFIG_ERROR', EXIT.CREDENTIAL);
  }
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol === 'http:' && !loopback && !allowInsecureHttp) {
    throw new CliError(
      'Refusing plain HTTP for a non-loopback API URL. Pass --allow-insecure-http to override.',
      'CONFIG_ERROR',
      EXIT.CREDENTIAL,
    );
  }
  return url.toString();
}
