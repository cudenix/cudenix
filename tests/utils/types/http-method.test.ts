import { describe, expectTypeOf, it } from "bun:test";

import type { HttpMethod } from "@/utils/types/http-method";

type Named =
	| "CONNECT"
	| "DELETE"
	| "GET"
	| "HEAD"
	| "OPTIONS"
	| "PATCH"
	| "POST"
	| "PUT"
	| "QUERY"
	| "TRACE";

describe("HttpMethod", () => {
	it("should keep every named method as a literal member", () => {
		expectTypeOf<Extract<HttpMethod, Named>>().toEqualTypeOf<Named>();
	});

	it("should accept any other string", () => {
		expectTypeOf<string>().toExtend<HttpMethod>();
	});

	it("should reject values that are not strings", () => {
		expectTypeOf<number>().not.toExtend<HttpMethod>();
	});
});
