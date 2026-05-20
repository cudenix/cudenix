import { describe, expect, test } from "bun:test";

import type { ConditionallyOmit } from "@/types/conditionally-omit";
import type { ExtendsType } from "@/types/extends-type";

describe("ConditionallyOmit", () => {
	describe("with marker `never`", () => {
		test("should drop a single `never` key and keep the rest", () => {
			interface Source {
				count: number;
				flag: never;
				name: string;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, never>,
				{ name: string; count: number }
			> = true;

			expect(check).toBe(true);
		});

		test("should drop every `never` key when multiple are present", () => {
			interface Source {
				a: never;
				b: never;
				c: number;
				d: string;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, never>,
				{ c: number; d: string }
			> = true;

			expect(check).toBe(true);
		});

		test("should leave the object unchanged when no keys are `never`", () => {
			interface Source {
				a: string;
				b: number;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, never>,
				{ a: string; b: number }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("with marker `unknown`", () => {
		test("should drop a single `unknown` key", () => {
			interface Source {
				drop: unknown;
				keep: string;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, unknown>,
				{ keep: string }
			> = true;

			expect(check).toBe(true);
		});

		test("should drop every `unknown` key when multiple are present", () => {
			interface Source {
				a: unknown;
				b: unknown;
				c: number;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, unknown>,
				{ c: number }
			> = true;

			expect(check).toBe(true);
		});

		test("should leave the object unchanged when no keys are `unknown`", () => {
			interface Source {
				a: string;
				b: number;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, unknown>,
				{ a: string; b: number }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("with marker `null`", () => {
		test("should drop a `null`-valued key", () => {
			interface Source {
				drop: null;
				keep: string;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, null>,
				{ keep: string }
			> = true;

			expect(check).toBe(true);
		});

		test("should drop every `null`-valued key when multiple are present", () => {
			interface Source {
				a: null;
				b: null;
				c: number;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, null>,
				{ c: number }
			> = true;

			expect(check).toBe(true);
		});

		test("should leave the object unchanged when no keys are `null`", () => {
			interface Source {
				a: string;
				b: number;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, null>,
				{ a: string; b: number }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("with marker `undefined`", () => {
		test("should drop an `undefined`-valued key", () => {
			interface Source {
				drop: undefined;
				keep: string;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, undefined>,
				{ keep: string }
			> = true;

			expect(check).toBe(true);
		});

		test("should drop every `undefined`-valued key when multiple are present", () => {
			interface Source {
				a: undefined;
				b: undefined;
				c: number;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, undefined>,
				{ c: number }
			> = true;

			expect(check).toBe(true);
		});

		test("should leave the object unchanged when no keys are `undefined`", () => {
			interface Source {
				a: string;
				b: number;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, undefined>,
				{ a: string; b: number }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("`any` collapses mutual assignability", () => {
		test("should drop every key when the marker is `any`", () => {
			interface Source {
				a: string;
				b: number;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, any>,
				NonNullable<unknown>
			> = true;

			expect(check).toBe(true);
		});

		test("should drop an `any`-valued key even under a narrow marker", () => {
			interface Source {
				drop: any;
				keep: number;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, string>,
				{ keep: number }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("structural mutual-assignability match", () => {
		test("should only drop keys whose value is mutually assignable with the marker", () => {
			interface Source {
				broad: string;
				exact: "foo";
				narrow: "bar";
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, "foo">,
				{ broad: string; narrow: "bar" }
			> = true;

			expect(check).toBe(true);
		});

		test("should not drop a key whose value is a wider supertype of the marker", () => {
			interface Source {
				matching: "x";
				wider: string;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, "x">,
				{ wider: string }
			> = true;

			expect(check).toBe(true);
		});

		test("should not drop a key whose value is a strict subtype of the marker", () => {
			interface Source {
				exact: string;
				sub: "a";
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, string>,
				{ sub: "a" }
			> = true;

			expect(check).toBe(true);
		});

		test("should drop only the union-valued key whose union matches the marker exactly", () => {
			interface Source {
				full: "a" | "b";
				member: "a";
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, "a" | "b">,
				{ member: "a" }
			> = true;

			expect(check).toBe(true);
		});

		test("should drop a key whose object value is structurally identical to the object marker", () => {
			interface Source {
				match: { x: number };
				other: string;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, { x: number }>,
				{ other: string }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("preservation of retained keys and modifiers", () => {
		test("should keep all keys when the marker matches none of them", () => {
			interface Source {
				a: string;
				b: number;
				c: boolean;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, symbol>,
				{ a: string; b: number; c: boolean }
			> = true;

			expect(check).toBe(true);
		});

		test("should preserve the optional modifier on retained keys", () => {
			interface Source {
				drop: never;
				keep?: string;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, never>,
				{ keep?: string }
			> = true;

			expect(check).toBe(true);
		});

		test("should preserve the `readonly` modifier on retained keys", () => {
			interface Source {
				drop: never;
				readonly locked: string;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, never>,
				{ readonly locked: string }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("edge shapes", () => {
		test("should be a no-op on an empty object", () => {
			type Source = NonNullable<unknown>;

			const check: ExtendsType<
				ConditionallyOmit<Source, never>,
				NonNullable<unknown>
			> = true;

			expect(check).toBe(true);
		});

		test("should produce an empty object when every key matches the marker", () => {
			interface Source {
				a: never;
				b: never;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, never>,
				NonNullable<unknown>
			> = true;

			expect(check).toBe(true);
		});

		test("should leave an optional `never` key untouched because indexed access widens it to `undefined`", () => {
			interface Source {
				keep: string;
				maybe?: never;
			}

			const check: ExtendsType<
				ConditionallyOmit<Source, never>,
				{ keep: string; maybe?: never }
			> = true;

			expect(check).toBe(true);
		});
	});
});
