/**
 * Map yielded async generator values.
 */
export function asyncIterableMap<T, O>(source: AsyncIterable<T>, mapper: (input: T) => Promise<O> | O): AsyncGenerator<O> {
  const iterator = source[Symbol.asyncIterator]();

  async function mapResult(result: IteratorResult<T, O>): Promise<IteratorResult<O>> {
    if (result.done) {
      return result;
    }
    try {
      return { value: await mapper(result.value), done: false };
    } catch (error) {
      try {
        await iterator.return?.();
      } catch (_error) {
        /* ignore error */
      }
      throw error;
    }
  }

  const stream: AsyncGenerator<O> = {
    [Symbol.asyncIterator]() {
      return stream;
    },
    async next() {
      return await mapResult(await iterator.next());
    },
    async return() {
      const promise = iterator.return?.();
      return promise ? await mapResult(await promise) : { value: undefined as any, done: true };
    },
    async throw(error: unknown) {
      const promise = iterator.throw?.();
      if (promise) {
        return await mapResult(await promise);
      }
      // if the source has no throw method we just re-throw error
      // usually throw is not called anyways
      throw error;
    },
  };

  return stream;
}
