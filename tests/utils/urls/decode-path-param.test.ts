import { describe, expect, it, spyOn } from "bun:test";

import { decodePathParam } from "@/utils/urls/decode-path-param";

const CJK = "%E6%97%A5%E6%9C%AC%E8%AA%9E";

const countNativeCalls = (
	value: string,
): { calls: number; decoded: string } => {
	const spy = spyOn(globalThis, "decodeURIComponent");

	try {
		const decoded = decodePathParam(value);

		return { calls: spy.mock.calls.length, decoded };
	} finally {
		spy.mockRestore();
	}
};

describe("decodePathParam", () => {
	describe("valid escapes", () => {
		it("should return a value without escapes unchanged", () => {
			expect(decodePathParam("a+b/é")).toBe("a+b/é");
		});

		it.each([
			["a+b%20c", "a+b c"],
			["%00", "\u0000"],
			["%7F", "\u007F"],
			["%252F", "%2F"],
			["%c3%A9", "é"],
			["%C2%80", "\u0080"],
			["%DF%BF", "߿"],
			["%E0%A0%80", "ࠀ"],
			["%ED%9F%BF", "퟿"],
			["%EE%80%80", ""],
			["%F0%90%80%80", "\u{10000}"],
			["%F4%8F%BF%BF", "\u{10FFFF}"],
			["xy%41zw%42uv", "xyAzwBuv"],
			["%41xyz%42", "AxyzB"],
			["é%20☕", "é ☕"],
		] as const)("should decode %j as %j", (encoded, expected) => {
			expect(decodePathParam(encoded)).toBe(expected);
		});
	});

	describe("malformed escapes", () => {
		it.each([
			["%FF", "�"],
			["%80%BF", "��"],
			["%F8%80", "��"],
			["%C1%BF", "�"],
			["%E0%9F%BF", "�"],
			["%F0%8F%BF%BF", "�"],
			["%ED%A0%80", "�"],
			["%ED%BF%BF", "�"],
			["%F4%90%80%80", "�"],
		] as const)(
			"should replace the invalid UTF-8 %j with %j",
			(encoded, expected) => {
				expect(decodePathParam(encoded)).toBe(expected);
			},
		);

		it.each([
			["%C2", "�"],
			["%E0%A4", "�"],
			["%C3a%A9", "�a�"],
			["%C3%C3%A9", "�é"],
			["%E2%82%41", "�A"],
			["%C3%ZZ", "��"],
			["%C3%AG", "��"],
			["%C3%A", "��A"],
			["%C3%Ā1", "��Ā1"],
			["%C3%AĀ", "��Ā"],
		] as const)(
			"should replace the truncated sequence %j with %j",
			(encoded, expected) => {
				expect(decodePathParam(encoded)).toBe(expected);
			},
		);

		it.each([
			["%", "�"],
			["%A", "�A"],
			["a%ZZb", "a�b"],
			["%G1", "�"],
			["%1G", "�"],
			["%%20", "�0"],
		] as const)(
			"should replace the broken escape %j with %j",
			(encoded, expected) => {
				expect(decodePathParam(encoded)).toBe(expected);
			},
		);

		it.each([
			["%éa", "�éa"],
			["%1é", "�é"],
			["%０１", "�０１"],
			["%2Ā", "�Ā"],
		] as const)(
			"should replace the broken escape %j with %j without dropping the non-ASCII character after it",
			(encoded, expected) => {
				expect(decodePathParam(encoded)).toBe(expected);
			},
		);
	});

	describe("native decoder path", () => {
		it.each([
			["a dense non-ASCII run", CJK, "日本語"],
			[
				"a dense run behind a literal prefix",
				`user/${CJK}`,
				"user/日本語",
			],
			[
				"18 characters opening on a three byte sequence",
				"%E6%97%A5abc%C3%A9",
				"日abcé",
			],
			[
				"24 characters opening on a two byte sequence",
				`${"%C3%A9".repeat(3)}abc%41`,
				"éééabcA",
			],
			[
				"48 characters opening on four ASCII escapes",
				`${"a%20".repeat(11)}ab%20`,
				`${"a ".repeat(11)}ab `,
			],
			[
				"a dense opening behind a 15 character prefix",
				`${"p".repeat(15)}${"%20a".repeat(12)}`,
				`${"p".repeat(15)}${" a".repeat(12)}`,
			],
			[
				"a fourth escape inside the first 32 characters",
				`%20%20%20${"x".repeat(22)}%20${"y".repeat(14)}%20`,
				`   ${"x".repeat(22)} ${"y".repeat(14)} `,
			],
			[
				"a last escape 12 characters before the end",
				`${"a%20".repeat(12)}${"x".repeat(9)}`,
				`${"a ".repeat(12)}${"x".repeat(9)}`,
			],
		] as const)("should decode %s natively", (_, value, decoded) => {
			expect(countNativeCalls(value)).toEqual({ calls: 1, decoded });
		});

		it.each([
			[
				"17 characters opening on a three byte sequence",
				"%E6%97%A5ab%C3%A9",
				"日abé",
			],
			[
				"18 characters opening on a two byte sequence",
				"%D0%B0%D0%B1%D0%B2",
				"абв",
			],
			[
				"23 characters opening on a two byte sequence",
				`${"%C3%A9".repeat(3)}ab%41`,
				"éééabA",
			],
			["a run opening on an ASCII escape", `%7E${CJK}`, "~日本語"],
			[
				"a literal right after the first escape",
				`%E6abc${"%C3%A9".repeat(3)}%41`,
				"�abcéééA",
			],
			[
				"a literal right after the second escape",
				`%C3%A9abc${"%C3%A9".repeat(3)}`,
				"éabcééé",
			],
			["a literal end", `${"%C3%A9".repeat(4)}abc`, "ééééabc"],
			[
				"47 characters opening on four ASCII escapes",
				"a%20".repeat(12),
				"a ".repeat(12),
			],
			[
				"a dense opening behind a 16 character prefix",
				`${"p".repeat(16)}${"%20a".repeat(12)}`,
				`${"p".repeat(16)}${" a".repeat(12)}`,
			],
			[
				"a fourth escape past the first 32 characters",
				`%20%20%20${"x".repeat(23)}%20${"y".repeat(14)}%20`,
				`   ${"x".repeat(23)} ${"y".repeat(14)} `,
			],
			[
				"a last escape 13 characters before the end",
				`${"a%20".repeat(12)}${"x".repeat(10)}`,
				`${"a ".repeat(12)}${"x".repeat(10)}`,
			],
			[
				"a long dense value ending in a cut escape",
				`${"a%20".repeat(12)}%2`,
				`${"a ".repeat(12)}�2`,
			],
			[
				"a long value with a single escape",
				`v%2F${"segment-".repeat(10)}`,
				`v/${"segment-".repeat(10)}`,
			],
		] as const)(
			"should keep %s on the tolerant decoder",
			(_, value, decoded) => {
				expect(countNativeCalls(value)).toEqual({ calls: 0, decoded });
			},
		);

		it("should fall back to the tolerant decoder when the native one throws", () => {
			expect(countNativeCalls(`%80${CJK}`)).toEqual({
				calls: 1,
				decoded: "�日本語",
			});
		});
	});
});
