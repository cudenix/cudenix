import { describe, expect, test } from "bun:test";

import type { AssignableTo } from "@/types/assignable-to";
import type { ExtendsType } from "@/types/extends-type";
import type { MaybePromise } from "@/types/maybe-promise";

describe("MaybePromise", () => {
	describe("sync branch", () => {
		test("should accept a concrete value of the wrapped type", () => {
			const value: MaybePromise<number> = 42;

			expect(value).toBe(42);
		});

		test("should accept a `null` value when wrapping a nullable type", () => {
			const value: MaybePromise<string | null> = null;

			expect(value).toBeNull();
		});

		test("should accept a structured value when wrapping an object type", () => {
			interface User {
				id: string;
			}

			const value: MaybePromise<User> = { id: "1" };

			expect(value).toEqual({ id: "1" });
		});
	});

	describe("promise branch", () => {
		test("should accept a resolved promise of the wrapped type", async () => {
			const value: MaybePromise<number> = Promise.resolve(42);

			expect(await value).toBe(42);
		});

		test("should accept `Promise<string>` when wrapping `string`", async () => {
			const value: MaybePromise<string> = Promise.resolve("hello");

			expect(await value).toBe("hello");
		});
	});

	describe("union semantics", () => {
		test("should resolve to `T | Promise<T>` (a union, not a nested promise)", () => {
			const check: ExtendsType<
				MaybePromise<number>,
				number | Promise<number>
			> = true;

			expect(check).toBe(true);
		});

		test("should treat a bare value as assignable", () => {
			const check: AssignableTo<number, MaybePromise<number>> = true;

			expect(check).toBe(true);
		});

		test("should treat a promise as assignable", () => {
			const check: AssignableTo<
				Promise<number>,
				MaybePromise<number>
			> = true;

			expect(check).toBe(true);
		});

		test("should not collapse the union to its value type", () => {
			const check: ExtendsType<MaybePromise<number>, number> = false;

			expect(check).toBe(false);
		});
	});

	describe("interaction with `await`", () => {
		test("should produce the wrapped type once awaited (sync arm)", async () => {
			const provide = (): MaybePromise<number> => 7;

			const result = await provide();

			const check: ExtendsType<typeof result, number> = true;

			expect(check).toBe(true);
			expect(result).toBe(7);
		});

		test("should produce the wrapped type once awaited (async arm)", async () => {
			const provide = (): MaybePromise<number> => Promise.resolve(7);

			const result = await provide();

			const check: ExtendsType<typeof result, number> = true;

			expect(check).toBe(true);
			expect(result).toBe(7);
		});
	});
});
