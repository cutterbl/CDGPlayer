import type { LoaderErrorCode, LoaderErrorContext } from './types.js';

/**
 * Structured error type emitted by cdg-loader APIs.
 */
export class LoaderError extends Error {
  readonly code: LoaderErrorCode;
  readonly retriable: boolean;
  readonly context: LoaderErrorContext;
  readonly causeValue?: unknown;

  constructor({
    code,
    message,
    retriable,
    context = {},
    causeValue,
  }: {
    code: LoaderErrorCode;
    message: string;
    retriable: boolean;
    context?: LoaderErrorContext;
    causeValue?: unknown;
  }) {
    super(message);
    this.name = 'LoaderError';
    this.code = code;
    this.retriable = retriable;
    this.context = context;
    this.causeValue = causeValue;
  }
}
