import { describe, expect, it, spyOn } from "bun:test";

import { decodePathParam } from "@/utils/urls/decode-path-param";

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
		it("should return an unescaped value unchanged", () => {
			expect(decodePathParam("a+b")).toBe("a+b");
		});

		it("should return an empty value unchanged", () => {
			expect(decodePathParam("")).toBe("");
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

		it.each([
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
			["%C3%A9", "é"],
			["%e2%9C%93", "✓"],
			["%c3%A9", "é"],
			["%3F", "?"],
			["%23", "#"],
			["%26", "&"],
			["%3D", "="],
			["%2B", "+"],
			["%3B", ";"],
			["%09", "\t"],
			["%0A", "\n"],
			["%0D", "\r"],
			["%7F", "\u007F"],
			["a%00b", "a\u0000b"],
		] as const)(
			"should decode the valid escape %j as %j",
			(encoded, expected) => {
				expect(decodePathParam(encoded)).toBe(expected);
			},
		);

		it.each([
			["xy%41zw%42uv", "xyAzwBuv"],
			["%41xy", "Axy"],
			["%41xyz", "Axyz"],
			["%EF%BB%BFa", "\uFEFFa"],
			["%DF%BF", "\u07FF"],
			["\uD800%20", "\uD800 "],
		] as const)(
			"should decode %j around its literal runs as %j",
			(encoded, expected) => {
				expect(decodePathParam(encoded)).toBe(expected);
			},
		);

		it("should decode dense ASCII escapes", () => {
			expect(decodePathParam("%61".repeat(64))).toBe("a".repeat(64));
		});
	});

	describe("malformed escapes", () => {
		it.each([
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
			["%ED%A0%80%ED%B0%80", "��"],
			["%C1%BF", "�"],
			["%FC%84%80%80%80%80", "������"],
		] as const)(
			"should replace the malformed UTF-8 %j with %j like Bun's native router",
			(encoded, expected) => {
				expect(decodePathParam(encoded)).toBe(expected);
			},
		);

		it.each([
			["%ZZ", "�"],
			["%G1", "�"],
			["%1G", "�"],
			["%", "�"],
			["%A", "�A"],
			["%%20", "�0"],
			["%E0%A4%A", "��A"],
			["%C3%ZZ", "��"],
			["%E2%82%GG", "��"],
			["%C3%", "��"],
			["%C3%A", "��A"],
			["%%", "��"],
			["%%%", "�"],
			["%%22", "�2"],
			["%2", "�2"],
			["%20%", " �"],
			["%aG", "�"],
			["%Ga", "�"],
		] as const)(
			"should replace the malformed percent escape %j with %j like Bun's native router",
			(encoded, expected) => {
				expect(decodePathParam(encoded)).toBe(expected);
			},
		);

		it.each([
			["%é", "�é"],
			["%1é", "�é"],
			["%[é", "�é"],
			["%✓", "�✓"],
			["%😀", "�😀"],
			["a%✓b", "a�✓b"],
			["%C3%A9%é", "é�é"],
			["%Ā", "�Ā"],
			["%０１", "�０１"],
			["%2Ā", "�Ā"],
		] as const)(
			"should replace the malformed percent escape %j with %j without dropping the character after it",
			(encoded, expected) => {
				expect(decodePathParam(encoded)).toBe(expected);
			},
		);

		it.each([
			["%F0%9F%98", "�"],
			["%C3%C3%A9", "�é"],
			["%C3a%A9", "�a�"],
			["%C3xA9", "�xA9"],
			["%F0%8F%BF%BF", "�"],
			["%E0%9F%BF", "�"],
		] as const)(
			"should replace the truncated sequence %j with %j",
			(encoded, expected) => {
				expect(decodePathParam(encoded)).toBe(expected);
			},
		);

		it.each([
			["%4%41", "�41"],
			["%+1", "�"],
			["% 1", "�"],
		] as const)(
			"should replace the broken escape in %j giving %j",
			(encoded, expected) => {
				expect(decodePathParam(encoded)).toBe(expected);
			},
		);
	});

	describe("long values", () => {
		it("should decode escapes on both sides of a long literal run", () => {
			expect(decodePathParam(`%41${"b".repeat(200)}%41`)).toBe(
				`A${"b".repeat(200)}A`,
			);
		});

		it("should decode the same value at every length around 32 characters", () => {
			for (let padding = 26; padding <= 40; padding++) {
				expect(decodePathParam(`%20${"a".repeat(padding)}`)).toBe(
					` ${"a".repeat(padding)}`,
				);
			}
		});

		it("should decode a run long enough to grow the shared byte buffer", () => {
			expect(decodePathParam("%C3%A9".repeat(200))).toBe("é".repeat(200));
		});

		it("should grow the shared byte buffer on a run of invalid bytes", () => {
			expect(decodePathParam("%FF".repeat(600))).toBe("�".repeat(600));
		});

		it("should decode a run that alternates valid and invalid bytes", () => {
			expect(decodePathParam("%C3%A9%FF".repeat(240))).toBe(
				"é�".repeat(240),
			);
		});

		it("should flush a grown buffer around a literal run", () => {
			const run = "%C3%A9".repeat(200);

			expect(decodePathParam(`${run}zzz${run}`)).toBe(
				`${"é".repeat(200)}zzz${"é".repeat(200)}`,
			);
		});

		it("should take the no-escape shortcut for long values", () => {
			const value = "a+b-c".repeat(8);

			expect(value.length).toBeGreaterThanOrEqual(32);
			expect(value).not.toContain("%");
			expect(decodePathParam(value)).toBe(value);
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

	describe("native decoder path", () => {
		const cjk = "%E6%97%A5%E6%9C%AC%E8%AA%9E";

		it("should decode a dense non-ASCII run natively", () => {
			expect(countNativeCalls(cjk)).toEqual({
				calls: 1,
				decoded: "日本語",
			});
			expect(countNativeCalls(`user/${cjk}`)).toEqual({
				calls: 1,
				decoded: "user/日本語",
			});
			expect(countNativeCalls("%F0%9F%98%80".repeat(2))).toEqual({
				calls: 1,
				decoded: "😀😀",
			});
			expect(countNativeCalls(`${"%C3%A9".repeat(3)}abc%41`)).toEqual({
				calls: 1,
				decoded: "éééabcA",
			});
		});

		it("should keep a short run on the tolerant decoder", () => {
			expect(countNativeCalls("%C3%A9%C3%A9")).toEqual({
				calls: 0,
				decoded: "éé",
			});
			expect(countNativeCalls(`${"%C3%A9".repeat(3)}ab%41`)).toEqual({
				calls: 0,
				decoded: "éééabA",
			});
		});

		it("should keep a run opening on an ASCII escape on the tolerant decoder", () => {
			expect(countNativeCalls(`%20${cjk}`)).toEqual({
				calls: 0,
				decoded: " 日本語",
			});
			expect(countNativeCalls(`%2F${cjk}`)).toEqual({
				calls: 0,
				decoded: "/日本語",
			});
		});

		it("should keep a sparse run on the tolerant decoder", () => {
			const literal = "a".repeat(40);

			expect(countNativeCalls(`%C3%A9${literal}`)).toEqual({
				calls: 0,
				decoded: `é${literal}`,
			});
			expect(countNativeCalls(`%C3%A9${literal}%C3%A9`)).toEqual({
				calls: 0,
				decoded: `é${literal}é`,
			});
			expect(countNativeCalls(`${"%C3%A9".repeat(4)}${literal}`)).toEqual(
				{ calls: 0, decoded: `éééé${literal}` },
			);
			expect(
				countNativeCalls(
					"caf%C3%A9%20au%20lait%2C%20s%27il%20vous%20plaisir",
				),
			).toEqual({ calls: 0, decoded: "café au lait, s'il vous plaisir" });
		});

		it("should decode a two character run of three byte sequences natively", () => {
			expect(countNativeCalls("%E6%97%A5%E6%9C%AC")).toEqual({
				calls: 1,
				decoded: "日本",
			});
			expect(countNativeCalls("%C3%B1%C3%A1%C3%A9")).toEqual({
				calls: 0,
				decoded: "ñáé",
			});
			expect(countNativeCalls("%E6%97%A5%C3%A9")).toEqual({
				calls: 0,
				decoded: "日é",
			});
		});

		it("should decode a long value that opens dense natively", () => {
			expect(
				countNativeCalls(
					"caf%C3%A9%20au%20lait%2C%20s%27il%20vous%20pla%C3%AEt",
				),
			).toEqual({ calls: 1, decoded: "café au lait, s'il vous plaît" });
			expect(
				countNativeCalls(
					"%7B%22id%22%3A123%2C%22theme%22%3A%22dark%22%2C%22lang%22%3A%22es%22%7D",
				),
			).toEqual({
				calls: 1,
				decoded: '{"id":123,"theme":"dark","lang":"es"}',
			});
			expect(
				countNativeCalls(
					`a%20b%20c%20d%20${"x".repeat(24)}%20y%20z%20`,
				),
			).toEqual({ calls: 1, decoded: `a b c d ${"x".repeat(24)} y z ` });
		});

		it("should switch a dense opening exactly at 48 characters", () => {
			expect(countNativeCalls("a%20".repeat(12))).toEqual({
				calls: 0,
				decoded: "a ".repeat(12),
			});
			expect(countNativeCalls(`${"a%20".repeat(11)}ab%20`)).toEqual({
				calls: 1,
				decoded: `${"a ".repeat(11)}ab `,
			});
		});

		it("should keep a long value that opens sparse on the tolerant decoder", () => {
			const literal = "segment-".repeat(10);

			expect(countNativeCalls(`v%2F${literal}`)).toEqual({
				calls: 0,
				decoded: `v/${literal}`,
			});
			expect(
				countNativeCalls(`a%20b%20c%20${"x".repeat(30)}%20y%20z%20`),
			).toEqual({ calls: 0, decoded: `a b c ${"x".repeat(30)} y z ` });
		});

		it("should keep a dense opening with a long literal end on the tolerant decoder", () => {
			expect(
				countNativeCalls(`${"a%20".repeat(12)}${"x".repeat(10)}`),
			).toEqual({
				calls: 0,
				decoded: `${"a ".repeat(12)}${"x".repeat(10)}`,
			});
			expect(
				countNativeCalls(`${"a%20".repeat(12)}${"x".repeat(9)}`),
			).toEqual({
				calls: 1,
				decoded: `${"a ".repeat(12)}${"x".repeat(9)}`,
			});
		});

		it("should keep a dense value behind a long prefix on the tolerant decoder", () => {
			expect(
				countNativeCalls(`${"p".repeat(16)}${"%20a".repeat(12)}`),
			).toEqual({
				calls: 0,
				decoded: `${"p".repeat(16)}${" a".repeat(12)}`,
			});
			expect(
				countNativeCalls(`${"p".repeat(15)}${"%20a".repeat(12)}`),
			).toEqual({
				calls: 1,
				decoded: `${"p".repeat(15)}${" a".repeat(12)}`,
			});
		});

		it("should keep a long dense value ending in a cut escape on the tolerant decoder", () => {
			expect(countNativeCalls(`${"a%20".repeat(12)}%2`)).toEqual({
				calls: 0,
				decoded: `${"a ".repeat(12)}�2`,
			});
		});

		it("should fall back once when a long dense value is malformed", () => {
			for (const [value, expected] of [
				[`${"a%20".repeat(12)}%ZZ`, `${"a ".repeat(12)}�`],
				[`caf%E9${"%20a".repeat(12)}`, `caf�${" a".repeat(12)}`],
			] as const) {
				expect(countNativeCalls(value)).toEqual({
					calls: 1,
					decoded: expected,
				});
			}
		});

		it("should not switch on a non-hexadecimal escape", () => {
			expect(countNativeCalls(`%ZZ${cjk}`)).toEqual({
				calls: 0,
				decoded: "�日本語",
			});
			expect(countNativeCalls(`%é${cjk}`)).toEqual({
				calls: 0,
				decoded: "�é日本語",
			});
		});

		it("should fall back to the tolerant decoder when the native one throws", () => {
			for (const [value, expected] of [
				[`${"%E2%82%AC".repeat(7)}%ED%A0%80`, "€€€€€€€�"],
				["%C0%80".repeat(4), "����"],
				[`${"%F0%9F%98%80".repeat(2)}%C0%80`, "😀😀�"],
				[`${cjk}%E2%82`, "日本語�"],
				[`${cjk}%FF%FE`, "日本語��"],
				[`${cjk}%E2%82%41`, "日本語�A"],
				["%F4%90%80%80".repeat(2), "��"],
			] as const) {
				expect(countNativeCalls(value)).toEqual({
					calls: 1,
					decoded: expected,
				});
			}
		});
	});
});
