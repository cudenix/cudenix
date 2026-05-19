import { describe, expect, test } from "bun:test";

import type { ConditionallyOmit } from "@/types/conditionally-omit";
import type { ExtendsType } from "@/types/extends-type";

describe("ConditionallyOmit", () => {
	describe("omitting `never`-valued keys", () => {
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

	describe("omitting `unknown`-valued keys", () => {
		test("should drop a single `unknown` key when omitting `unknown`", () => {
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
	});

	describe("structural (mutual-assignability) match", () => {
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
	});

	describe("preservation of unrelated keys", () => {
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

		test("should preserve optional modifier on retained keys", () => {
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
	});
});
