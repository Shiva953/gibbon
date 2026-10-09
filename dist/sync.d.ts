import type { Command } from 'commander';
import type { RuntimeFactory } from './runtime.js';
export declare const DEFAULT_FILE = "bounties.yaml";
/**
 * Registers the sync verbs onto any commander command. The portable unit: it
 * knows only how to get a Runtime, not how credentials or global flags were
 * resolved, so the same file serves `gibbon plan` and a hypothetical
 * `gibwork sync plan` unchanged.
 */
export declare function registerSync(parent: Command, getRuntime: RuntimeFactory): Command;
//# sourceMappingURL=sync.d.ts.map