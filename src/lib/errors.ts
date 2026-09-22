import {
  GibworkAmbiguousSubmitError,
  GibworkApiError,
  GibworkNetworkError,
  GibworkProtocolError,
  GibworkTimeoutError,
  GibworkValidationError,
} from '@gibwork/sdk';

/**
 * Exit codes. 0-29 are reproduced from @gibwork/cli's table and must not be
 * redefined, so a CI script reads the same code from either tool.
 *
 * The 30s are ours, and are deliberately NOT errors: the run succeeded, but
 * live state is not what the file asked for.
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
 * Order matters: ambiguous-submit and timeout both extend GibworkNetworkError,
 * and reporting an ambiguous submit as a network failure would advise a retry,
 * which is exactly wrong.
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
