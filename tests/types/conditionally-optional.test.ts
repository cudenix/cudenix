import { describe, expect, test } from "bun:test";

import type { ConditionallyOptional } from "@/types/conditionally-optional";
import type { ExtendsType } from "@/types/extends-type";

describe("ConditionallyOptional", () => {
	describe("`undefined` marker on a single key", () => {
		test("should mark a key whose value includes `undefined` as optional", () => {
			interface Source {
				id: string;
				nickname: string | undefined;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ id: string; nickname?: string | undefined }
			> = true;

			expect(check).toBe(true);
		});

		test("should leave a key with no `undefined` in its value untouched", () => {
			interface Source {
				keep: string;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ keep: string }
			> = true;

			expect(check).toBe(true);
		});

		test("should retain the original union as the optional value type", () => {
			interface Source {
				x: number | undefined;
			}

			type Result = ConditionallyOptional<Source, undefined>;

			const check: ExtendsType<Result, { x?: number | undefined }> = true;

			expect(check).toBe(true);
		});
	});

	describe("`undefined` marker on multiple keys", () => {
		test("should mark only the keys whose value admits `undefined` as optional", () => {
			interface Source {
				a: string | undefined;
				b: number | undefined;
				c: boolean;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ a?: string | undefined; b?: number | undefined; c: boolean }
			> = true;

			expect(check).toBe(true);
		});

		test("should mark every key as optional when every value admits the marker", () => {
			interface Source {
				a: string | undefined;
				b: number | undefined;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ a?: string | undefined; b?: number | undefined }
			> = true;

			expect(check).toBe(true);
		});

		test("should preserve a required key's exact literal type when another is relaxed", () => {
			interface Source {
				loose: undefined;
				required: "literal";
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ required: "literal"; loose?: undefined }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("non-`undefined` markers", () => {
		test("should mark `null`-bearing keys optional when the marker is `null`", () => {
			interface Source {
				a: string | null;
				b: number;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, null>,
				{ a?: string | null; b: number }
			> = true;

			expect(check).toBe(true);
		});

		test("should mark a literal-bearing key optional when the marker matches the literal", () => {
			interface Source {
				flag: boolean;
				mode: "auto" | "manual";
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, "auto">,
				{ mode?: "auto" | "manual"; flag: boolean }
			> = true;

			expect(check).toBe(true);
		});

		test("should distribute a union marker across each key's assignability check", () => {
			interface Source {
				nullable: string | null;
				strict: boolean;
				undefinable: number | undefined;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, null | undefined>,
				{
					strict: boolean;
					nullable?: string | null;
					undefinable?: number | undefined;
				}
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("preservation of source key modifiers", () => {
		test("should keep an already-optional source key optional when its value admits the marker", () => {
			interface Source {
				existing?: string;
				required: number;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ required: number; existing?: string | undefined }
			> = true;

			expect(check).toBe(true);
		});

		test("should preserve the `readonly` modifier on a key promoted to optional", () => {
			interface Source {
				readonly locked: string | undefined;
				open: number | undefined;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{
					readonly locked?: string | undefined;
					open?: number | undefined;
				}
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("edge cases", () => {
		test("should leave an empty object as-is", () => {
			type Source = NonNullable<unknown>;

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				NonNullable<unknown>
			> = true;

			expect(check).toBe(true);
		});

		test("should leave an object with no matching keys completely unchanged", () => {
			interface Source {
				a: string;
				b: number;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ a: string; b: number }
			> = true;

			expect(check).toBe(true);
		});

		test("should not relax a key whose value is a strict subtype of the marker", () => {
			interface Source {
				narrow: "foo";
				wide: string;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, string>,
				{ narrow: "foo"; wide?: string }
			> = true;

			expect(check).toBe(true);
		});

		test("should relax a key whose value is `unknown` because any marker assigns to it", () => {
			interface Source {
				any: unknown;
				specific: number;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ specific: number; any?: unknown }
			> = true;

			expect(check).toBe(true);
		});

		test("should leave a `never`-valued key untouched when the marker is not `never`", () => {
			interface Source {
				impossible: never;
				present: string | undefined;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, undefined>,
				{ impossible: never; present?: string | undefined }
			> = true;

			expect(check).toBe(true);
		});

		test("should leave the type unchanged when the marker is `never` because the check distributes over `never`", () => {
			interface Source {
				a: string;
				b: number;
				c: boolean;
			}

			const check: ExtendsType<
				ConditionallyOptional<Source, never>,
				{ a: string; b: number; c: boolean }
			> = true;

			expect(check).toBe(true);
		});
	});
});
