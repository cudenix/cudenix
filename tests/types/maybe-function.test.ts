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

	describe("structural relations", () => {
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

		test("should not collapse the union to its value type", () => {
			const check: ExtendsType<MaybeFunction<number>, number> = false;

			expect(check).toBe(false);
		});
	});
});
