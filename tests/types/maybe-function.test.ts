import { describe, expect, test } from "bun:test";

import type { AssignableTo } from "@/types/assignable-to";
import type { ExtendsType } from "@/types/extends-type";
import type { MaybeFunction } from "@/types/maybe-function";

describe("MaybeFunction", () => {
	describe("direct-value branch", () => {
		test("should accept a concrete value of the wrapped type", () => {
			const value: MaybeFunction<number> = 42;

			expect(value).toBe(42);
		});

		test("should accept a string value when wrapping `string`", () => {
			const value: MaybeFunction<string> = "hello";

			expect(value).toBe("hello");
		});

		test("should accept a structured value when wrapping an object type", () => {
			interface User {
				id: string;
			}

			const value: MaybeFunction<User> = { id: "1" };

			expect(value).toEqual({ id: "1" });
		});
	});

	describe("sync-factory branch", () => {
		test("should accept a zero-arg sync factory returning the wrapped type", () => {
			const value: MaybeFunction<number> = () => 42;

			expect(typeof value).toBe("function");
			expect((value as () => number)()).toBe(42);
		});

		test("should accept an arrow function returning a literal", () => {
			const value: MaybeFunction<"ready"> = () => "ready" as const;

			expect((value as () => "ready")()).toBe("ready");
		});
	});

	describe("async-factory branch", () => {
		test("should accept a zero-arg async factory resolving to the wrapped type", async () => {
			const value: MaybeFunction<number> = async () => 42;

			expect(typeof value).toBe("function");
			expect(await (value as () => Promise<number>)()).toBe(42);
		});

		test("should accept a factory that returns a promise explicitly", async () => {
			const value: MaybeFunction<string> = () => Promise.resolve("ok");

			expect(await (value as () => Promise<string>)()).toBe("ok");
		});
	});

	describe("mixed-return factory branch", () => {
		test("should accept a factory whose body may resolve sync or async per invocation", async () => {
			let next: "sync" | "async" = "sync";

			const value: MaybeFunction<number> = () => {
				const current = next;

				next = current === "sync" ? "async" : "sync";

				return current === "sync" ? 42 : Promise.resolve(42);
			};

			const fn = value as () => number | Promise<number>;

			expect(await fn()).toBe(42);
			expect(await fn()).toBe(42);
		});

		test("should expose `T | Promise<T>` as the factory's return type", () => {
			type FactoryReturn = ReturnType<
				Extract<MaybeFunction<number>, (...args: never[]) => unknown>
			>;

			const check: ExtendsType<
				FactoryReturn,
				number | Promise<number>
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("structural relations", () => {
		test("should resolve to `T | (() => T | Promise<T>)` exactly", () => {
			const check: ExtendsType<
				MaybeFunction<number>,
				number | (() => number | Promise<number>)
			> = true;

			expect(check).toBe(true);
		});

		test("should treat a bare value as assignable to MaybeFunction<T>", () => {
			const check: AssignableTo<number, MaybeFunction<number>> = true;

			expect(check).toBe(true);
		});

		test("should treat a sync factory as assignable to MaybeFunction<T>", () => {
			const check: AssignableTo<
				() => number,
				MaybeFunction<number>
			> = true;

			expect(check).toBe(true);
		});

		test("should treat an async factory as assignable to MaybeFunction<T>", () => {
			const check: AssignableTo<
				() => Promise<number>,
				MaybeFunction<number>
			> = true;

			expect(check).toBe(true);
		});

		test("should treat a mixed sync-or-async factory as assignable to MaybeFunction<T>", () => {
			const check: AssignableTo<
				() => number | Promise<number>,
				MaybeFunction<number>
			> = true;

			expect(check).toBe(true);
		});

		test("should not collapse the union to its value type", () => {
			const check: ExtendsType<MaybeFunction<number>, number> = false;

			expect(check).toBe(false);
		});
	});

	describe("rejection cases", () => {
		test("should reject a bare value of an unrelated type", () => {
			const check: AssignableTo<string, MaybeFunction<number>> = false;

			expect(check).toBe(false);
		});

		test("should reject a factory returning the wrong value type", () => {
			const check: AssignableTo<
				() => string,
				MaybeFunction<number>
			> = false;

			expect(check).toBe(false);
		});

		test("should reject a factory whose promise resolves to the wrong type", () => {
			const check: AssignableTo<
				() => Promise<string>,
				MaybeFunction<number>
			> = false;

			expect(check).toBe(false);
		});

		test("should reject a factory that requires arguments", () => {
			const check: AssignableTo<
				(arg: string) => number,
				MaybeFunction<number>
			> = false;

			expect(check).toBe(false);
		});

		test("should reject a non-function, non-value shape entirely", () => {
			const check: AssignableTo<
				{ value: number },
				MaybeFunction<number>
			> = false;

			expect(check).toBe(false);
		});
	});

	describe("interaction with invocation", () => {
		test("should yield `T | Promise<T>` once the factory branch is invoked", async () => {
			const value: MaybeFunction<number> = () => 7;

			if (typeof value !== "function") {
				throw new Error("expected factory branch");
			}

			const result = value();

			const check: ExtendsType<
				typeof result,
				number | Promise<number>
			> = true;

			expect(check).toBe(true);
			expect(await result).toBe(7);
		});

		test("should yield `T` directly when the slot holds a bare value", () => {
			const provide = (slot: MaybeFunction<number>): MaybeFunction<number> =>
				slot;
			const value = provide(7);

			const result = typeof value === "function" ? value() : value;

			expect(result).toBe(7);
		});

		test("should round-trip every branch through a generic unwrap helper", async () => {
			const unwrap = async <T>(slot: MaybeFunction<T>): Promise<T> =>
				typeof slot === "function"
					? await (slot as () => T | Promise<T>)()
					: slot;

			expect(await unwrap<number>(7)).toBe(7);
			expect(await unwrap<number>(() => 7)).toBe(7);
			expect(await unwrap<number>(async () => 7)).toBe(7);
			expect(
				await unwrap<number>(() => Promise.resolve(7)),
			).toBe(7);
		});
	});

	describe("generic-parameter edge cases", () => {
		test("should accept a `void`-returning factory for fire-and-forget hooks", () => {
			const value: MaybeFunction<void> = () => {};

			expect(typeof value).toBe("function");
		});

		test("should accept an explicit `undefined`-yielding factory", () => {
			const value: MaybeFunction<undefined> = () => undefined;

			expect((value as () => undefined)()).toBeUndefined();
		});

		test("should accept both `true` and `false` when wrapping `boolean`", () => {
			const truthy: MaybeFunction<boolean> = true;
			const falsy: MaybeFunction<boolean> = false;

			expect(truthy).toBe(true);
			expect(falsy).toBe(false);
		});

		test("should accept a union as the wrapped type without distorting either arm", () => {
			const asValue: MaybeFunction<number | string> = "x";
			const asFactory: MaybeFunction<number | string> = () => 1;

			expect(asValue).toBe("x");
			expect((asFactory as () => number | string)()).toBe(1);
		});
	});
});
