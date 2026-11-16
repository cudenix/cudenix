import { describe, expectTypeOf, it } from "bun:test";

import type { ValueOf } from "@/utils/types/value-of";

describe("ValueOf", () => {
	it("should resolve to the union of the property values", () => {
		expectTypeOf<ValueOf<{ a: "v1"; b: true }>>().toEqualTypeOf<
			"v1" | true
		>();
	});

	it("should collect the values of every member of a union with disjoint keys", () => {
		expectTypeOf<ValueOf<{ a: string } | { b: number }>>().toEqualTypeOf<
			number | string
		>();
	});

	it("should reject non-object inputs", () => {
		// @ts-expect-error - string does not satisfy `T extends object`
		type _A = ValueOf<string>;
	});
});
