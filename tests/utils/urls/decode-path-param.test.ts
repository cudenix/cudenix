import { describe, expect, it } from "bun:test";

import { decodePathParam } from "@/utils/urls/decode-path-param";

describe("decodePathParam", () => {
	it("should return an unescaped value unchanged", () => {
		expect(decodePathParam("plain+value")).toBe("plain+value");
	});

	it("should decode valid UTF-8 and escaped separators", () => {
		const validCases = [
			["hello%20world", "hello world"],
			["a+b%20c", "a+b c"],
			["%c3%a9", "é"],
			["%00", "\u0000"],
			["%C2%80", "\u0080"],
			["%E0%A0%80", "\u0800"],
			["%E2%82%AC", "€"],
			["%ED%9F%BF", "\uD7FF"],
			["%EE%80%80", "\uE000"],
			["%F0%90%80%80", "\u{10000}"],
			["%F0%9F%98%80", "😀"],
			["%F4%8F%BF%BF", "\u{10FFFF}"],
			["%2F", "/"],
			["%252F", "%2F"],
		] as const;

		for (let i = 0; i < validCases.length; i++) {
			const [encoded, expected] = validCases[i]!;

			expect(decodePathParam(encoded)).toBe(expected);
		}
	});

	it("should replace malformed UTF-8 like Bun's native router", () => {
		const malformedUtf8Cases = [
			["%FF", "�"],
			["%FE%FF", "��"],
			["a%FFb", "a�b"],
			["%80%80", "��"],
			["%C0%AF", "�"],
			["%C2", "�"],
			["%E0%A4", "�"],
			["%ED%A0%80", "�"],
			["%ED%BF%BF", "�"],
			["%E0%80%80", "�"],
			["%F0%80%80%80", "�"],
			["%F4%90%80%80", "�"],
			["%F5%80%80%80", "�"],
			["%F8%80%80%80%80", "�����"],
			["%E2%28%A1", "�(�"],
			["%E2%82%41", "�A"],
		] as const;

		for (let i = 0; i < malformedUtf8Cases.length; i++) {
			const [encoded, expected] = malformedUtf8Cases[i]!;

			expect(decodePathParam(encoded)).toBe(expected);
		}
	});

	it("should replace malformed percent escapes like Bun's native router", () => {
		const malformedPercentCases = [
			["%ZZ", "�"],
			["%G1", "�"],
			["%1G", "�"],
			["%", "�"],
			["%A", "�A"],
			["%%20", "�0"],
			["%E0%A4%A", "��A"],
		] as const;

		for (let i = 0; i < malformedPercentCases.length; i++) {
			const [encoded, expected] = malformedPercentCases[i]!;

			expect(decodePathParam(encoded)).toBe(expected);
		}
	});
});
