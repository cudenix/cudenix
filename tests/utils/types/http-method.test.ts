import { describe, expectTypeOf, test } from "bun:test";

import type { HttpMethod } from "@/utils/types/http-method";

describe("HttpMethod", () => {
	describe("custom verbs via the string brand", () => {
		test("should accept an arbitrary uppercase verb", () => {
			expectTypeOf<"PURGE">().toExtend<HttpMethod>();
		});

		test("should accept the WebDAV `REPORT` verb", () => {
			expectTypeOf<"REPORT">().toExtend<HttpMethod>();
		});

		test("should accept a long single-word uppercase verb", () => {
			expectTypeOf<"MKCALENDAR">().toExtend<HttpMethod>();
		});

		test("should accept a verb containing digits", () => {
			expectTypeOf<"HTTP2">().toExtend<HttpMethod>();
		});

		test("should accept a verb containing a hyphen", () => {
			expectTypeOf<"X-CUSTOM">().toExtend<HttpMethod>();
		});

		test("should accept a verb containing an underscore", () => {
			expectTypeOf<"X_CUSTOM">().toExtend<HttpMethod>();
		});

		test("should accept the empty string", () => {
			expectTypeOf<"">().toExtend<HttpMethod>();
		});
	});

	describe("case insensitivity", () => {
		test("should accept a fully lowercase verb", () => {
			expectTypeOf<"get">().toExtend<HttpMethod>();
		});

		test("should accept a capitalised verb", () => {
			expectTypeOf<"Get">().toExtend<HttpMethod>();
		});

		test("should accept a mixed-case verb", () => {
			expectTypeOf<"gEt">().toExtend<HttpMethod>();
		});

		test("should accept a lowercase custom verb", () => {
			expectTypeOf<"purge">().toExtend<HttpMethod>();
		});
	});

	describe("subtype relations", () => {
		test("should include all canonical named methods as assignable values", () => {
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

		test("should accept plain `string` (the underlying brand)", () => {
			expectTypeOf<string>().toExtend<HttpMethod>();
		});
	});

	describe("supertype relations", () => {
		test("should itself be assignable to `string` (every member is a string)", () => {
			expectTypeOf<HttpMethod>().toExtend<string>();
		});

		test("should not be constrained to `Uppercase<string>` (case is unrestricted)", () => {
			expectTypeOf<HttpMethod>().not.toExtend<Uppercase<string>>();
		});
	});

	describe("brand preservation", () => {
		test("should not be exactly equal to `string` (the brand preserves literals)", () => {
			expectTypeOf<HttpMethod>().not.toEqualTypeOf<string>();
		});
	});

	describe("non-assignable types", () => {
		test("should reject `number` as a subtype", () => {
			expectTypeOf<1>().not.toExtend<HttpMethod>();
		});

		test("should reject `boolean` as a subtype", () => {
			expectTypeOf<true>().not.toExtend<HttpMethod>();
		});

		test("should reject `null` as a subtype", () => {
			expectTypeOf<null>().not.toExtend<HttpMethod>();
		});

		test("should reject `undefined` as a subtype", () => {
			expectTypeOf<undefined>().not.toExtend<HttpMethod>();
		});
	});
});
