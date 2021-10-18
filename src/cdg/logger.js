/* eslint-disable no-console */

export function log(...args) {
  console && console.log && console.log(...args);
}

export function warn(...args) {
  console && console.warn && console.warn(...args);
}

export function error(...args) {
  console && console.error && console.error(...args);
}

export default {
  log,
  warn,
  error,
};
