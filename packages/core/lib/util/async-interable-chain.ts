/**
 * Chain async generators in sequence
 */
export function asyncIterableChain<T>(...subjects: Array<AsyncIterable<T>>): AsyncGenerator<T, void> {
  const iterators = subjects.map((subject) => subject[Symbol.asyncIterator]());

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next() {
      if (iterators.length === 0) {
        return Promise.resolve({ value: undefined, done: true });
      }
      const iterator = iterators[0];
      const value = await iterator.next();
      if (value.done === true) {
        if (iterator === iterators[0]) {
          iterators.shift();
        }
        return this.next();
      }
      return value;
    },
    throw(err) {
      throw err;
    },
    return() {
      iterators.forEach((iterator) => iterator.return?.());
      return Promise.resolve({ value: undefined, done: true });
    },
  };
}
