export function calculateStringByteLength(str: string): number {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    return encoded.length;
}
