import { describe, expect, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";
import type { RequiredKeys } from "@/types/required-keys";

describe("RequiredKeys", () => {
	describe("plain required keys", () => {
		test("should resolve to the union of all keys when every property is required", () => {
			interface Source {
				a: string;
				b: number;
				c: boolean;
			}

			const check: ExtendsType<
				RequiredKeys<Source>,
				"a" | "b" | "c"
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to a single key for a single-property object", () => {
			interface Source {
				only: string;
			}

			const check: ExtendsType<RequiredKeys<Source>, "only"> = true;

			expect(check).toBe(true);
		});
	});

	describe("optional modifier exclusion", () => {
		test("should exclude a key declared with the `?` optional modifier", () => {
			interface Source {
				keep: string;
				maybe?: string;
			}

			const check: ExtendsType<RequiredKeys<Source>, "keep"> = true;

			expect(check).toBe(true);
		});

		test("should exclude every `?`-marked key when multiple are optional", () => {
			interface Source {
				a: string;
				b?: number;
				c?: boolean;
				d: string;
			}

			const check: ExtendsType<RequiredKeys<Source>, "a" | "d"> = true;

			expect(check).toBe(true);
		});
	});

	describe("undefined-bearing value exclusion", () => {
		test("should exclude a key whose value union contains `undefined`", () => {
			interface Source {
				age: number | undefined;
				name: string;
			}

			const check: ExtendsType<RequiredKeys<Source>, "name"> = true;

			expect(check).toBe(true);
		});

		test("should exclude a key whose value is exactly `undefined`", () => {
			interface Source {
				keep: string;
				weird: undefined;
			}

			const check: ExtendsType<RequiredKeys<Source>, "keep"> = true;

			expect(check).toBe(true);
		});

		test("should not exclude a key whose value is `null` (null !== undefined)", () => {
			interface Source {
				a: string | null;
				b: number;
			}

			const check: ExtendsType<RequiredKeys<Source>, "a" | "b"> = true;

			expect(check).toBe(true);
		});

		test("should exclude a key whose value union mixes `null` and `undefined`", () => {
			interface Source {
				a: string | null | undefined;
				b: number;
			}

			const check: ExtendsType<RequiredKeys<Source>, "b"> = true;

			expect(check).toBe(true);
		});

		test("should keep a key whose value is `never` (undefined does not extend never)", () => {
			interface Source {
				keep: never;
				other: string;
			}

			const check: ExtendsType<
				RequiredKeys<Source>,
				"keep" | "other"
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("combined modifiers and unions", () => {
		test("should treat `?` and explicit `| undefined` identically for filtering", () => {
			interface Source {
				explicit: string | undefined;
				questionMark?: string;
				required: string;
			}

			const check: ExtendsType<RequiredKeys<Source>, "required"> = true;

			expect(check).toBe(true);
		});

		test("should exclude a key whose value is `any` (any contains undefined)", () => {
			interface Source {
				keep: any;
				other: string;
			}

			const check: ExtendsType<RequiredKeys<Source>, "other"> = true;

			expect(check).toBe(true);
		});

		test("should exclude a key whose value is `unknown` (unknown contains undefined)", () => {
			interface Source {
				keep: unknown;
				other: string;
			}

			const check: ExtendsType<RequiredKeys<Source>, "other"> = true;

			expect(check).toBe(true);
		});

		test("should exclude a key whose value is `void` (void contains undefined)", () => {
			interface Source {
				keep: void;
				other: string;
			}

			const check: ExtendsType<RequiredKeys<Source>, "other"> = true;

			expect(check).toBe(true);
		});

		test("should exclude an optional key declared with redundant `| undefined`", () => {
			interface Source {
				a?: string | undefined;
				b: string;
			}

			const check: ExtendsType<RequiredKeys<Source>, "b"> = true;

			expect(check).toBe(true);
		});
	});

	describe("readonly modifier", () => {
		test("should keep a `readonly` required key", () => {
			interface Source {
				readonly a: string;
				b?: string;
			}

			const check: ExtendsType<RequiredKeys<Source>, "a"> = true;

			expect(check).toBe(true);
		});

		test("should exclude a `readonly` optional key", () => {
			interface Source {
				readonly a?: string;
				b: string;
			}

			const check: ExtendsType<RequiredKeys<Source>, "b"> = true;

			expect(check).toBe(true);
		});
	});

	describe("edge cases", () => {
		test("should resolve to `never` when every key is optional", () => {
			interface Source {
				a?: string;
				b?: number;
			}

			const check: ExtendsType<RequiredKeys<Source>, never> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `never` for an empty object", () => {
			type Source = NonNullable<unknown>;

			const check: ExtendsType<RequiredKeys<Source>, never> = true;

			expect(check).toBe(true);
		});

		test("should handle symbol-keyed required properties", () => {
			const sym = Symbol("key");
			type Sym = typeof sym;

			interface Source {
				named: number;
				[sym]: string;
			}

			const check: ExtendsType<
				RequiredKeys<Source>,
				"named" | Sym
			> = true;

			expect(check).toBe(true);
		});

		test("should handle numeric literal keys", () => {
			interface Source {
				0: string;
				1?: number;
			}

			const check: ExtendsType<RequiredKeys<Source>, 0> = true;

			expect(check).toBe(true);
		});

		test("should keep a required method-syntax property", () => {
			interface Source {
				method(): void;
				opt?(): void;
			}

			const check: ExtendsType<RequiredKeys<Source>, "method"> = true;

			expect(check).toBe(true);
		});

		test("should reduce a string index signature to its key type", () => {
			interface Source {
				[key: string]: string;
			}

			const check: ExtendsType<RequiredKeys<Source>, string> = true;

			expect(check).toBe(true);
		});

		test("should reduce a number index signature to its key type", () => {
			interface Source {
				[key: number]: string;
			}

			const check: ExtendsType<RequiredKeys<Source>, number> = true;

			expect(check).toBe(true);
		});
	});
});
