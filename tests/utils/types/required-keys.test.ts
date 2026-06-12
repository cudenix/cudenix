import { describe, expectTypeOf, it } from "bun:test";

import type { RequiredKeys } from "@/utils/types/required-keys";

describe("RequiredKeys", () => {
	describe("plain required properties", () => {
		it("should resolve to the only key for a single-property object", () => {
			interface A {
				a: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"a">();
		});

		it("should resolve to the union of every key when all are required", () => {
			interface A {
				a: string;
				b: number;
				c: boolean;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"a" | "b" | "c">();
		});
	});

	describe("? optional modifier exclusion", () => {
		it("should exclude a single key declared with the `?` modifier", () => {
			interface A {
				a: string;
				b?: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"a">();
		});

		it("should exclude every `?`-marked key when several are optional", () => {
			interface A {
				a: string;
				b?: number;
				c?: boolean;
				d: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"a" | "d">();
		});
	});

	describe("undefined in the value type", () => {
		it("should exclude a key whose value is exactly `undefined`", () => {
			interface A {
				a: string;
				b: undefined;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"a">();
		});

		it("should exclude a key whose value union contains `undefined`", () => {
			interface A {
				a: number | undefined;
				b: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"b">();
		});

		it("should keep a key whose value is `null` (null is not undefined)", () => {
			interface A {
				a: string | null;
				b: number;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"a" | "b">();
		});

		it("should exclude a key whose value union mixes `null` and `undefined`", () => {
			interface A {
				a: string | null | undefined;
				b: number;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"b">();
		});

		it("should keep a key whose value is `never` (undefined does not extend never)", () => {
			interface A {
				a: never;
				b: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"a" | "b">();
		});
	});

	describe("top types that contain undefined", () => {
		it("should exclude a key whose value is `any`", () => {
			interface A {
				a: any;
				b: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"b">();
		});

		it("should exclude a key whose value is `unknown`", () => {
			interface A {
				a: unknown;
				b: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"b">();
		});

		it("should exclude a key whose value is `void`", () => {
			interface A {
				// biome-ignore lint/suspicious/noConfusingVoidType: This is intentional to test that `void` is treated as a top type that includes `undefined`.
				a: void;
				b: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"b">();
		});
	});

	describe("combined ? and | undefined modifiers", () => {
		it("should treat `?` and explicit `| undefined` identically for filtering", () => {
			interface A {
				a: string | undefined;
				b?: string;
				c: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"c">();
		});

		it("should exclude an optional key declared with redundant `| undefined`", () => {
			interface A {
				a?: string | undefined;
				b: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"b">();
		});

		it("should keep only the plainly-required key when one uses `?` and another uses `| undefined`", () => {
			interface A {
				a: string;
				b?: string;
				c: number | undefined;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"a">();
		});
	});

	describe("readonly modifier", () => {
		it("should keep a `readonly` required key", () => {
			interface A {
				readonly a: string;
				b?: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"a">();
		});

		it("should exclude a `readonly` optional key", () => {
			interface A {
				readonly a?: string;
				b: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"b">();
		});
	});

	describe("special key kinds", () => {
		it("should keep a required method-syntax property and drop its optional counterpart", () => {
			interface A {
				a(): void;
				b?(): void;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"a">();
		});

		it("should keep required numeric literal keys and exclude optional ones", () => {
			interface A {
				0: string;
				1?: number;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<0>();
		});

		it("should keep a required symbol-keyed property alongside string keys", () => {
			const sym = Symbol("key");
			type Sym = typeof sym;

			interface A {
				a: number;
				[sym]: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"a" | Sym>();
		});

		it("should exclude an optional `symbol`-keyed property", () => {
			const sym = Symbol("key");

			interface A {
				a: number;
				[sym]?: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"a">();
		});
	});

	describe("index signatures", () => {
		it("should reduce a string index signature to its key type", () => {
			interface A {
				[key: string]: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<string>();
		});

		it("should reduce a number index signature to its key type", () => {
			interface A {
				[key: number]: string;
			}

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<number>();
		});
	});

	describe("tuple sources", () => {
		it("should distinguish a fully-required tuple from one with a trailing optional element", () => {
			type A = [string, number];
			type B = [string, number?];

			expectTypeOf<RequiredKeys<A>>().not.toEqualTypeOf<
				RequiredKeys<B>
			>();
		});

		it("should keep a required tuple index and drop an optional one", () => {
			type A = [string, number];
			type B = [string, number?];

			expectTypeOf<Extract<RequiredKeys<A>, "1">>().toEqualTypeOf<"1">();
			expectTypeOf<Extract<RequiredKeys<B>, "1">>().toBeNever();
		});
	});

	describe("degenerate inputs", () => {
		it("should resolve to `never` when every key is optional", () => {
			interface A {
				a?: string;
				b?: number;
			}

			expectTypeOf<RequiredKeys<A>>().toBeNever();
		});

		it("should resolve to `never` for an empty object", () => {
			type A = NonNullable<unknown>;

			expectTypeOf<RequiredKeys<A>>().toBeNever();
		});

		it("should intersect required keys across a union input rather than distribute", () => {
			interface A {
				a: string;
				b?: number;
			}
			interface B {
				a: string;
				c: boolean;
			}

			expectTypeOf<RequiredKeys<A | B>>().toEqualTypeOf<"a">();
		});
	});
});
