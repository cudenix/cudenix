import { describe, expectTypeOf, it } from "bun:test";

import type { HttpMethod } from "@/utils/types/http-method";

describe("HttpMethod", () => {
	describe("named members", () => {
		it("should keep `DELETE` extractable from the union", () => {
			expectTypeOf<
				Extract<HttpMethod, "DELETE">
			>().toEqualTypeOf<"DELETE">();
		});

		it("should keep `GET` extractable from the union", () => {
			expectTypeOf<Extract<HttpMethod, "GET">>().toEqualTypeOf<"GET">();
		});

		it("should keep `HEAD` extractable from the union", () => {
			expectTypeOf<Extract<HttpMethod, "HEAD">>().toEqualTypeOf<"HEAD">();
		});

		it("should keep `OPTIONS` extractable from the union", () => {
			expectTypeOf<
				Extract<HttpMethod, "OPTIONS">
			>().toEqualTypeOf<"OPTIONS">();
		});

		it("should keep `PATCH` extractable from the union", () => {
			expectTypeOf<
				Extract<HttpMethod, "PATCH">
			>().toEqualTypeOf<"PATCH">();
		});

		it("should keep `POST` extractable from the union", () => {
			expectTypeOf<Extract<HttpMethod, "POST">>().toEqualTypeOf<"POST">();
		});

		it("should keep `PUT` extractable from the union", () => {
			expectTypeOf<Extract<HttpMethod, "PUT">>().toEqualTypeOf<"PUT">();
		});

		it("should not surface an unnamed verb as a literal member", () => {
			expectTypeOf<Extract<HttpMethod, "PURGE">>().toEqualTypeOf<never>();
		});
	});

	describe("string brand", () => {
		it("should accept plain `string` (the brand widens the union)", () => {
			expectTypeOf<string>().toExtend<HttpMethod>();
		});

		it("should not be exactly equal to `string` (the brand preserves literals)", () => {
			expectTypeOf<HttpMethod>().not.toEqualTypeOf<string>();
		});

		it("should accept an arbitrary custom verb via the brand", () => {
			expectTypeOf<"PURGE">().toExtend<HttpMethod>();
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

	describe("record keys", () => {
		it("should survive a round-trip through `keyof Record` (mapping preserves the union)", () => {
			expectTypeOf<
				keyof Record<HttpMethod, unknown>
			>().toEqualTypeOf<HttpMethod>();
		});

		it("should accept an arbitrary string as a `Record` key (callers index by `request.method`)", () => {
			expectTypeOf<string>().toExtend<
				keyof Record<HttpMethod, unknown>
			>();
		});

		it("should surface `undefined` when a `Record` is indexed through the brand", () => {
			const methods = {} as Record<HttpMethod, number>;
			const method = "PURGE" as HttpMethod;

			expectTypeOf(methods[method]).toEqualTypeOf<number | undefined>();
		});

		it("should keep a named verb as a required `Record` property", () => {
			const methods = {} as Record<HttpMethod, number>;

			expectTypeOf(methods.GET).toEqualTypeOf<number>();
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
