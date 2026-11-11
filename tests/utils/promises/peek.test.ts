import { describe, expect, expectTypeOf, it } from "bun:test";

import { peek, peekStatus } from "@/utils/promises/peek";

const asPromise = async (value: unknown): Promise<unknown> =>
	value as Promise<unknown>;

const settled = async (): Promise<string> => "v1";

const suspends = async (): Promise<string> => {
	null;

	return "v1";
};

const rejects = async (): Promise<never> => {
	throw new Error("v1");
};

class Subclass<T> extends Promise<T> {}

describe("peek", () => {
	it("should retain Bun's native function without a wrapper", () => {
		expect(Object.is(peek, Bun.peek)).toBe(true);
	});

	describe("fulfilled promises", () => {
		it("should return the value of a resolved promise", async () => {
			const promise = Promise.resolve("v1");

			expect(peek(promise)).toBe("v1");

			return promise;
		});

		it("should return the value of an async function that never suspends", async () => {
			const promise = settled();

			expect(peek(promise)).toBe("v1");

			return promise;
		});

		it("should return the same value when peeked again", async () => {
			const promise = Promise.resolve("v1");

			expect(peek(promise)).toBe("v1");
			expect(peek(promise)).toBe("v1");

			return promise;
		});

		it("should return undefined for a promise fulfilled with undefined", async () => {
			const promise = Promise.resolve(undefined);

			expect(peek(promise)).toBeUndefined();

			return promise;
		});

		it("should return the value of a promise subclass", async () => {
			const promise = Subclass.resolve("v1");

			expect(peek(promise)).toBe("v1");

			return promise;
		});
	});

	describe("pending promises", () => {
		it("should return the promise itself", async () => {
			const promise = suspends();

			const result = peek(promise);

			expectTypeOf<typeof result>().toBeUnknown();
			expect(result).toBe(promise);

			return promise;
		});

		it("should return the value once the promise fulfills", async () => {
			const { promise, resolve } = Promise.withResolvers<string>();

			expect(peek(promise)).toBe(promise);

			resolve("v1");

			expect(peek(promise)).toBe("v1");

			return promise;
		});

		it("should return a promise resolved with a promise until it adopts the value", async () => {
			const promise = new Promise<string>((resolve) => {
				resolve(Promise.resolve("v1"));
			});

			expect(peek(promise)).toBe(promise);

			await promise;

			expect(peek(promise)).toBe("v1");
		});
	});

	describe("rejected promises", () => {
		it("should allow a rejection reason unrelated to the fulfilled value type", async () => {
			const promise = Promise.reject<string>(1);

			await promise.catch(() => {});

			const result = peek(promise);

			expectTypeOf<typeof result>().toBeUnknown();
			expect(result).toBe(1);
		});

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

		it("should return null unchanged", () => {
			expect(peek(null)).toBeNull();
		});

		it("should return a primitive unchanged", () => {
			expect(peek(1)).toBe(1);
		});

		it("should return a proxy of a promise unchanged", async () => {
			const target = Promise.resolve("v1");
			const proxy = new Proxy(target, {});

			expect(peek(proxy)).toBe(proxy);

			return target;
		});

		it("should return the same reference for an object", () => {
			const value = { a: "v1" };

			expect(peek(value)).toBe(value);
			expectTypeOf(peek(value)).toEqualTypeOf<typeof value>();
		});

		it("should return a thenable without running its then", () => {
			let ran = false;
			const thenable = {
				then(resolve: (value: string) => void): void {
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
	it("should retain Bun's native function without a wrapper", () => {
		expect(Object.is(peekStatus, Bun.peek.status)).toBe(true);
	});

	describe("promises", () => {
		it("should return 'fulfilled' for a resolved promise", async () => {
			const promise = Promise.resolve("v1");

			expect(peekStatus(promise)).toBe("fulfilled");

			return promise;
		});

		it("should return 'fulfilled' for an async function that never suspends", async () => {
			const promise = settled();

			expect(peekStatus(promise)).toBe("fulfilled");

			return promise;
		});

		it("should return 'pending' for an async function that suspends", async () => {
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

		it("should return 'fulfilled' for a promise subclass", async () => {
			const promise = Subclass.resolve("v1");

			expect(peekStatus(promise)).toBe("fulfilled");

			return promise;
		});

		it("should move from 'pending' to 'fulfilled' when the promise resolves", async () => {
			const { promise, resolve } = Promise.withResolvers<string>();

			expect(peekStatus(promise)).toBe("pending");

			resolve("v1");

			expect(peekStatus(promise)).toBe("fulfilled");

			return promise;
		});

		it("should return 'pending' for a promise resolved with a promise until it adopts the value", async () => {
			const promise = new Promise<string>((resolve) => {
				resolve(Promise.resolve("v1"));
			});

			expect(peekStatus(promise)).toBe("pending");

			await promise;

			expect(peekStatus(promise)).toBe("fulfilled");
		});
	});

	describe("values that are not promises", () => {
		it("should return 'fulfilled' for undefined", () => {
			expect(peekStatus(undefined)).toBe("fulfilled");
		});

		it("should return 'fulfilled' for null", () => {
			expect(peekStatus(null)).toBe("fulfilled");
		});

		it("should return 'fulfilled' for a primitive", () => {
			expect(peekStatus(1)).toBe("fulfilled");
		});

		it("should return 'fulfilled' for a proxy of a pending promise", () => {
			expect(
				peekStatus(new Proxy(new Promise<string>(() => {}), {})),
			).toBe("fulfilled");
		});

		it("should return 'fulfilled' for an object", () => {
			expect(peekStatus({ a: "v1" })).toBe("fulfilled");
		});

		it("should return 'fulfilled' for a thenable", () => {
			expect(peekStatus(asPromise({ then: (): void => {} }))).toBe(
				"fulfilled",
			);
		});
	});
});
