import { isAsyncIterable } from "./is-async-iterable.ts";

type Callback<T> = (result: ReadableStreamDefaultReadResult<T>) => void;

export const ReadableStream = globalThis.ReadableStream || class ReadableStreamPonyfill<T> {
    constructor(private source: UnderlyingSource<T>) { }

    async * [Symbol.asyncIterator]() {
        const reader = this.getReader();
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            yield value;
        }
        reader.releaseLock();
    }

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
} as unknown as typeof globalThis['ReadableStream'];

class BodyPonyfill implements Body {
    public body: ReadableStream | null = null;
    constructor(bodyInit: BodyInit | null) {
        if (bodyInit != null) {
            if (typeof bodyInit === "string") {
                this.body = new ReadableStream({
                    start(controller) {
                        controller.enqueue(bodyInit);
                        controller.close();
                    }
                });
            } else if (isAsyncIterable(bodyInit)) {
                this.body = new ReadableStream({
                    async start(controller) {
                        for await (const chunk of bodyInit as any) {
                            controller.enqueue(chunk);
                        }
                        controller.close();
                    }
                });
            } else if ('getReader' in bodyInit) {
                this.body = bodyInit;
            }
        }
    }

    get bodyUsed() {
        return this.body?.locked ?? false;
    }

    private async uint8array(): Promise<Uint8Array> {
        if (this.body != null) {
            const textEncoder = new TextEncoder();
            const reader = this.body.getReader();
            const chunks = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                if (value instanceof Uint8Array) {
                    chunks.push(...value);
                }
                if (typeof value === 'string') {
                    chunks.push(...textEncoder.encode(value));
                }
            }
            return Uint8Array.from(chunks);
        }
        return new Uint8Array();
    }

    async arrayBuffer() {
        const uint8array = await this.uint8array();
        return uint8array.buffer;
    }

    blob(): Promise<Blob> {
        throw new Error('Not implemented');
    }

    async formData(): Promise<FormData> {
        throw new Error('Not implemented');
    }

    async text() {
        const textDecoder = new TextDecoder();
        return textDecoder.decode(await this.uint8array());
    }

    async json() {
        const text = await this.text();
        if (text) {
            return JSON.parse(text);
        }
    }
}

export const Request =
    globalThis.Request ||
    class RequestPonyfill extends BodyPonyfill implements Request {
        public cache = 'default' as const;
        public credentials = 'include' as const;
        public destination = '' as const;
        public headers: Headers;
        public integrity = '';
        public keepalive = true;
        public method: string;
        public mode = 'no-cors' as const;
        public redirect = 'follow' as const;
        public referrer = '';
        public referrerPolicy = '' as const;
        public signal = {} as any;
        public url: string;
        constructor(
            info: RequestInfo,
            init?: RequestInit
        ) {
            super((typeof info === 'string' ? init?.body : info.body) || null);
            this.url = typeof info === 'string' ? info : info.url;
            this.method = (typeof info === 'string' ? init?.method : info.method) || 'GET';
            this.headers = new HeadersPonyfill((typeof info === 'string' ? init?.headers : info.headers) || {});
        }

        clone(): Request {
            return new Request(this);
        }
    };

class HeadersPonyfill implements Headers {
    private headersMap = new Map<string, string[]>();

    constructor(init: HeadersInit) {
        if (Array.isArray(init)) {
            for (const [name, value] of init) {
                this.append(name, value);
            }
        } else if (typeof init.forEach === 'function') {
            init.forEach((value, name) => {
                this.append(name, value);
            });
        } else {
            for (const key in init) {
                this.append(key, (init as Record<string, string>)[key]);
            }
        }
    }

    get(name: string) {
        const values = this.headersMap.get(name.toLowerCase());
        if (values) {
            return values.join(',');
        }
        return null;
    }

    set(name: string, value: string) {
        this.headersMap.set(name.toLowerCase(), [value]);
    }

    append(name: string, value: string) {
        let values = this.headersMap.get(name.toLowerCase());
        if (!values) {
            values = [];
            this.headersMap.set(name.toLowerCase(), values);
        }
        values.push(value);
    }

    has(name: string) {
        return this.headersMap.has(name.toLowerCase());
    }

    delete(name: string) {
        this.headersMap.delete(name.toLowerCase());
    }

    forEach(fn: (value: string, name: string, headers: Headers) => void) {
        this.headersMap.forEach((values, name) => {
            for (const value of values) {
                fn(value, name, this);
            }
        });
    }
}

export const Response =
    globalThis.Response ||
    class ResponsePonyfill extends BodyPonyfill implements Response {
        public headers: Headers;
        public status: number;
        public statusText: string;
        public ok: boolean;
        public type = 'basic' as const;
        public url = '';
        public redirected = false;
        constructor(
            body: BodyInit | null,
            init?: ResponseInit
        ) {
            super(body);
            this.headers = new HeadersPonyfill(init?.headers || {});
            this.status = init?.status ?? 200;
            this.statusText = init?.statusText ?? "OK";
            this.ok = this.status >= 200 && this.status < 300;
        }

        clone(): Response {
            return new Response(super.body, this)
        }
    } as any as typeof globalThis['Response'];
