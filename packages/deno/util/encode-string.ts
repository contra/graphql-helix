import { Buffer } from "https://deno.land/std@0.85.0/node/buffer.ts";
const textEncoder = new TextEncoder();
export function encodeString(str: string): Uint8Array {
    if ('Buffer' in globalThis) {
        return Buffer.from(str, 'utf8');
    }
    return textEncoder.encode(str);
}