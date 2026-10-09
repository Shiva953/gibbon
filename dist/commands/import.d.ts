import type { TaskDetails } from '@gibwork/sdk';
import type { Runtime } from '../runtime.js';
import type { BountyEntry, LiveTask } from '../types.js';
export interface ImportOptions {
    file: string;
    /** Overwrite a non-empty bounties.yaml. */
    force?: boolean;
}
/** A readable, stable key derived from the title. Never the Gibwork UUID. */
export declare function slugify(title: string): string;
/**
 * Builds a file entry that round-trips to zero drift. Only fields the diff
 * compares are written; `deadline` is omitted because Gibwork assigns one at
 * creation and an omitted optional field is unmanaged.
 */
export declare function toEntry(id: string, details: TaskDetails, live: LiveTask): BountyEntry;
/**
 * Generates bounties.yaml and .gibwork/state.json from this wallet's live
 * tasks, so an existing creator can adopt gibbon without a hand-written
 * file — which would otherwise plan `+ create` over bounties that already
 * exist and fund duplicates.
 *
 * Self-checking: the generated file is diffed against the live state it came
 * from, and anything but a no-op is reported rather than written.
 */
export declare function importCommand(runtime: Runtime, options: ImportOptions): Promise<void>;
//# sourceMappingURL=import.d.ts.map