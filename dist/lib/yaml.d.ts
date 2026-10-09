import type { BountyEntry } from '../types.js';
import { CliError } from './errors.js';
export declare class BountyFileError extends CliError {
    readonly name = "BountyFileError";
    constructor(message: string);
}
/** Parses and validates bounties.yaml. */
export declare function loadBounties(path: string): BountyEntry[];
/** The pure half of loadBounties, testable without the disk. */
export declare function parseBounties(raw: string, label?: string): BountyEntry[];
/** Serializes entries back to YAML. Used by `import`. */
export declare function dumpBounties(entries: BountyEntry[]): string;
export declare function saveBounties(path: string, entries: BountyEntry[]): void;
//# sourceMappingURL=yaml.d.ts.map