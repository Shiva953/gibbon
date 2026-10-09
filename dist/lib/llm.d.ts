import { z } from 'zod';
import type { BountyEntry } from '../types.js';
/** Opus 5. Override with --model. */
export declare const DEFAULT_MODEL = "claude-opus-5";
declare const AgentResult: z.ZodObject<{
    yaml: z.ZodString;
    changes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        action: z.ZodEnum<{
            create: "create";
            update: "update";
            remove: "remove";
            unchanged: "unchanged";
        }>;
        detail: z.ZodString;
    }, z.core.$strip>>;
    refused: z.ZodArray<z.ZodObject<{
        request: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>>;
    assumptions: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type AgentResult = z.infer<typeof AgentResult>;
export interface EditRequest {
    prompt: string;
    currentYaml: string;
    entries: BountyEntry[];
    /** ids that exist on Gibwork right now, so the immutability rules apply. */
    liveIds: string[];
    model?: string;
}
/**
 * Fails before the request when no credential source exists. The SDK's own
 * error for this is about internal resolution and useless to a user, so check
 * the same sources first and say what to actually do.
 */
export declare function assertAnthropicCredentials(): void;
/**
 * Asks Claude to rewrite bounties.yaml. The result is never trusted: the
 * caller re-parses it with our own loader, and `plan` checks it against live
 * state afterwards. The model produces a reviewable file, not an action.
 */
export declare function requestEdit(request: EditRequest): Promise<AgentResult>;
export {};
//# sourceMappingURL=llm.d.ts.map