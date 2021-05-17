export const stopAsyncIteration = <T>(
  asyncIterable: AsyncIterable<T>
): void => {
  const method = asyncIterable[Symbol.asyncIterator];
  const asyncIterator = method.call(asyncIterable);
  if (asyncIterator.return) {
    asyncIterator.return();
  }
};
