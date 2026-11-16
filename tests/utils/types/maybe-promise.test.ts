import { describe, expectTypeOf, it } from "bun:test";

import type { MaybePromise } from "@/utils/types/maybe-promise";

describe("MaybePromise", () => {
	it("should resolve to the value or a promise of it", () => {
		expectTypeOf<MaybePromise<number>>().toEqualTypeOf<
			number | Promise<number>
		>();
	});

	it("should wrap a union as a whole instead of distributing over it", () => {
		expectTypeOf<MaybePromise<number | string>>().toEqualTypeOf<
			number | Promise<number | string> | string
		>();
	});
});
