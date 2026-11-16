import { describe, expectTypeOf, it } from "bun:test";

import type { ExtractContent } from "@/utils/types/extract-content";

describe("ExtractContent", () => {
	it("should pass a value that is not a function through unchanged", () => {
		expectTypeOf<ExtractContent<{ a: true }>>().toEqualTypeOf<{
			a: true;
		}>();
		expectTypeOf<ExtractContent<Promise<string>>>().toEqualTypeOf<
			Promise<string>
		>();
	});

	it("should resolve to the return type of a factory, whatever its parameters", () => {
		expectTypeOf<ExtractContent<() => { a: true }>>().toEqualTypeOf<{
			a: true;
		}>();
		expectTypeOf<
			ExtractContent<(a: number, b: string) => boolean>
		>().toEqualTypeOf<boolean>();
	});

	it("should await the return type of an async factory", () => {
		expectTypeOf<
			ExtractContent<() => Promise<string> | string>
		>().toEqualTypeOf<string>();
	});

	it("should not unwrap a function returned by a factory", () => {
		expectTypeOf<ExtractContent<() => () => number>>().toEqualTypeOf<
			() => number
		>();
	});

	it("should distribute over a union of a value and a factory", () => {
		expectTypeOf<ExtractContent<(() => number) | string>>().toEqualTypeOf<
			number | string
		>();
	});
});
