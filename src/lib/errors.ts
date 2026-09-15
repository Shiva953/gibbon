import {
  GibworkAmbiguousSubmitError,
  GibworkApiError,
  GibworkNetworkError,
  GibworkProtocolError,
  GibworkTimeoutError,
  GibworkValidationError,
} from '@gibwork/sdk';

/**
 * Exit codes, matching @gibwork/cli exactly.
 *
 * Aligning these is not cosmetic: a CI script that tests for a specific code
 * must mean the same thing whichever tool produced it. 0-29 are reproduced
 * from the official CLI's table and must not be redefined here.
 *
 * The 30s are ours. The CLI already uses 30 for a non-error "not ready"
 * verdict (`gibwork mcp doctor`), and that is exactly what BLOCKED and
 * UNRESOLVED are — the run succeeded, but live state is not what the file
 * asked for. They are deliberately NOT errors.
 */
export const EXIT = {
  OK: 0,
  INTERNAL: 1,
  USAGE: 2,
  CREDENTIAL: 10,
  API: 20,
  NETWORK: 21,
  AMBIGUOUS_SUBMIT: 22,
  /** Entries the API cannot satisfy in place. Desired state not reached. */
  BLOCKED: 30,
  /** An interrupted operation is still unresolved. `apply` stays blocked. */
  UNRESOLVED: 31,
  CANCELLED: 130,
} as const;

/** An error that carries its own machine code and exit status. */
export class CliError extends Error {
  override readonly name: string = 'CliError';
  readonly code: string;
  readonly exitCode: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code: string,
    exitCode: number = EXIT.INTERNAL,
    details?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
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
 * Order matters: GibworkAmbiguousSubmitError and GibworkTimeoutError both
 * extend GibworkNetworkError, so the specific cases have to be tested first
 * or an ambiguous submit would be reported as a plain network failure — and
 * "retry" is exactly the wrong advice for one of those.
 */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof CliError) {
    return {
      code: error.code,
      exitCode: error.exitCode,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
  }

  if (error instanceof GibworkAmbiguousSubmitError) {
    return {
      code: 'AMBIGUOUS_SUBMIT',
      exitCode: EXIT.AMBIGUOUS_SUBMIT,
      message:
        'The submit outcome is unknown. Read the current state with ' +
        '`gibwork-sync status`; do not apply again.',
      details: { ...error.context },
    };
  }

  if (error instanceof GibworkTimeoutError) {
    return { code: 'TIMEOUT_ERROR', exitCode: EXIT.NETWORK, message: error.message };
  }

  if (error instanceof GibworkNetworkError) {
    return { code: 'NETWORK_ERROR', exitCode: EXIT.NETWORK, message: error.message };
  }

  if (error instanceof GibworkApiError) {
    return {
      code: 'API_ERROR',
      exitCode: EXIT.API,
      message: error.message,
      details: {
        status: error.status,
        ...(error.requestId ? { requestId: error.requestId } : {}),
      },
    };
  }

  if (error instanceof GibworkValidationError) {
    return { code: 'USAGE_ERROR', exitCode: EXIT.USAGE, message: error.message };
  }

  if (error instanceof GibworkProtocolError) {
    return { code: 'PROTOCOL_ERROR', exitCode: EXIT.INTERNAL, message: error.message };
  }

  return {
    code: 'INTERNAL_ERROR',
    exitCode: EXIT.INTERNAL,
    message: error instanceof Error ? error.message : String(error),
  };
}
