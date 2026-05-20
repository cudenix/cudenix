import { describe, expectTypeOf, test } from "bun:test";

import type { ValueOf } from "@/types/value-of";

describe("ValueOf", () => {
	describe("plain dictionaries", () => {
		test("should resolve to a single type for a single-key dictionary", () => {
			interface Source {
				only: number;
			}

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<number>();
		});

		test("should resolve to the union of value types for a multi-key dictionary", () => {
			interface Source {
				a: string;
				b: number;
				c: boolean;
			}

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<
				string | number | boolean
			>();
		});
	});

	describe("`as const` enum objects", () => {
		test("should resolve to the union of string literal values", () => {
			const status = { done: "done", ready: "ready" } as const;

			type Status = ValueOf<typeof status>;

			expectTypeOf<Status>().toEqualTypeOf<"ready" | "done">();
		});

		test("should resolve to the union of numeric literal values", () => {
			const codes = { error: 500, notFound: 404, ok: 200 } as const;

			type Code = ValueOf<typeof codes>;

			expectTypeOf<Code>().toEqualTypeOf<200 | 404 | 500>();
		});

		test("should resolve to the union of boolean literal values", () => {
			const flags = { off: false, on: true } as const;

			type Flag = ValueOf<typeof flags>;

			expectTypeOf<Flag>().toEqualTypeOf<true | false>();
		});
	});

	describe("mixed value types", () => {
		test("should preserve literal types within the union", () => {
			interface Source {
				mode: "auto";
				retries: 3;
			}

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<"auto" | 3>();
		});

		test("should preserve heterogeneous value-type unions", () => {
			interface Source {
				count: number;
				name: string;
				tags: string[];
			}

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<
				string | number | string[]
			>();
		});
	});

	describe("modifiers", () => {
		test("should ignore the `readonly` modifier when collecting value types", () => {
			interface Source {
				readonly a: string;
				readonly b: number;
			}

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<string | number>();
		});

		test("should include `undefined` for an optional (`?`) key", () => {
			interface Source {
				keep: string;
				maybe?: number;
			}

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<
				string | number | undefined
			>();
		});
	});

	describe("special key kinds", () => {
		test("should preserve values keyed by numeric literals", () => {
			interface Source {
				1: "one";
				2: "two";
			}

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<"one" | "two">();
		});

		test("should preserve values keyed by `symbol`", () => {
			const sym = Symbol("key");

			interface Source {
				named: string;
				[sym]: boolean;
			}

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<boolean | string>();
		});
	});

	describe("complex value types", () => {
		test("should preserve nested object value types", () => {
			interface Source {
				a: { x: number };
				b: { y: string };
			}

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<
				{ x: number } | { y: string }
			>();
		});

		test("should preserve function value types", () => {
			type Run = () => void;
			type Format = (input: string) => string;

			interface Source {
				format: Format;
				run: Run;
			}

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<Run | Format>();
		});

		test("should preserve `null` and `undefined` as explicit value types", () => {
			interface Source {
				a: null;
				b: undefined;
				c: string;
			}

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<
				null | undefined | string
			>();
		});
	});

	describe("index signatures", () => {
		test("should resolve to the value type for `Record<string, V>`", () => {
			type Source = Record<string, number>;

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<number>();
		});

		test("should resolve to the value type for `Record<number, V>`", () => {
			type Source = Record<number, boolean>;

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<boolean>();
		});

		test("should resolve to the value type for `Record<symbol, V>`", () => {
			type Source = Record<symbol, "x">;

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<"x">();
		});

		test("should resolve to `unknown` for `Record<string, unknown>`", () => {
			type Source = Record<string, unknown>;

			expectTypeOf<ValueOf<Source>>().toBeUnknown();
		});

		test("should resolve to `any` for `Record<string, any>`", () => {
			type Source = Record<string, any>;

			expectTypeOf<ValueOf<Source>>().toBeAny();
		});

		test("should resolve to `never` for `Record<string, never>`", () => {
			type Source = Record<string, never>;

			expectTypeOf<ValueOf<Source>>().toBeNever();
		});
	});

	describe("tuple and array sources", () => {
		test("should include the element types of a tuple in the union", () => {
			type Source = [string, number];

			expectTypeOf<string>().toExtend<ValueOf<Source>>();
			expectTypeOf<number>().toExtend<ValueOf<Source>>();
		});

		test("should include the element type of a homogeneous array in the union", () => {
			type Source = string[];

			expectTypeOf<string>().toExtend<ValueOf<Source>>();
		});
	});

	describe("edge cases", () => {
		test("should resolve to `never` for an empty object", () => {
			type Source = NonNullable<unknown>;

			expectTypeOf<ValueOf<Source>>().toBeNever();
		});

		test("should union value types across an intersection of objects", () => {
			type Source = { a: string } & { b: number };

			expectTypeOf<ValueOf<Source>>().toEqualTypeOf<string | number>();
		});
	});
});
