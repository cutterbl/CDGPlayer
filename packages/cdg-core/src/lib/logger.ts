/**
 * Standard log passthrough used by core package internals.
 */
export const log = (...args: readonly unknown[]): void => {
  console.log(...args);
};

/**
 * Warning log passthrough used by recoverable parser/instruction warnings.
 */
export const warn = (...args: readonly unknown[]): void => {
  console.warn(...args);
};

/**
 * Error log passthrough used by fatal runtime failures.
 */
export const error = (...args: readonly unknown[]): void => {
  console.error(...args);
};

export default {
  log,
  warn,
  error,
};
