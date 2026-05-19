import { describe, expect, test } from "bun:test";

import type { ConditionallyOptional } from "@/types/conditionally-optional";
import type { ExtendsType } from "@/types/extends-type";

describe("ConditionallyOptional", () => {
	describe("making `undefined`-assignable keys optional", () => {
		test("should mark a key whose value includes `undefined` as optional", () => {
			interface Source {
				id: string;
				nickname: string | undefined;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ id: string; nickname?: string | undefined }
			> = true;

			expect(check).toBe(true);
		});

		test("should mark every key that admits `undefined` as optional", () => {
			interface Source {
				a: string | undefined;
				b: number | undefined;
				c: boolean;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ a?: string | undefined; b?: number | undefined; c: boolean }
			> = true;

			expect(check).toBe(true);
		});

		test("should leave a key with no `undefined` in its value untouched", () => {
			interface Source {
				keep: string;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ keep: string }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("preservation of value types", () => {
		test("should retain the original union when relaxing a key to optional", () => {
			interface Source {
				x: number | undefined;
			}

			type Result = ConditionallyOptional<Source, undefined>;

			const check: ExtendsType<Result, { x?: number | undefined }> = true;

			expect(check).toBe(true);
		});

		test("should preserve a required key's exact value type", () => {
			interface Source {
				loose: undefined;
				required: "literal";
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ required: "literal"; loose?: undefined }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("non-undefined markers", () => {
		test("should make `null`-bearing keys optional when the marker is `null`", () => {
			interface Source {
				a: string | null;
				b: number;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, null>,
				{ a?: string | null; b: number }
			> = true;

			expect(check).toBe(true);
		});

		test("should make a literal-bearing key optional when the marker matches the literal", () => {
			interface Source {
				flag: boolean;
				mode: "auto" | "manual";
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, "auto">,
				{ mode?: "auto" | "manual"; flag: boolean }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("edge cases", () => {
		test("should leave an object with no matching keys completely unchanged", () => {
			interface Source {
				a: string;
				b: number;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ a: string; b: number }
			> = true;

			expect(check).toBe(true);
		});

		test("should leave an empty object as-is", () => {
			type Source = NonNullable<unknown>;

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				NonNullable<unknown>
			> = true;

			expect(check).toBe(true);
		});

		test("should make every key optional when every value admits the marker", () => {
			interface Source {
				a: string | undefined;
				b: number | undefined;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ a?: string | undefined; b?: number | undefined }
			> = true;

			expect(check).toBe(true);
		});
	});
});
