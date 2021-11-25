
interface Writable { write: (chunk: any) => void; end: () => void; on: (event: 'close', callback: VoidFunction) => void }

type Callback<T> = (result: ReadableStreamDefaultReadResult<T>) => void;

class ReadableStreamPonyfill<T> {
    constructor(private source: UnderlyingSource<T>) { }

    getReader() {
        let listening = true;
        const pullQueue: Callback<T>[] = [];
        const pushQueue: ReadableStreamDefaultReadResult<T>[] = [];

        const pushValue = (value: T) => {
            if (pullQueue.length !== 0) {
                pullQueue.shift()!({ value, done: false } as const);
            } else {
                pushQueue.push({ value, done: false });
            }
        };

        const pushDone = () => {
            if (pullQueue.length !== 0) {
                pullQueue.shift()!({ value: undefined, done: true } as const);
            } else {
                pushQueue.push({ value: undefined, done: true } as const);
            }
        };

        const pullValue = () =>
            new Promise<ReadableStreamDefaultReadResult<T>>(resolve => {
                if (pushQueue.length !== 0) {
                    const element = pushQueue.shift()!;
                    resolve(element);
                } else {
                    pullQueue.push(resolve);
                }
            });

        const emptyQueue = () => {
            if (listening) {
                listening = false;
                for (const resolve of pullQueue) {
                    resolve({ value: undefined, done: true } as const);
                }
                pullQueue.length = 0;
                pushQueue.length = 0;
            }
            return Promise.resolve({ value: undefined, done: true } as const);
        };

        const controller: ReadableStreamController<T> = {
            desiredSize: Infinity,
            error: () => {
            },
            enqueue: (value: T) => {
                pushValue(value);
            },
            close: () => {
                pushDone();
            }
        };
        this.source.start?.(controller);
        return {
            async read() {
                return listening ? pullValue() : emptyQueue();
            },
            releaseLock: () => {
                emptyQueue();
                this.source.cancel?.(controller);
            },
            cancel: async () => {
                emptyQueue();
                this.source.cancel?.(controller);
            },
            closed: Promise.resolve(undefined),
        }
    }

    private errorCallbacks: ((error: Error) => void)[] = [];

    on(event: "error", callback: () => void) {
        if (event === 'error') {
            this.errorCallbacks.push(callback);
        }
    }

    pipe(writable: Writable): Writable {
        const controller: ReadableStreamController<T> = {
            desiredSize: Infinity,
            error: e => {
                while (this.errorCallbacks.length !== 0) {
                    this.errorCallbacks.shift()?.(e);
                }
            },
            enqueue: value => writable.write(value),
            close: () => writable.end(),
        };
        this.source.start?.(controller);
        writable.on("close", () => this.source.cancel?.());

        return writable;
    }
}

export const ReadableStream: typeof globalThis.ReadableStream = globalThis.ReadableStream || ReadableStreamPonyfill;
