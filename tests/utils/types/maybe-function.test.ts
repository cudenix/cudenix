import { describe, expectTypeOf, it } from "bun:test";

import type { MaybeFunction } from "@/utils/types/maybe-function";

describe("MaybeFunction", () => {
	it("should resolve to the value or a zero-argument factory of it", () => {
		expectTypeOf<MaybeFunction<number>>().toEqualTypeOf<
			(() => number | Promise<number>) | number
		>();
	});

	it("should accept sync and async factories", () => {
		expectTypeOf<() => number>().toExtend<MaybeFunction<number>>();
		expectTypeOf<() => Promise<number>>().toExtend<MaybeFunction<number>>();
	});

	it("should reject a factory that requires arguments", () => {
		expectTypeOf<(a: string) => number>().not.toExtend<
			MaybeFunction<number>
		>();
	});
});
