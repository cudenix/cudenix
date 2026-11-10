import { describe, expect, it } from "bun:test";

import { HEX_VALUES } from "@/utils/urls/hex-values";

describe("HEX_VALUES", () => {
	it("should cover every byte", () => {
		expect(HEX_VALUES).toBeInstanceOf(Int8Array);
		expect(HEX_VALUES).toHaveLength(256);
	});

	it("should own a 256-byte ArrayBuffer", () => {
		expect(HEX_VALUES.buffer).toBeInstanceOf(ArrayBuffer);
		expect(HEX_VALUES.buffer.byteLength).toBe(256);
		expect(HEX_VALUES.byteOffset).toBe(0);
		expect(HEX_VALUES.byteLength).toBe(256);
	});

	it("should map '0'-'9' to 0-9", () => {
		for (let digit = 0; digit <= 9; digit++) {
			expect(HEX_VALUES[String(digit).charCodeAt(0)]).toBe(digit);
		}
	});

	it("should map 'a'-'f' and 'A'-'F' to 10-15", () => {
		for (const [index, letter] of [..."abcdef"].entries()) {
			expect(HEX_VALUES[letter.charCodeAt(0)]).toBe(10 + index);
			expect(HEX_VALUES[letter.toUpperCase().charCodeAt(0)]).toBe(
				10 + index,
			);
		}
	});

	it("should map every other byte to -1", () => {
		const hex = new Set("0123456789abcdefABCDEF");

		for (let byte = 0; byte < 256; byte++) {
			if (!hex.has(String.fromCharCode(byte))) {
				expect(HEX_VALUES[byte]).toBe(-1);
			}
		}
	});

	it("should return undefined out of bounds", () => {
		expect(HEX_VALUES[256]).toBeUndefined();
		expect(HEX_VALUES[-1]).toBeUndefined();
		expect(HEX_VALUES[8364]).toBeUndefined();
		expect(HEX_VALUES[Number.NaN]).toBeUndefined();
	});
});
