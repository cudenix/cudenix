import { describe, expect, expectTypeOf, it } from "bun:test";

import { peek, peekStatus } from "@/utils/promises/peek";

describe("peek", () => {
	it("should be Bun's native function without a wrapper", () => {
		expect(Object.is(peek, Bun.peek)).toBe(true);
	});

	it("should return the value of a fulfilled promise typed as unknown", () => {
		const result = peek(Promise.resolve("v1"));

		expectTypeOf<typeof result>().toBeUnknown();
		expect(result).toBe("v1");
	});

	it("should return a value that is not a promise with its own type", () => {
		const value = { a: "v1" };

		const result = peek(value);

		expectTypeOf(result).toEqualTypeOf<typeof value>();
		expect(result).toBe(value);
	});
});

describe("peekStatus", () => {
	it("should be Bun's native function without a wrapper", () => {
		expect(Object.is(peekStatus, Bun.peek.status)).toBe(true);
	});

	it("should report the state of a promise", async () => {
		const rejected = Promise.reject(new Error("v1"));

		expect(peekStatus(Promise.resolve("v1"))).toBe("fulfilled");
		expect(peekStatus(rejected)).toBe("rejected");
		expect(peekStatus(Promise.withResolvers<string>().promise)).toBe(
			"pending",
		);

		await Promise.allSettled([rejected]);
	});
});
