import { isAsyncIterable } from "../is-async-iterable";
import { ReadableStream } from "../w3-ponyfills/ReadableStream";

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
            } else if ('getReader' in bodyInit && typeof bodyInit.getReader === 'function') {
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

export {
    BodyPonyfill as Body
}