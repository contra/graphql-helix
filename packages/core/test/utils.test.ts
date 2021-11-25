import { calculateByteLength } from "../lib/util/calculate-byte-length";

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

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
        it("should calculate byte length of a random string that has both UTF-8 and non UTF-8 characters correctly", () => {
            let randomString = "";
            for (let i = 0; i < 25; i++) {
                randomString += String.fromCharCode(getRandomInt(0, 0xffff));
            }
            const byteLength = calculateByteLength(randomString);
            expect(byteLength).toEqual(Buffer.byteLength(randomString));
        });
    });
});
