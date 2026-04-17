export const isString = function (value) {
  return typeof value === 'string';
};

export const isNumber = function (value) {
  return typeof value === 'number';
};

export const isDate = function (value) {
  return toString.call(value) === '[object Date]';
};

export const isArray = function (arr) {
  return Array.isArray(arr);
};

export const isFunction = function (value) {
  return typeof value === 'function';
};

export const isBoolean = function (value) {
  return typeof value === 'boolean';
};

export const isDefined = function (value) {
  return typeof value !== 'undefined';
};

export const isUndefined = function (value) {
  return typeof value === 'undefined';
};

export const isObject = function (value) {
  return value !== null && typeof value === 'object';
};

export const isPromise = function (obj) {
  return (
    !!obj &&
    (typeof obj === 'object' || typeof obj === 'function') &&
    typeof obj.then === 'function'
  );
};

export const isError = function (value) {
  const tag = toString.call(value);
  switch (tag) {
    case '[object Error]':
      return true;
    case '[object Exception]':
      return true;
    case '[object DOMException]':
      return true;
    default:
      return value instanceof Error;
  }
};
