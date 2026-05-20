import { describe, expectTypeOf, test } from "bun:test";

import type { ConditionallyOptional } from "@/types/conditionally-optional";

describe("ConditionallyOptional", () => {
	describe("`undefined` marker on a single key", () => {
		test("should mark a key whose value includes `undefined` as optional", () => {
			interface Source {
				id: string;
				nickname: string | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<Source, undefined>
			>().branded.toEqualTypeOf<{
				id: string;
				nickname?: string | undefined;
			}>();
		});

		test("should leave a key with no `undefined` in its value untouched", () => {
			interface Source {
				keep: string;
			}

			expectTypeOf<
				ConditionallyOptional<Source, undefined>
			>().branded.toEqualTypeOf<{ keep: string }>();
		});

		test("should retain the original union as the optional value type", () => {
			interface Source {
				x: number | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<Source, undefined>
			>().branded.toEqualTypeOf<{ x?: number | undefined }>();
		});
	});

	describe("`undefined` marker on multiple keys", () => {
		test("should mark only the keys whose value admits `undefined` as optional", () => {
			interface Source {
				a: string | undefined;
				b: number | undefined;
				c: boolean;
			}

			expectTypeOf<
				ConditionallyOptional<Source, undefined>
			>().branded.toEqualTypeOf<{
				a?: string | undefined;
				b?: number | undefined;
				c: boolean;
			}>();
		});

		test("should mark every key as optional when every value admits the marker", () => {
			interface Source {
				a: string | undefined;
				b: number | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<Source, undefined>
			>().branded.toEqualTypeOf<{
				a?: string | undefined;
				b?: number | undefined;
			}>();
		});

		test("should preserve a required key's exact literal type when another is relaxed", () => {
			interface Source {
				loose: undefined;
				required: "literal";
			}

			expectTypeOf<
				ConditionallyOptional<Source, undefined>
			>().branded.toEqualTypeOf<{
				required: "literal";
				loose?: undefined;
			}>();
		});
	});

	describe("non-`undefined` markers", () => {
		test("should mark `null`-bearing keys optional when the marker is `null`", () => {
			interface Source {
				a: string | null;
				b: number;
			}

			expectTypeOf<
				ConditionallyOptional<Source, null>
			>().branded.toEqualTypeOf<{ a?: string | null; b: number }>();
		});

		test("should mark a literal-bearing key optional when the marker matches the literal", () => {
			interface Source {
				flag: boolean;
				mode: "auto" | "manual";
			}

			expectTypeOf<
				ConditionallyOptional<Source, "auto">
			>().branded.toEqualTypeOf<{
				mode?: "auto" | "manual";
				flag: boolean;
			}>();
		});

		test("should distribute a union marker across each key's assignability check", () => {
			interface Source {
				nullable: string | null;
				strict: boolean;
				undefinable: number | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<Source, null | undefined>
			>().branded.toEqualTypeOf<{
				strict: boolean;
				nullable?: string | null;
				undefinable?: number | undefined;
			}>();
		});
	});

	describe("preservation of source key modifiers", () => {
		test("should keep an already-optional source key optional when its value admits the marker", () => {
			interface Source {
				existing?: string;
				required: number;
			}

			expectTypeOf<
				ConditionallyOptional<Source, undefined>
			>().branded.toEqualTypeOf<{
				required: number;
				existing?: string | undefined;
			}>();
		});

		test("should preserve the `readonly` modifier on a key promoted to optional", () => {
			interface Source {
				readonly locked: string | undefined;
				open: number | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<Source, undefined>
			>().branded.toEqualTypeOf<{
				readonly locked?: string | undefined;
				open?: number | undefined;
			}>();
		});
	});

	describe("edge cases", () => {
		test("should leave an empty object as-is", () => {
			type Source = NonNullable<unknown>;

			expectTypeOf<
				ConditionallyOptional<Source, undefined>
			>().branded.toEqualTypeOf<NonNullable<unknown>>();
		});

		test("should leave an object with no matching keys completely unchanged", () => {
			interface Source {
				a: string;
				b: number;
			}

			expectTypeOf<
				ConditionallyOptional<Source, undefined>
			>().branded.toEqualTypeOf<{ a: string; b: number }>();
		});

		test("should not relax a key whose value is a strict subtype of the marker", () => {
			interface Source {
				narrow: "foo";
				wide: string;
			}

			expectTypeOf<
				ConditionallyOptional<Source, string>
			>().branded.toEqualTypeOf<{ narrow: "foo"; wide?: string }>();
		});

		test("should relax a key whose value is `unknown` because any marker assigns to it", () => {
			interface Source {
				any: unknown;
				specific: number;
			}

			expectTypeOf<
				ConditionallyOptional<Source, undefined>
			>().branded.toEqualTypeOf<{
				specific: number;
				any?: unknown;
			}>();
		});

		test("should leave a `never`-valued key untouched when the marker is not `never`", () => {
			interface Source {
				impossible: never;
				present: string | undefined;
			}

			expectTypeOf<
				ConditionallyOptional<Source, undefined>
			>().branded.toEqualTypeOf<{
				impossible: never;
				present?: string | undefined;
			}>();
		});

		test("should leave the type unchanged when the marker is `never` because the check distributes over `never`", () => {
			interface Source {
				a: string;
				b: number;
				c: boolean;
			}

			expectTypeOf<
				ConditionallyOptional<Source, never>
			>().branded.toEqualTypeOf<{ a: string; b: number; c: boolean }>();
		});
	});
});
