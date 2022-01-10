/**
 * Create a AsyncGenerator that yields some values.
 */
export function asyncGeneratorOf<T>(...source: Array<T>): AsyncGenerator<T> {
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next() {
      return Promise.resolve(source.length === 0 ? { done: true, value: undefined } : { done: false, value: source.shift()! });
    },
    throw(err) {
      throw err;
    },
    return() {
      return Promise.resolve({ done: true, value: undefined });
    },
  };
}
