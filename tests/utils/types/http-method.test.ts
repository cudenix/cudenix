import { describe, expectTypeOf, it } from "bun:test";

import type { HttpMethod } from "@/utils/types/http-method";

describe("HttpMethod", () => {
	describe("custom verbs via the string brand", () => {
		it("should accept an arbitrary uppercase verb", () => {
			expectTypeOf<"PURGE">().toExtend<HttpMethod>();
		});

		it("should accept the WebDAV `REPORT` verb", () => {
			expectTypeOf<"REPORT">().toExtend<HttpMethod>();
		});

		it("should accept a long single-word uppercase verb", () => {
			expectTypeOf<"MKCALENDAR">().toExtend<HttpMethod>();
		});

		it("should accept a verb containing digits", () => {
			expectTypeOf<"HTTP2">().toExtend<HttpMethod>();
		});

		it("should accept a verb containing a hyphen", () => {
			expectTypeOf<"X-CUSTOM">().toExtend<HttpMethod>();
		});

		it("should accept a verb containing an underscore", () => {
			expectTypeOf<"X_CUSTOM">().toExtend<HttpMethod>();
		});

		it("should accept the empty string", () => {
			expectTypeOf<"">().toExtend<HttpMethod>();
		});
	});

	describe("case insensitivity", () => {
		it("should accept a fully lowercase verb", () => {
			expectTypeOf<"get">().toExtend<HttpMethod>();
		});

		it("should accept a capitalised verb", () => {
			expectTypeOf<"Get">().toExtend<HttpMethod>();
		});

		it("should accept a mixed-case verb", () => {
			expectTypeOf<"gEt">().toExtend<HttpMethod>();
		});

		it("should accept a lowercase custom verb", () => {
			expectTypeOf<"purge">().toExtend<HttpMethod>();
		});
	});

	describe("subtype relations", () => {
		it("should include all canonical named methods as assignable values", () => {
			type A =
				| "DELETE"
				| "GET"
				| "HEAD"
				| "OPTIONS"
				| "PATCH"
				| "POST"
				| "PUT";

			expectTypeOf<A>().toExtend<HttpMethod>();
		});

		it("should accept plain `string` (the underlying brand)", () => {
			expectTypeOf<string>().toExtend<HttpMethod>();
		});
	});

	describe("supertype relations", () => {
		it("should itself be assignable to `string` (every member is a string)", () => {
			expectTypeOf<HttpMethod>().toExtend<string>();
		});

		it("should not be constrained to `Uppercase<string>` (case is unrestricted)", () => {
			expectTypeOf<HttpMethod>().not.toExtend<Uppercase<string>>();
		});
	});

	describe("brand preservation", () => {
		it("should not be exactly equal to `string` (the brand preserves literals)", () => {
			expectTypeOf<HttpMethod>().not.toEqualTypeOf<string>();
		});

		it("should keep the named literals extractable from the union", () => {
			expectTypeOf<Extract<HttpMethod, "GET">>().toEqualTypeOf<"GET">();
		});
	});

	describe("rejected assignments", () => {
		it("should reject `number` as a subtype", () => {
			expectTypeOf<1>().not.toExtend<HttpMethod>();
		});

		it("should reject `boolean` as a subtype", () => {
			expectTypeOf<true>().not.toExtend<HttpMethod>();
		});

		it("should reject `null` as a subtype", () => {
			expectTypeOf<null>().not.toExtend<HttpMethod>();
		});

		it("should reject `undefined` as a subtype", () => {
			expectTypeOf<undefined>().not.toExtend<HttpMethod>();
		});

		it("should reject a union mixing a valid verb with a non-string member", () => {
			expectTypeOf<"GET" | 1>().not.toExtend<HttpMethod>();
		});
	});
});
