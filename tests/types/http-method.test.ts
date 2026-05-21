import { describe, expectTypeOf, test } from "bun:test";

import type { HttpMethod } from "@/types/http-method";

describe("HttpMethod", () => {
	describe("custom upper-case verbs via the string brand", () => {
		test("should accept an arbitrary uppercase verb", () => {
			expectTypeOf<"PURGE">().toExtend<HttpMethod>();
		});

		test("should accept the WebDAV `REPORT` verb", () => {
			expectTypeOf<"REPORT">().toExtend<HttpMethod>();
		});

		test("should accept a long single-word uppercase verb", () => {
			expectTypeOf<"MKCALENDAR">().toExtend<HttpMethod>();
		});

		test("should accept an uppercase verb containing digits", () => {
			expectTypeOf<"HTTP2">().toExtend<HttpMethod>();
		});

		test("should accept an uppercase verb containing a hyphen", () => {
			expectTypeOf<"X-CUSTOM">().toExtend<HttpMethod>();
		});

		test("should accept an uppercase verb containing an underscore", () => {
			expectTypeOf<"X_CUSTOM">().toExtend<HttpMethod>();
		});

		test("should accept the empty string (vacuously uppercase)", () => {
			expectTypeOf<"">().toExtend<HttpMethod>();
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
				| "PUT"
				| "WS";

			expectTypeOf<A>().toExtend<HttpMethod>();
		});

		test("should accept `Uppercase<string>` (the underlying brand)", () => {
			expectTypeOf<Uppercase<string>>().toExtend<HttpMethod>();
		});
	});

	describe("supertype relations", () => {
		test("should itself be assignable to `string` (every member is a string)", () => {
			expectTypeOf<HttpMethod>().toExtend<string>();
		});

		test("should itself be assignable to `Uppercase<string>`", () => {
			expectTypeOf<HttpMethod>().toExtend<Uppercase<string>>();
		});
	});

	describe("brand preservation", () => {
		test("should not be exactly equal to `string` (the brand preserves literals)", () => {
			expectTypeOf<HttpMethod>().not.toEqualTypeOf<string>();
		});
	});

	describe("case sensitivity", () => {
		test("should reject a fully lowercase verb", () => {
			expectTypeOf<"get">().not.toExtend<HttpMethod>();
		});

		test("should reject a capitalised verb", () => {
			expectTypeOf<"Get">().not.toExtend<HttpMethod>();
		});

		test("should reject a mixed-case verb", () => {
			expectTypeOf<"gEt">().not.toExtend<HttpMethod>();
		});

		test("should reject a lowercase custom verb", () => {
			expectTypeOf<"purge">().not.toExtend<HttpMethod>();
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

		test("should reject plain `string` as a subtype (too wide for the brand)", () => {
			expectTypeOf<string>().not.toExtend<HttpMethod>();
		});
	});
});
