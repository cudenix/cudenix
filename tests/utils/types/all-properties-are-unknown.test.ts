import { describe, expectTypeOf, it } from "bun:test";

import type { AllPropertiesAreUnknown } from "@/utils/types/all-properties-are-unknown";

describe("AllPropertiesAreUnknown", () => {
	it("should resolve to true when every property accepts `unknown`", () => {
		interface A {
			a: unknown;
			b?: unknown;
			readonly c: any;
		}

		expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
	});

	it("should resolve to true for an empty object and for `any`", () => {
		expectTypeOf<
			AllPropertiesAreUnknown<NonNullable<unknown>>
		>().toEqualTypeOf<true>();
		expectTypeOf<AllPropertiesAreUnknown<any>>().toEqualTypeOf<true>();
	});

	it("should resolve to false when one property is concrete", () => {
		expectTypeOf<
			AllPropertiesAreUnknown<{ a: unknown; b: string }>
		>().toEqualTypeOf<false>();
		expectTypeOf<
			AllPropertiesAreUnknown<{ a?: string }>
		>().toEqualTypeOf<false>();
	});

	it("should inspect the properties declared next to an unknown index signature", () => {
		interface A {
			[key: string]: unknown;
			a: string;
		}

		expectTypeOf<
			AllPropertiesAreUnknown<Record<string, unknown>>
		>().toEqualTypeOf<true>();
		expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
	});

	it("should resolve to true for a union whose members all pass", () => {
		expectTypeOf<
			AllPropertiesAreUnknown<{ a: unknown } | { b: unknown }>
		>().toEqualTypeOf<true>();
	});

	it("should resolve to false when a union member has a concrete key the others lack", () => {
		expectTypeOf<
			AllPropertiesAreUnknown<
				{ a: unknown; c: unknown } | { b: string; c: unknown }
			>
		>().toEqualTypeOf<false>();
	});
});
