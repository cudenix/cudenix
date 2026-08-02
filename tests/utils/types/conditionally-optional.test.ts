import { describe, expectTypeOf, it } from "bun:test";

import type { ConditionallyOptional } from "@/utils/types/conditionally-optional";

describe("ConditionallyOptional", () => {
	describe("`undefined` marker on a single key", () => {
		it("should mark a key whose value includes `undefined` as optional", () => {
			interface A {
				a: string;
				b: string | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{ a: string; b?: string | undefined }>();
		});

		it("should leave a key with no `undefined` in its value untouched", () => {
			interface A {
				a: string;
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{ a: string }>();
		});

		it("should retain the original union as the optional value type", () => {
			interface A {
				a: number | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{ a?: number | undefined }>();
		});
	});

	describe("`undefined` marker on multiple keys", () => {
		it("should mark only the keys whose value admits `undefined` as optional", () => {
			interface A {
				a: string | undefined;
				b: number | undefined;
				c: boolean;
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{
				a?: string | undefined;
				b?: number | undefined;
				c: boolean;
			}>();
		});

		it("should mark every key as optional when every value admits the marker", () => {
			interface A {
				a: string | undefined;
				b: number | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{
				a?: string | undefined;
				b?: number | undefined;
			}>();
		});

		it("should preserve a required key's exact literal type when another is relaxed", () => {
			interface A {
				a: undefined;
				b: "v1";
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{ b: "v1"; a?: undefined }>();
		});
	});

	describe("non-`undefined` markers", () => {
		it("should mark `null`-bearing keys optional when the marker is `null`", () => {
			interface A {
				a: string | null;
				b: number;
			}

			expectTypeOf<
				ConditionallyOptional<A, null>
			>().branded.toEqualTypeOf<{ a?: string | null; b: number }>();
		});

		it("should mark a literal-bearing key optional when the marker matches the literal", () => {
			interface A {
				a: boolean;
				b: "v1" | "v2";
			}

			expectTypeOf<
				ConditionallyOptional<A, "v1">
			>().branded.toEqualTypeOf<{ b?: "v1" | "v2"; a: boolean }>();
		});

		it("should distribute a union marker across each key's assignability check", () => {
			interface A {
				a: string | null;
				b: boolean;
				c: number | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<A, null | undefined>
			>().branded.toEqualTypeOf<{
				b: boolean;
				a?: string | null;
				c?: number | undefined;
			}>();
		});

		it("should mark only `unknown`- and `any`-valued keys optional when the marker is `unknown`", () => {
			interface A {
				a: unknown;
				b: string;
				c: any;
			}

			expectTypeOf<
				ConditionallyOptional<A, unknown>
			>().branded.toEqualTypeOf<{ b: string; a?: unknown; c?: any }>();
		});
	});

	describe("preservation of source key modifiers", () => {
		it("should keep an already-optional source key optional when its value admits the marker", () => {
			interface A {
				a?: string;
				b: number;
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{ b: number; a?: string | undefined }>();
		});

		it("should preserve the `readonly` modifier on a key promoted to optional", () => {
			interface A {
				readonly a: string | undefined;
				b: number | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{
				readonly a?: string | undefined;
				b?: number | undefined;
			}>();
		});
	});

	describe("index signatures", () => {
		it("should leave a record untouched when its value type does not admit the marker", () => {
			type A = Record<string, number>;

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<A>();
		});

		it("should relax an index signature whose value type admits the marker", () => {
			type A = Record<string, number | undefined>;

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<Partial<A>>();
		});
	});

	describe("special key kinds", () => {
		it("should mark a `symbol`-keyed property optional when its value admits the marker", () => {
			const sym = Symbol("a");

			interface A {
				a: number;
				[sym]: string | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{
				a: number;
				[sym]?: string | undefined;
			}>();
		});
	});

	describe("edge cases", () => {
		it("should leave an empty object as-is", () => {
			type A = NonNullable<unknown>;

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<NonNullable<unknown>>();
		});

		it("should leave an object with no matching keys completely unchanged", () => {
			interface A {
				a: string;
				b: number;
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{ a: string; b: number }>();
		});

		it("should not recurse into nested object values", () => {
			interface A {
				a: { b: string | undefined };
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{ a: { b: string | undefined } }>();
		});

		it("should relax the outer key when the nested object itself may be undefined", () => {
			interface A {
				a: { b: string } | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{ a?: { b: string } | undefined }>();
		});

		it("should not relax a key whose value is a strict subtype of the marker", () => {
			interface A {
				a: "v1";
				b: string;
			}

			expectTypeOf<
				ConditionallyOptional<A, string>
			>().branded.toEqualTypeOf<{ a: "v1"; b?: string }>();
		});

		it("should relax a key whose value is `unknown` because any marker assigns to it", () => {
			interface A {
				a: unknown;
				b: number;
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{ b: number; a?: unknown }>();
		});

		it("should leave a `never`-valued key untouched when the marker is not `never`", () => {
			interface A {
				a: never;
				b: string | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{ a: never; b?: string | undefined }>();
		});

		it("should leave the type unchanged when the marker is `never` because the check distributes over `never`", () => {
			interface A {
				a: string;
				b: number;
				c: boolean;
			}

			expectTypeOf<
				ConditionallyOptional<A, never>
			>().branded.toEqualTypeOf<{ a: string; b: number; c: boolean }>();
		});

		it("should relax a key whose value is `any` because `undefined` assigns to it", () => {
			interface A {
				a: any;
				b: number;
			}

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<{ b: number; a?: any }>();
		});

		it("should mark every key optional when the marker is `any`", () => {
			interface A {
				a: string;
				b: number;
			}

			expectTypeOf<
				ConditionallyOptional<A, any>
			>().branded.toEqualTypeOf<{ a?: string; b?: number }>();
		});
	});

	describe("union object inputs", () => {
		it("should keep every member's keys instead of only the common ones", () => {
			type A =
				| { a: string; b: number | undefined }
				| { a: string | undefined; c: boolean };

			expectTypeOf<
				ConditionallyOptional<A, undefined>
			>().branded.toEqualTypeOf<
				| ({ a: string } & { b?: number | undefined })
				| ({ c: boolean } & { a?: string | undefined })
			>();
		});

		it("should relax each member on its own keys", () => {
			type A = { a: string; b: string | undefined } | { c: boolean };

			expectTypeOf<
				keyof ConditionallyOptional<A, undefined>
			>().toEqualTypeOf<never>();

			expectTypeOf<
				ConditionallyOptional<
					{ a: string; b: string | undefined },
					undefined
				>
			>().branded.toEqualTypeOf<
				{ a: string } & { b?: string | undefined }
			>();
		});
	});

	describe("array and tuple inputs", () => {
		it("should preserve a mutable tuple because tuple positions cannot be omitted like object properties", () => {
			expectTypeOf<
				ConditionallyOptional<[string, number | undefined], undefined>
			>().branded.toEqualTypeOf<[string, number | undefined]>();
		});

		it("should preserve a mutable array because array elements are not optional object properties", () => {
			expectTypeOf<
				ConditionallyOptional<(number | undefined)[], undefined>
			>().branded.toEqualTypeOf<(number | undefined)[]>();
		});

		it("should preserve readonly tuples and arrays", () => {
			expectTypeOf<
				ConditionallyOptional<
					readonly [string, number | undefined],
					undefined
				>
			>().branded.toEqualTypeOf<readonly [string, number | undefined]>();
			expectTypeOf<
				ConditionallyOptional<
					readonly (number | undefined)[],
					undefined
				>
			>().branded.toEqualTypeOf<readonly (number | undefined)[]>();
		});
	});
});
