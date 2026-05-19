import { describe, expect, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";
import type { RequiredKeys } from "@/types/required-keys";

describe("RequiredKeys", () => {
	describe("plain required keys", () => {
		test("should resolve to the union of all keys when every property is required", () => {
			type Source = { a: string; b: number; c: boolean };

			const check: ExtendsType<
				RequiredKeys<Source>,
				"a" | "b" | "c"
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to a single key for a single-property object", () => {
			type Source = { only: string };

			const check: ExtendsType<RequiredKeys<Source>, "only"> = true;

			expect(check).toBe(true);
		});
	});

	describe("optional modifier exclusion", () => {
		test("should exclude a key declared with the `?` optional modifier", () => {
			type Source = { keep: string; maybe?: string };

			const check: ExtendsType<RequiredKeys<Source>, "keep"> = true;

			expect(check).toBe(true);
		});

		test("should exclude every `?`-marked key when multiple are optional", () => {
			type Source = { a: string; b?: number; c?: boolean; d: string };

			const check: ExtendsType<RequiredKeys<Source>, "a" | "d"> = true;

			expect(check).toBe(true);
		});
	});

	describe("undefined-bearing value exclusion", () => {
		test("should exclude a key whose value union contains `undefined`", () => {
			type Source = { name: string; age: number | undefined };

			const check: ExtendsType<RequiredKeys<Source>, "name"> = true;

			expect(check).toBe(true);
		});

		test("should exclude a key whose value is exactly `undefined`", () => {
			type Source = { keep: string; weird: undefined };

			const check: ExtendsType<RequiredKeys<Source>, "keep"> = true;

			expect(check).toBe(true);
		});

		test("should not exclude a key whose value is `null` (null !== undefined)", () => {
			type Source = { a: string | null; b: number };

			const check: ExtendsType<RequiredKeys<Source>, "a" | "b"> = true;

			expect(check).toBe(true);
		});
	});

	describe("combined modifiers and unions", () => {
		test("should treat `?` and explicit `| undefined` identically for filtering", () => {
			type Source = {
				required: string;
				questionMark?: string;
				explicit: string | undefined;
			};

			const check: ExtendsType<RequiredKeys<Source>, "required"> = true;

			expect(check).toBe(true);
		});

		test("should keep a key whose value is `any` (any contains undefined)", () => {
			type Source = { keep: any; other: string };

			const check: ExtendsType<RequiredKeys<Source>, "other"> = true;

			expect(check).toBe(true);
		});
	});

	describe("edge cases", () => {
		test("should resolve to `never` when every key is optional", () => {
			type Source = { a?: string; b?: number };

			const check: ExtendsType<RequiredKeys<Source>, never> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `never` for an empty object", () => {
			type Source = NonNullable<unknown>;

			const check: ExtendsType<RequiredKeys<Source>, never> = true;

			expect(check).toBe(true);
		});

		test("should handle symbol-keyed required properties", () => {
			const sym = Symbol("key");
			type Sym = typeof sym;

			type Source = { [sym]: string; named: number };

			const check: ExtendsType<
				RequiredKeys<Source>,
				"named" | Sym
			> = true;

			expect(check).toBe(true);
		});
	});
});
