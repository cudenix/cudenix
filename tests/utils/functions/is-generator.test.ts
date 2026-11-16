import { describe, expect, it } from "bun:test";

import { isGenerator } from "@/utils/functions/is-generator";

type Fn = Parameters<typeof isGenerator>[0];

class A {
	*a(this: void): Generator<number, void, unknown> {
		yield 1;
	}

	async *b(this: void): AsyncGenerator<number, void, unknown> {
		yield await Promise.resolve(1);
	}
}

async function* asyncGenerator(): AsyncGenerator<number, void, unknown> {
	yield await Promise.resolve(1);
}

function* generator(): Generator<number, void, unknown> {
	yield 1;
}

describe("isGenerator", () => {
	it.each<[string, Fn]>([
		["a generator function", generator],
		["an async generator function", asyncGenerator],
		["a generator method", new A().a],
		["an async generator method", new A().b],
		["a bound generator function", generator.bind(undefined)],
	])("should return true for %s", (_, fn) => {
		expect(isGenerator(fn)).toBe(true);
	});

	it.each<[string, unknown]>([
		[
			"a function",
			function (): number {
				return 1;
			},
		],
		["an arrow function", (): number => 1],
		[
			"an async function",
			async (): Promise<void> => {
				await Promise.resolve();
			},
		],
		["a class", A],
	])("should return false for %s", (_, fn) => {
		expect(isGenerator(fn as Fn)).toBe(false);
	});
});
