export const isAsyncIterable = <T>(maybeAsyncIterable: unknown): maybeAsyncIterable is AsyncIterable<T> => {
  if (maybeAsyncIterable == null || typeof maybeAsyncIterable !== "object") {
    return false;
  }

  return typeof (maybeAsyncIterable as any)[Symbol.asyncIterator] === "function";
};
