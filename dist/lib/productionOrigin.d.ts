import type { FetchImplementation } from '@gibwork/sdk';
import type { Environment } from '../types.js';
/** The only origin production operations may talk to. */
export declare const OFFICIAL_PRODUCTION_API_ORIGIN = "https://sdk.gib.work";
/**
 * Refuses to point a production wallet anywhere but the official API —
 * otherwise --api-url would route a production signing wallet at an endpoint
 * the caller controls. Stage stays configurable on purpose.
 */
export declare function assertProductionApiOrigin(environment: Environment, apiUrl: string): void;
/** Bun's ambient `typeof fetch` declares a `preconnect` helper Node's does not. */
export declare const pinnedProductionFetch: FetchImplementation;
/** Validates an API URL before it reaches the SDK. */
export declare function validateApiUrl(value: string, allowInsecureHttp?: boolean): string;
//# sourceMappingURL=productionOrigin.d.ts.map