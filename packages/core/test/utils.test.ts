import { calculateByteLength } from "../lib/util/calculate-byte-length";

describe("utils", () => {
    describe("calculateByteLength", () => {
        it('should calculate strings with UTF-8 characters', () => {
            const str = "Hello World";
            const byteLength = calculateByteLength(str);
            expect(byteLength).toBe(str.length);
        });
        it('should calculate strings with emojis correctly', () => {
            const stringWithEmoji = 'Nice 😋';
            const byteLength = calculateByteLength(stringWithEmoji);
            expect(byteLength).toEqual(Buffer.byteLength(stringWithEmoji));
        });
        it("should calculate byte length of a string that has both UTF-8 and non UTF-8 characters correctly", () => {
            const complexString = [
                0x7f,
                0x7ff,
                0xffff,
                0xdc00,
                0xdfff
            ].map(code => String.fromCharCode(code)).join('A');
            const byteLength = calculateByteLength(complexString);
            expect(byteLength).toEqual(Buffer.byteLength(complexString));
        });
    });
});
