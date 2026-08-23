import { describe, expect, it } from "bun:test";

import { decodePathParam } from "@/utils/urls/decode-path-param";

const validCases = [
	["a%20b", "a b"],
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

const malformedPercentCases = [
	["%ZZ", "�"],
	["%G1", "�"],
	["%1G", "�"],
	["%", "�"],
	["%A", "�A"],
	["%%20", "�0"],
	["%E0%A4%A", "��A"],
	// invalid hex while multi-byte bytes are still pending
	["%C3%ZZ", "��"],
	["%E2%82%GG", "��"],
	["%C3%", "��"],
	["%C3%A", "��A"],
	// a "%" that runs into another one, which the fallback router receives
	// whenever the url parser re-encodes the character after a literal "%"
	["%%", "��"],
	["%%%", "�"],
	["%%22", "�2"],
	["%2", "�2"],
	["%20%", " �"],
	["%aG", "�"],
	["%Ga", "�"],
] as const;

describe("decodePathParam", () => {
	it("should return an unescaped value unchanged", () => {
		expect(decodePathParam("a+b")).toBe("a+b");
	});

	it("should return an empty value unchanged", () => {
		expect(decodePathParam("")).toBe("");
	});

	it("should decode escapes on both sides of a long literal run", () => {
		const value = `%41${"b".repeat(200)}%41`;

		expect(decodePathParam(value)).toBe(`A${"b".repeat(200)}A`);
	});

	it("should decode the same value at every length around 32 characters", () => {
		// a length-gated fast path used to change the code path here
		for (let padding = 26; padding <= 40; padding++) {
			const value = `%20${"a".repeat(padding)}`;

			expect(decodePathParam(value)).toBe(` ${"a".repeat(padding)}`);
		}
	});

	it("should decode a run long enough to grow the shared byte buffer", () => {
		// the pending-byte buffer starts at 64 bytes and doubles from there
		const value = "%C3%A9".repeat(200);

		expect(decodePathParam(value)).toBe("é".repeat(200));
	});

	it("should take the no-escape shortcut for long values", () => {
		// long enough that a length-gated fast path would have taken a
		// different branch than a short value
		const value = "a+b-c".repeat(8);

		expect(value.length).toBeGreaterThanOrEqual(32);
		expect(value).not.toContain("%");
		expect(decodePathParam(value)).toBe(value);
	});

	it.each([
		["☕", "☕"],
		["中文", "中文"],
		["café", "café"],
		["a😀b", "a😀b"],
	] as const)(
		"should return the literal non-ASCII value %j unchanged",
		(encoded, expected) => {
			expect(decodePathParam(encoded)).toBe(expected);
		},
	);

	it.each(validCases)(
		"should decode the valid escape %j as %j",
		(encoded, expected) => {
			expect(decodePathParam(encoded)).toBe(expected);
		},
	);

	it.each(malformedUtf8Cases)(
		"should replace the malformed UTF-8 %j with %j like Bun's native router",
		(encoded, expected) => {
			expect(decodePathParam(encoded)).toBe(expected);
		},
	);

	it.each(malformedPercentCases)(
		"should replace the malformed percent escape %j with %j like Bun's native router",
		(encoded, expected) => {
			expect(decodePathParam(encoded)).toBe(expected);
		},
	);

	it("should decode dense ASCII escapes", () => {
		expect(decodePathParam("%61".repeat(64))).toBe("a".repeat(64));
	});

	it("should preserve long literal runs around an escape", () => {
		const prefix = "a".repeat(100);
		const suffix = "b".repeat(100);

		expect(decodePathParam(`${prefix}%20${suffix}`)).toBe(
			`${prefix} ${suffix}`,
		);
	});

	it("should preserve a long suffix after a malformed escape", () => {
		const prefix = "a".repeat(100);
		const suffix = "b".repeat(100);

		expect(decodePathParam(`${prefix}%ZZ${suffix}`)).toBe(
			`${prefix}�${suffix}`,
		);
	});

	it("should handle a long value ending in a bare percent", () => {
		const prefix = "a".repeat(40);

		expect(decodePathParam(`${prefix}%`)).toBe(`${prefix}�`);
	});

	it("should handle a long value ending in a one character escape", () => {
		const prefix = "a".repeat(40);

		expect(decodePathParam(`${prefix}%A`)).toBe(`${prefix}�A`);
	});

	it("should handle a long value ending in a complete escape", () => {
		const prefix = "a".repeat(40);

		expect(decodePathParam(`${prefix}%C3`)).toBe(`${prefix}�`);
	});

	it("should flush a multi-byte sequence before copying a long tail", () => {
		const prefix = "a".repeat(40);
		const suffix = "b".repeat(40);

		expect(decodePathParam(`${prefix}%C3%A9${suffix}`)).toBe(
			`${prefix}é${suffix}`,
		);
	});
});
