// returns the byte length of an utf8 string
export function calculateByteLength(str: string): number {
  let byteLength = str.length;
  for (let i = str.length - 1; i >= 0; i--) {
    const code = str.charCodeAt(i);
    if (code > 0x7f && code <= 0x7ff) {
        byteLength++;
    } else if (code > 0x7ff && code <= 0xffff) {
        byteLength += 2;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
        // trail surrogate
        i--; 
    }
  }
  return byteLength;
}
