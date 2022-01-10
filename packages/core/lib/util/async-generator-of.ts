/**
 * Create a AsyncGenerator that yields some values.
 */
export function asyncGeneratorOf<T>(...source: Array<T>): AsyncGenerator<T> {
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next() {
      if (source.length === 0) {
        return Promise.resolve({ done: true, value: undefined });
      }

      return Promise.resolve({ done: false, value: source.shift()! });
    },
    throw(err) {
      throw err;
    },
    return() {
      return Promise.resolve({ done: true, value: undefined });
    },
  };
}
