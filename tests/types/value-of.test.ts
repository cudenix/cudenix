import { describe, expect, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";
import type { ValueOf } from "@/types/value-of";

describe("ValueOf", () => {
	describe("plain dictionaries", () => {
		test("should resolve to the union of value types", () => {
			type Source = { a: string; b: number; c: boolean };

			const check: ExtendsType<
				ValueOf<Source>,
				string | number | boolean
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to a single type for a single-key dictionary", () => {
			type Source = { only: number };

			const check: ExtendsType<ValueOf<Source>, number> = true;

			expect(check).toBe(true);
		});
	});

	describe("`as const` enum objects", () => {
		test("should resolve to the union of literal values", () => {
			const status = {
				done: "done",
				ready: "ready",
			} as const;

			type Status = ValueOf<typeof status>;

			const check: ExtendsType<Status, "ready" | "done"> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the union of numeric literal values", () => {
			const codes = {
				error: 500,
				notFound: 404,
				ok: 200,
			} as const;

			type Code = ValueOf<typeof codes>;

			const check: ExtendsType<Code, 200 | 404 | 500> = true;

			expect(check).toBe(true);
		});
	});

	describe("mixed value types", () => {
		test("should preserve heterogeneous value-type unions", () => {
			type Source = {
				name: string;
				count: number;
				tags: string[];
			};

			const check: ExtendsType<
				ValueOf<Source>,
				string | number | string[]
			> = true;

			expect(check).toBe(true);
		});

		test("should preserve literal types within the union", () => {
			type Source = { mode: "auto"; retries: 3 };

			const check: ExtendsType<ValueOf<Source>, "auto" | 3> = true;

			expect(check).toBe(true);
		});
	});

	describe("index signatures", () => {
		test("should resolve to the index value type for `Record<string, V>`", () => {
			type Source = Record<string, number>;

			const check: ExtendsType<ValueOf<Source>, number> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `unknown` for `Record<string, unknown>`", () => {
			type Source = Record<string, unknown>;

			const check: ExtendsType<ValueOf<Source>, unknown> = true;

			expect(check).toBe(true);
		});
	});
});
