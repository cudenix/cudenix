import { describe, expect, test } from "bun:test";

import type { AssignableTo } from "@/types/assignable-to";
import type { ExtendsType } from "@/types/extends-type";
import type { MaybePromise } from "@/types/maybe-promise";

describe("MaybePromise", () => {
	describe("direct-value branch", () => {
		test("should accept a concrete value of the wrapped type", () => {
			const value: MaybePromise<number> = 1;

			expect(value).toBe(1);
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
			const value: MaybePromise<number> = Promise.resolve(1);

			expect(await value).toBe(1);
		});

		test("should accept `Promise<string>` when wrapping `string`", async () => {
			const value: MaybePromise<string> = Promise.resolve("hello");

			expect(await value).toBe("hello");
		});
	});

	describe("structural relations", () => {
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

		test("should collapse to the wrapped type under `Awaited<...>`", () => {
			const check: ExtendsType<
				Awaited<MaybePromise<number>>,
				number
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("wrapping a union of value types", () => {
		test("should accept either member of the wrapped union (sync)", () => {
			const asString: MaybePromise<string | number> = "hello";
			const asNumber: MaybePromise<string | number> = 1;

			expect(asString).toBe("hello");
			expect(asNumber).toBe(1);
		});

		test("should accept a `Promise<Member>` via promise covariance", async () => {
			const value: MaybePromise<string | number> = Promise.resolve(1);

			expect(await value).toBe(1);
		});

		test("should resolve to `(A | B) | Promise<A | B>` without distributing", () => {
			const check: ExtendsType<
				MaybePromise<string | number>,
				(string | number) | Promise<string | number>
			> = true;

			expect(check).toBe(true);
		});

		test("should not decompose into `A | Promise<A> | B | Promise<B>`", () => {
			const check: ExtendsType<
				MaybePromise<string | number>,
				string | Promise<string> | number | Promise<number>
			> = false;

			expect(check).toBe(false);
		});
	});

	describe("nullable wrapped types", () => {
		test("should accept a `null` value when wrapping a nullable type", () => {
			const value: MaybePromise<string | null> = null;

			expect(value).toBeNull();
		});

		test("should accept an `undefined` value when wrapping `T | undefined`", () => {
			const value: MaybePromise<string | undefined> = undefined;

			expect(value).toBeUndefined();
		});
	});

	describe("`void` specialization", () => {
		test("should accept `undefined` as the synchronous arm", () => {
			const value: MaybePromise<void> = undefined;

			expect(value).toBeUndefined();
		});

		test("should accept `Promise<void>` as the asynchronous arm", async () => {
			const value: MaybePromise<void> = Promise.resolve();

			expect(await value).toBeUndefined();
		});

		test("should resolve to `void | Promise<void>`", () => {
			const check: ExtendsType<
				MaybePromise<void>,
				void | Promise<void>
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("rejected assignments", () => {
		test("should reject a bare value of an unrelated type", () => {
			const check: AssignableTo<string, MaybePromise<number>> = false;

			expect(check).toBe(false);
		});

		test("should reject a `Promise<U>` where `U` does not extend the wrapped type", () => {
			const check: AssignableTo<
				Promise<string>,
				MaybePromise<number>
			> = false;

			expect(check).toBe(false);
		});

		test("should reject a `PromiseLike<T>` in place of a real `Promise<T>`", () => {
			const check: AssignableTo<
				PromiseLike<number>,
				MaybePromise<number>
			> = false;

			expect(check).toBe(false);
		});
	});
});
