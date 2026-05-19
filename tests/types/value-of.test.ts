import { describe, expect, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";
import type { ValueOf } from "@/types/value-of";

describe("ValueOf", () => {
	describe("plain dictionaries", () => {
		test("should resolve to a single type for a single-key dictionary", () => {
			interface Source {
				only: number;
			}

			const check: ExtendsType<ValueOf<Source>, number> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the union of value types for a multi-key dictionary", () => {
			interface Source {
				a: string;
				b: number;
				c: boolean;
			}

			const check: ExtendsType<
				ValueOf<Source>,
				string | number | boolean
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("`as const` enum objects", () => {
		test("should resolve to the union of string literal values", () => {
			const status = { done: "done", ready: "ready" } as const;

			type Status = ValueOf<typeof status>;

			const check: ExtendsType<Status, "ready" | "done"> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the union of numeric literal values", () => {
			const codes = { error: 500, notFound: 404, ok: 200 } as const;

			type Code = ValueOf<typeof codes>;

			const check: ExtendsType<Code, 200 | 404 | 500> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the union of boolean literal values", () => {
			const flags = { off: false, on: true } as const;

			type Flag = ValueOf<typeof flags>;

			const check: ExtendsType<Flag, true | false> = true;

			expect(check).toBe(true);
		});
	});

	describe("mixed value types", () => {
		test("should preserve literal types within the union", () => {
			interface Source {
				mode: "auto";
				retries: 3;
			}

			const check: ExtendsType<ValueOf<Source>, "auto" | 3> = true;

			expect(check).toBe(true);
		});

		test("should preserve heterogeneous value-type unions", () => {
			interface Source {
				count: number;
				name: string;
				tags: string[];
			}

			const check: ExtendsType<
				ValueOf<Source>,
				string | number | string[]
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("modifiers", () => {
		test("should ignore the `readonly` modifier when collecting value types", () => {
			interface Source {
				readonly a: string;
				readonly b: number;
			}

			const check: ExtendsType<ValueOf<Source>, string | number> = true;

			expect(check).toBe(true);
		});

		test("should include `undefined` for an optional (`?`) key", () => {
			interface Source {
				keep: string;
				maybe?: number;
			}

			const check: ExtendsType<
				ValueOf<Source>,
				string | number | undefined
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("special key kinds", () => {
		test("should preserve values keyed by numeric literals", () => {
			interface Source {
				1: "one";
				2: "two";
			}

			const check: ExtendsType<ValueOf<Source>, "one" | "two"> = true;

			expect(check).toBe(true);
		});

		test("should preserve values keyed by `symbol`", () => {
			const sym = Symbol("key");

			interface Source {
				named: string;
				[sym]: boolean;
			}

			const check: ExtendsType<ValueOf<Source>, boolean | string> = true;

			expect(check).toBe(true);
		});
	});

	describe("complex value types", () => {
		test("should preserve nested object value types", () => {
			interface Source {
				a: { x: number };
				b: { y: string };
			}

			const check: ExtendsType<
				ValueOf<Source>,
				{ x: number } | { y: string }
			> = true;

			expect(check).toBe(true);
		});

		test("should preserve function value types", () => {
			type Run = () => void;
			type Format = (input: string) => string;

			interface Source {
				format: Format;
				run: Run;
			}

			const check: ExtendsType<ValueOf<Source>, Run | Format> = true;

			expect(check).toBe(true);
		});

		test("should preserve `null` and `undefined` as explicit value types", () => {
			interface Source {
				a: null;
				b: undefined;
				c: string;
			}

			const check: ExtendsType<
				ValueOf<Source>,
				null | undefined | string
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("index signatures", () => {
		test("should resolve to the value type for `Record<string, V>`", () => {
			type Source = Record<string, number>;

			const check: ExtendsType<ValueOf<Source>, number> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the value type for `Record<number, V>`", () => {
			type Source = Record<number, boolean>;

			const check: ExtendsType<ValueOf<Source>, boolean> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the value type for `Record<symbol, V>`", () => {
			type Source = Record<symbol, "x">;

			const check: ExtendsType<ValueOf<Source>, "x"> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `unknown` for `Record<string, unknown>`", () => {
			type Source = Record<string, unknown>;

			const check: ExtendsType<ValueOf<Source>, unknown> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `any` for `Record<string, any>`", () => {
			type Source = Record<string, any>;

			const check: ExtendsType<ValueOf<Source>, any> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `never` for `Record<string, never>`", () => {
			type Source = Record<string, never>;

			const check: ExtendsType<ValueOf<Source>, never> = true;

			expect(check).toBe(true);
		});
	});

	describe("edge cases", () => {
		test("should resolve to `never` for an empty object", () => {
			type Source = NonNullable<unknown>;

			const check: ExtendsType<ValueOf<Source>, never> = true;

			expect(check).toBe(true);
		});

		test("should union value types across an intersection of objects", () => {
			type Source = { a: string } & { b: number };

			const check: ExtendsType<ValueOf<Source>, string | number> = true;

			expect(check).toBe(true);
		});
	});
});
