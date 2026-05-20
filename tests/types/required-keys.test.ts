import { describe, expectTypeOf, test } from "bun:test";

import type { RequiredKeys } from "@/types/required-keys";

describe("RequiredKeys", () => {
	describe("plain required properties", () => {
		test("should resolve to the only key for a single-property object", () => {
			interface Source {
				only: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"only">();
		});

		test("should resolve to the union of every key when all are required", () => {
			interface Source {
				a: string;
				b: number;
				c: boolean;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<
				"a" | "b" | "c"
			>();
		});
	});

	describe("? optional modifier exclusion", () => {
		test("should exclude a single key declared with the `?` modifier", () => {
			interface Source {
				keep: string;
				maybe?: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"keep">();
		});

		test("should exclude every `?`-marked key when several are optional", () => {
			interface Source {
				a: string;
				b?: number;
				c?: boolean;
				d: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"a" | "d">();
		});
	});

	describe("undefined in the value type", () => {
		test("should exclude a key whose value is exactly `undefined`", () => {
			interface Source {
				keep: string;
				weird: undefined;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"keep">();
		});

		test("should exclude a key whose value union contains `undefined`", () => {
			interface Source {
				age: number | undefined;
				name: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"name">();
		});

		test("should keep a key whose value is `null` (null is not undefined)", () => {
			interface Source {
				a: string | null;
				b: number;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"a" | "b">();
		});

		test("should exclude a key whose value union mixes `null` and `undefined`", () => {
			interface Source {
				a: string | null | undefined;
				b: number;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"b">();
		});

		test("should keep a key whose value is `never` (undefined does not extend never)", () => {
			interface Source {
				keep: never;
				other: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<
				"keep" | "other"
			>();
		});
	});

	describe("top types that contain undefined", () => {
		test("should exclude a key whose value is `any`", () => {
			interface Source {
				keep: any;
				other: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"other">();
		});

		test("should exclude a key whose value is `unknown`", () => {
			interface Source {
				keep: unknown;
				other: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"other">();
		});

		test("should exclude a key whose value is `void`", () => {
			interface Source {
				// biome-ignore lint/suspicious/noConfusingVoidType: This is intentional to test that `void` is treated as a top type that includes `undefined`.
				keep: void;
				other: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"other">();
		});
	});

	describe("combined ? and | undefined modifiers", () => {
		test("should treat `?` and explicit `| undefined` identically for filtering", () => {
			interface Source {
				explicit: string | undefined;
				questionMark?: string;
				required: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"required">();
		});

		test("should exclude an optional key declared with redundant `| undefined`", () => {
			interface Source {
				a?: string | undefined;
				b: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"b">();
		});
	});

	describe("readonly modifier", () => {
		test("should keep a `readonly` required key", () => {
			interface Source {
				readonly a: string;
				b?: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"a">();
		});

		test("should exclude a `readonly` optional key", () => {
			interface Source {
				readonly a?: string;
				b: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"b">();
		});
	});

	describe("special key kinds", () => {
		test("should keep a required method-syntax property and drop its optional counterpart", () => {
			interface Source {
				method(): void;
				opt?(): void;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"method">();
		});

		test("should keep required numeric literal keys and exclude optional ones", () => {
			interface Source {
				0: string;
				1?: number;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<0>();
		});

		test("should keep a required symbol-keyed property alongside string keys", () => {
			const sym = Symbol("key");
			type Sym = typeof sym;

			interface Source {
				named: number;
				[sym]: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<"named" | Sym>();
		});
	});

	describe("index signatures", () => {
		test("should reduce a string index signature to its key type", () => {
			interface Source {
				[key: string]: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<string>();
		});

		test("should reduce a number index signature to its key type", () => {
			interface Source {
				[key: number]: string;
			}

			expectTypeOf<RequiredKeys<Source>>().toEqualTypeOf<number>();
		});
	});

	describe("tuple sources", () => {
		test("should distinguish a fully-required tuple from one with a trailing optional element", () => {
			type Fixed = [string, number];
			type Optional = [string, number?];

			expectTypeOf<RequiredKeys<Fixed>>().not.toEqualTypeOf<
				RequiredKeys<Optional>
			>();
		});
	});

	describe("degenerate inputs", () => {
		test("should resolve to `never` when every key is optional", () => {
			interface Source {
				a?: string;
				b?: number;
			}

			expectTypeOf<RequiredKeys<Source>>().toBeNever();
		});

		test("should resolve to `never` for an empty object", () => {
			type Source = NonNullable<unknown>;

			expectTypeOf<RequiredKeys<Source>>().toBeNever();
		});
	});
});
