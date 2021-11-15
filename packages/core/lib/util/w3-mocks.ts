import { isAsyncIterable } from "./is-async-iterable";

interface NodeVersion {
    major: number;
    minor: number;
}

function getNodeVersion(): NodeVersion | undefined {
    if (typeof process !== "undefined") {
        const [nodeMajorStr, nodeMinorStr] = process.versions.node.split(".");

        return {
            major: parseInt(nodeMajorStr),
            minor: parseInt(nodeMinorStr),
        };
    }
}

declare const _ReadableStream: typeof ReadableStream;

declare module "stream/web" {
    export const ReadableStream: typeof _ReadableStream;
}

export async function getReadableStreamCtor(): Promise<typeof ReadableStream> {
    if (typeof ReadableStream === "undefined") {
        const nodeVersion = getNodeVersion();

        if (nodeVersion != null) {
            if (nodeVersion.major > 16 || (nodeVersion.major === 16 && nodeVersion.minor >= 5)) {
                const { ReadableStream } = await import("stream/web");
                return ReadableStream;
            }
            const { Readable } = await import("stream");

            return class ReadableStreamPonyfill<T> extends Readable implements ReadableStream<T> {
                constructor(private underlyingSource?: UnderlyingSource<T>) {
                    super({
                        read() { },
                    });
                    const controller: ReadableStreamController<T> = {
                        desiredSize: Infinity,
                        enqueue: chunk => this.push(chunk),
                        error: e => this.destroy(e),
                        close: () => this.push(null),
                    };
                    this.underlyingSource?.start?.(controller);
                    this.on("close", () => this.underlyingSource?.cancel?.(controller));
                }

                get locked() {
                    return this.destroyed;
                }

                async cancel(reason: any) {
                    this.destroy(reason);
                }

                getReader() {
                    return {
                        read: () =>
                            new Promise<ReadableStreamDefaultReadResult<any>>((resolve) => {
                                this.once("data", (value) => resolve({ value, done: false }));
                                this.once("close", () => resolve({ done: true }));
                            }),
                        releaseLock: () => this.push(null),
                        close: () => this.push(null),
                        cancel: async (e: any) => this.destroy(e),
                        closed: Promise.resolve(undefined),
                    };
                }

                pipeTo(destination: any) {
                    return this.pipe(destination);
                }

                pipeThrough(destination: any) {
                    return this.pipe(destination);
                }

                tee(): [ReadableStream, ReadableStream] {
                    return [this, this];
                }

                forEach(fn: (value: any, key: number, stream: ReadableStream<T>) => void) {
                    this.on("data", value => fn(value, 0, this));
                }
            };
        }

        throw new Error("ReadableStream is not supported in this environment");
    }
    return ReadableStream;
}


class BodyPonyfill {
    constructor(private source?: ReadableStream | string) { }

    async text() {
        if (this.source) {
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
