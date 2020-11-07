"use strict";
exports.__esModule = true;
exports.isAsyncIterable = void 0;
exports.isAsyncIterable = function (maybeAsyncIterable) {
  if (maybeAsyncIterable == null || typeof maybeAsyncIterable !== "object") {
    return false;
  }
  return typeof maybeAsyncIterable[Symbol.asyncIterator] === "function";
};
