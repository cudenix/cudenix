import { describe, expectTypeOf, it } from "bun:test";

import type { OptionalKeys } from "@/utils/types/optional-keys";

describe("OptionalKeys", () => {
	it("should collect keys declared with the optional modifier", () => {
		interface A {
			a: string;
			b?: number;
			c?: boolean;
		}

		expectTypeOf<OptionalKeys<A>>().toEqualTypeOf<"b" | "c">();
	});

	it("should not treat a required property containing undefined as optional", () => {
		interface A {
			a: string | undefined;
			b?: string;
		}

		expectTypeOf<OptionalKeys<A>>().toEqualTypeOf<"b">();
	});

	it("should preserve optional keys regardless of their value type", () => {
		interface A {
			a?: undefined;
			b?: never;
			c?: unknown;
		}

		expectTypeOf<OptionalKeys<A>>().toEqualTypeOf<"a" | "b" | "c">();
	});

	it("should recognize readonly optional properties", () => {
		interface A {
			readonly a?: string;
			readonly b: number;
		}

		expectTypeOf<OptionalKeys<A>>().toEqualTypeOf<"a">();
	});

	it("should recognize optional method properties", () => {
		interface A {
			a?(): void;
			b(): void;
		}

		expectTypeOf<OptionalKeys<A>>().toEqualTypeOf<"a">();
	});

	it("should preserve numeric and symbol key types", () => {
		const symbol = Symbol("optional");
		type SymbolKey = typeof symbol;

		interface A {
			0?: string;
			1: number;
			[symbol]?: boolean;
		}

		expectTypeOf<OptionalKeys<A>>().toEqualTypeOf<0 | SymbolKey>();
	});

	it("should exclude required index signatures", () => {
		expectTypeOf<OptionalKeys<Record<string, string>>>().toBeNever();
		expectTypeOf<OptionalKeys<Record<number, string>>>().toBeNever();
		expectTypeOf<OptionalKeys<Record<symbol, string>>>().toBeNever();
	});

	it("should distinguish an optional tuple element", () => {
		type A = [string, number?];

		expectTypeOf<Extract<OptionalKeys<A>, "1">>().toEqualTypeOf<"1">();
		expectTypeOf<Extract<OptionalKeys<A>, "0">>().toBeNever();
	});

	it("should resolve to never when every property is required", () => {
		expectTypeOf<OptionalKeys<{ a: string; b: number }>>().toBeNever();
	});

	it("should resolve to never for an empty object", () => {
		expectTypeOf<OptionalKeys<NonNullable<unknown>>>().toBeNever();
	});

	it("should reject primitive and nullish inputs", () => {
		// @ts-expect-error - string does not satisfy `T extends object`
		type _A = OptionalKeys<string>;
		// @ts-expect-error - undefined does not satisfy `T extends object`
		type _B = OptionalKeys<undefined>;
	});
});
