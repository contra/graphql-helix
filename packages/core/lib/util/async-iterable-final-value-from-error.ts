/**
 * Format
 */
export function asyncIterableFinalValueFromError<T>(
  source: AsyncIterable<T>,
  formatError: (error: unknown) => T
): AsyncGenerator<T, void> {
  const iterator = source[Symbol.asyncIterator]();

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next() {
      try {
        return await iterator.next();
      } catch (err) {
        iterator.return?.();
        return { value: formatError(err), done: false };
      }
    },
    throw(err) {
      throw err;
    },
    return() {
      iterator.return?.();
      return Promise.resolve({ value: undefined, done: true });
    },
  };
}
