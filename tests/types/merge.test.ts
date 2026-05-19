import { describe, expect, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";
import type { Merge } from "@/types/merge";

describe("Merge", () => {
	describe("override semantics", () => {
		test("should let the second operand override a key declared in the first", () => {
			interface A {
				tags: string[];
			}
			interface B {
				tags: readonly string[];
			}

			const check: ExtendsType<
				Merge<A, B>,
				{ tags: readonly string[] }
			> = true;

			expect(check).toBe(true);
		});

		test("should let the second operand replace the value type entirely", () => {
			interface A {
				id: string;
			}
			interface B {
				id: number;
			}

			const check: ExtendsType<Merge<A, B>, { id: number }> = true;

			expect(check).toBe(true);
		});

		test("should let the second operand narrow a wide value type", () => {
			interface A {
				mode: string;
			}
			interface B {
				mode: "auto" | "manual";
			}

			const check: ExtendsType<
				Merge<A, B>,
				{ mode: "auto" | "manual" }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("union of keys", () => {
		test("should preserve keys present only in the first operand", () => {
			interface A {
				keep: number;
			}
			interface B {
				other: string;
			}

			const check: ExtendsType<
				Merge<A, B>,
				{ keep: number; other: string }
			> = true;

			expect(check).toBe(true);
		});

		test("should include keys present only in the second operand", () => {
			interface A {
				id: string;
			}
			interface B {
				total: number;
			}

			const check: ExtendsType<
				Merge<A, B>,
				{ id: string; total: number }
			> = true;

			expect(check).toBe(true);
		});

		test("should mix overridden, first-only and second-only keys correctly", () => {
			interface A {
				first: 1;
				id: string;
				tags: string[];
			}
			interface B {
				tags: readonly string[];
				total: number;
			}

			const check: ExtendsType<
				Merge<A, B>,
				{
					id: string;
					tags: readonly string[];
					first: 1;
					total: number;
				}
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("modifiers and identity", () => {
		test("should respect the second operand's optional modifier on a shared key", () => {
			interface A {
				x: string;
			}
			interface B {
				x?: string;
			}

			const check: ExtendsType<Merge<A, B>, { x?: string }> = true;

			expect(check).toBe(true);
		});

		test("should be a no-op when the second operand is empty", () => {
			interface A {
				a: 1;
				b: 2;
			}
			type B = NonNullable<unknown>;

			const check: ExtendsType<Merge<A, B>, { a: 1; b: 2 }> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the second operand when the first is empty", () => {
			type A = NonNullable<unknown>;
			interface B {
				a: 1;
				b: 2;
			}

			const check: ExtendsType<Merge<A, B>, { a: 1; b: 2 }> = true;

			expect(check).toBe(true);
		});

		test("should resolve to an empty object when both operands are empty", () => {
			type A = NonNullable<unknown>;
			type B = NonNullable<unknown>;

			const check: ExtendsType<Merge<A, B>, NonNullable<unknown>> = true;

			expect(check).toBe(true);
		});
	});

	describe("readonly handling", () => {
		test("should let the second operand introduce `readonly` on a shared key", () => {
			interface A {
				id: string;
			}
			interface B {
				readonly id: string;
			}

			const check: ExtendsType<
				Merge<A, B>,
				{ readonly id: string }
			> = true;

			expect(check).toBe(true);
		});
	});
});
