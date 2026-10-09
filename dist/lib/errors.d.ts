/**
 * Exit codes. 0-29 are reproduced from @gibwork/cli's table and must not be
 * redefined, so a CI script reads the same code from either tool.
 *
 * The 30s are ours, and are deliberately NOT errors: the run succeeded, but
 * live state is not what the file asked for.
 */
export declare const EXIT: {
    readonly OK: 0;
    readonly INTERNAL: 1;
    readonly USAGE: 2;
    readonly CREDENTIAL: 10;
    readonly API: 20;
    readonly NETWORK: 21;
    readonly AMBIGUOUS_SUBMIT: 22;
    /** Entries the API cannot satisfy in place. Desired state not reached. */
    readonly BLOCKED: 30;
    /** An interrupted operation is still unresolved. `apply` stays blocked. */
    readonly UNRESOLVED: 31;
    readonly CANCELLED: 130;
};
/** An error that carries its own machine code and exit status. */
export declare class CliError extends Error {
    readonly name: string;
    readonly code: string;
    readonly exitCode: number;
    readonly details: Record<string, unknown> | undefined;
    constructor(message: string, code: string, exitCode?: number, details?: Record<string, unknown>, options?: ErrorOptions);
}
export interface NormalizedError {
    code: string;
    exitCode: number;
    message: string;
    details?: Record<string, unknown>;
}
/**
 * Maps any thrown value onto the official code/exit pair.
 *
 * Order matters: ambiguous-submit and timeout both extend GibworkNetworkError,
 * and reporting an ambiguous submit as a network failure would advise a retry,
 * which is exactly wrong.
 */
export declare function normalizeError(error: unknown): NormalizedError;
//# sourceMappingURL=errors.d.ts.map