import { isAsyncIterable } from "./is-async-iterable.ts";

type Callback<T> = (result: IteratorResult<T> ) => void;

export const ReadableStream = globalThis.ReadableStream || class ReadableStream<T> {
    constructor(private source: UnderlyingSource<T>) {}
    getReader() {
        let listening = true;
        const pullQueue: Callback<T>[] = [];
        const pushQueue: IteratorResult<T>[] = [];

        const pushValue = (value: T) => {
            if (pullQueue.length !== 0) {
                pullQueue.shift()!({ value, done: false });
            } else {
                pushQueue.push({ value, done: false });
            }
        };

        const pushDone = () => {
            if (pullQueue.length !== 0) {
                pullQueue.shift()!({ value: undefined, done: true });
            } else {
                pushQueue.push({ value: undefined, done: true });
            }
        };

        const pullValue = () =>
            new Promise<IteratorResult<T>>(resolve => {
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
                    resolve({ value: undefined, done: true });
                }
                pullQueue.length = 0;
                pushQueue.length = 0;
            }
            return Promise.resolve({ value: undefined, done: true });
        };

        const controller = {
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
            }
        }
    }
};

class BodyPonyfill {
    constructor(private source?: ReadableStream | string) { }

    async text() {
        if (this.source != null) {
            if (typeof this.source === "string") {
                return this.source;
            } else if (isAsyncIterable(this.source)) {
                const chunks = [];
                for await (const chunk of this.source) {
                    chunks.push(chunk);
                }
                return chunks.join("");
            } else if ("getReader" in this.source) {
                const reader = this.source.getReader();
                const chunks = [];
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    chunks.push(value);
                }
                return chunks.join("");
            }
        }
        return undefined;
    }

    async json() {
        const text = await this.text();
        if (text) {
            return JSON.parse(text);
        }
    }

    get body() {
        const oneTimeGenerator = (val: any) =>
            async function* () {
                yield val;
            };
        if (typeof this.source === "string") {
            return {
                getReader: () => ({
                    read: async () => ({
                        done: true,
                        value: this.source,
                    }),
                    releaseLock: () => { },
                }),
                [Symbol.asyncIterator]: oneTimeGenerator(this.source),
            };
        } else {
            return this.source;
        }
    }
}

export const Request =
    globalThis.Request ||
    class Request extends BodyPonyfill {
        constructor(
            public url: string,
            private init?: {
                headers?: Record<string, string>;
                method?: string;
                body?: ReadableStream | string;
            }
        ) {
            super(init?.body);
        }

        get headers() {
            return {
                get: (name: string) => {
                    return this.init?.headers?.[name];
                },
                forEach: (fn: (value: string | undefined, name: string) => void) => {
                    const headersObj = this.init?.headers || {};
                    for (const key in headersObj) {
                        fn(headersObj[key], key);
                    }
                },
            };
        }

        get method() {
            return this.init?.method ?? "GET";
        }
    };

export const Response =
    globalThis.Response ||
    class Response extends BodyPonyfill {
        constructor(
            source: ReadableStream | string,
            private init?: {
                headers: Record<string, string>;
                status?: number;
            }
        ) {
            super(source);
        }

        get headers() {
            return {
                get: (name: string) => {
                    return this.init?.headers?.[name];
                },
                forEach: (fn: (value: string | undefined, name: string) => void) => {
                    const headersObj = this.init?.headers || {};
                    for (const key in headersObj) {
                        fn(headersObj[key], key);
                    }
                },
            };
        }

        get status() {
            return this.init?.status ?? 200;
        }
    };
