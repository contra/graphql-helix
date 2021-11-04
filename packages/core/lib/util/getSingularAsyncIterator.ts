export async function* getSingularAsyncIterator<T>(value: T): AsyncIterator<T> {
    yield value;
}