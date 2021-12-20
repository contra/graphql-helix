// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isAsyncIterable = <T>(maybeAsyncIterable: any): maybeAsyncIterable is AsyncIterable<T> => {
  return !!maybeAsyncIterable?.[Symbol.asyncIterator];
};
