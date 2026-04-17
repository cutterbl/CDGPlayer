/**
 * Severity channels supported by scoped loggers.
 */
export type LoggerSeverity = 'log' | 'info' | 'warn' | 'error';

/**
 * Named arguments for severity logger methods.
 */
export interface LoggerMethodArgs {
  message: unknown;
  [key: string]: unknown;
}

/**
 * Named arguments for debug logger method.
 */
export interface DebugLoggerMethodArgs {
  severity?: LoggerSeverity;
  message: unknown;
  [key: string]: unknown;
}

const isSeverity = (value: unknown): value is LoggerSeverity =>
  value === 'log' || value === 'info' || value === 'warn' || value === 'error';

/**
 * Public logger contract used across CXing runtime packages.
 *
 * All methods emitted from a scoped logger include a `[scope]` prefix.
 * `debug()` is gated by the scoped logger's `debug` flag.
 * Direct severity methods (`log/info/warn/error`) always emit and are not gated.
 */
export interface CxingLogger {
  /** Emits a standard log line. */
  log: ({ message, ...args }: LoggerMethodArgs) => void;
  /** Emits informational runtime events that should not be debug-gated. */
  info: ({ message, ...args }: LoggerMethodArgs) => void;
  /** Emits warning-level runtime events. */
  warn: ({ message, ...args }: LoggerMethodArgs) => void;
  /** Alias for `warn` for naming compatibility with different code styles. */
  warning: ({ message, ...args }: LoggerMethodArgs) => void;
  /** Emits error-level runtime events that should not be debug-gated. */
  error: ({ message, ...args }: LoggerMethodArgs) => void;
  /**
   * Emits debug output only when debug mode is enabled.
   *
   * Required form: `debug({ message, severity?, ...namedData })`.
   * `message` is required and `severity` defaults to `log`.
   */
  debug: ({ severity, message, ...args }: DebugLoggerMethodArgs) => void;
}

/** Writes to `console.log`. */
export const log = ({ message, ...args }: LoggerMethodArgs): void => {
  const payload = Object.values(args).filter((value) => value !== undefined);
  if (payload.length > 0) {
    console.log(message, ...payload);
    return;
  }

  console.log(message);
};

/** Writes to `console.info`. */
export const info = ({ message, ...args }: LoggerMethodArgs): void => {
  const payload = Object.values(args).filter((value) => value !== undefined);
  if (payload.length > 0) {
    console.info(message, ...payload);
    return;
  }

  console.info(message);
};

/** Writes to `console.warn`. */
export const warn = ({ message, ...args }: LoggerMethodArgs): void => {
  const payload = Object.values(args).filter((value) => value !== undefined);
  if (payload.length > 0) {
    console.warn(message, ...payload);
    return;
  }

  console.warn(message);
};

/** Alias for `warn`. */
export const warning = ({ message, ...args }: LoggerMethodArgs): void => {
  warn({ message, ...args });
};

/** Writes to `console.error`. */
export const error = ({ message, ...args }: LoggerMethodArgs): void => {
  const payload = Object.values(args).filter((value) => value !== undefined);
  if (payload.length > 0) {
    console.error(message, ...payload);
    return;
  }

  console.error(message);
};

/**
 * Creates a scope-prefixed logger.
 *
 * @param scope Prefix label used for every emitted message.
 * @param debug Enables/disables `debug(...)` emissions. Defaults to `false`.
 */
export const createScopedLogger = ({
  scope,
  debug = false,
}: {
  scope: string;
  debug?: boolean;
}): CxingLogger => {
  const prefix = `[${scope}]`;

  const logger: CxingLogger = {
    log: ({ message, ...args }: LoggerMethodArgs): void => {
      log({ message: prefix, scopeMessage: message, ...args });
    },
    info: ({ message, ...args }: LoggerMethodArgs): void => {
      info({ message: prefix, scopeMessage: message, ...args });
    },
    warn: ({ message, ...args }: LoggerMethodArgs): void => {
      warn({ message: prefix, scopeMessage: message, ...args });
    },
    warning: ({ message, ...args }: LoggerMethodArgs): void => {
      warn({ message: prefix, scopeMessage: message, ...args });
    },
    error: ({ message, ...args }: LoggerMethodArgs): void => {
      error({ message: prefix, scopeMessage: message, ...args });
    },
    debug: ({
      severity = 'log',
      message,
      ...args
    }: DebugLoggerMethodArgs): void => {
      if (!debug) {
        return;
      }

      const normalizedSeverity = isSeverity(severity) ? severity : 'log';
      logger[normalizedSeverity]({ message, ...args });
    },
  };

  return logger;
};

export default {
  log,
  info,
  warn,
  warning,
  error,
  createScopedLogger,
};
