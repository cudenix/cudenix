import { describe, expect, it } from "bun:test";

import { peek, peekStatus } from "@/utils/promises/peek";

const asPromise = (value: unknown) => value as Promise<unknown>;

const settled = async () => "v1";

const suspends = async () => {
	await null;

	return "v1";
};

const rejects = async () => {
	throw new Error("v1");
};

describe("peek", () => {
	describe("fulfilled promises", () => {
		it("should return the value of a resolved promise", () => {
			const promise = Promise.resolve("v1");

			expect(peek(promise)).toBe("v1");

			return promise;
		});

		it("should return the value of an async function that never suspends", () => {
			const promise = settled();

			expect(peek(promise)).toBe("v1");

			return promise;
		});

		it("should return the same value when peeked again", () => {
			const promise = Promise.resolve("v1");

			expect(peek(promise)).toBe("v1");
			expect(peek(promise)).toBe("v1");

			return promise;
		});
	});

	describe("pending promises", () => {
		it("should return the promise itself", () => {
			const promise = suspends();

			expect(peek(promise)).toBe(promise as never);

			return promise;
		});
	});

	describe("rejected promises", () => {
		it("should return the reason instead of throwing it", async () => {
			const promise = rejects();

			await promise.catch(() => {});

			expect(peek(promise)).toBeInstanceOf(Error);
		});
	});

	describe("values that are not promises", () => {
		it("should return undefined unchanged", () => {
			expect(peek(undefined)).toBeUndefined();
		});

		it("should return a primitive unchanged", () => {
			expect(peek(1)).toBe(1);
		});

		it("should return the same reference for an object", () => {
			const value = { a: "v1" };

			expect(peek(value)).toBe(value);
		});

		it("should return a thenable without running its then", () => {
			let ran = false;
			const thenable = {
				// biome-ignore lint/suspicious/noThenProperty: Testing thenables
				then(resolve: (value: string) => void) {
					ran = true;

					resolve("v1");
				},
			};

			expect(peek(asPromise(thenable))).toBe(thenable);
			expect(ran).toBe(false);
		});
	});
});

describe("peekStatus", () => {
	describe("promises", () => {
		it("should return 'fulfilled' for a resolved promise", () => {
			const promise = Promise.resolve("v1");

			expect(peekStatus(promise)).toBe("fulfilled");

			return promise;
		});

		it("should return 'fulfilled' for an async function that never suspends", () => {
			const promise = settled();

			expect(peekStatus(promise)).toBe("fulfilled");

			return promise;
		});

		it("should return 'pending' for an async function that suspends", () => {
			const promise = suspends();

			expect(peekStatus(promise)).toBe("pending");

			return promise;
		});

		it("should return 'pending' for a promise that never settles", () => {
			expect(peekStatus(new Promise(() => {}))).toBe("pending");
		});

		it("should return 'rejected' for a rejected promise", async () => {
			const promise = rejects();

			await promise.catch(() => {});

			expect(peekStatus(promise)).toBe("rejected");
		});
	});

	describe("values that are not promises", () => {
		it("should return 'fulfilled' for undefined", () => {
			expect(peekStatus(undefined)).toBe("fulfilled");
		});

		it("should return 'fulfilled' for a primitive", () => {
			expect(peekStatus(1)).toBe("fulfilled");
		});

		it("should return 'fulfilled' for an object", () => {
			expect(peekStatus({ a: "v1" })).toBe("fulfilled");
		});

		it("should return 'fulfilled' for a thenable", () => {
			// biome-ignore lint/suspicious/noThenProperty: Testing thenables
			const thenable = { then: () => {} };

			expect(peekStatus(asPromise(thenable))).toBe("fulfilled");
		});
	});
});
