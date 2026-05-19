import { describe, expect, test } from "bun:test";

import type { AssignableTo } from "@/types/assignable-to";
import type { ExtendsType } from "@/types/extends-type";
import type { HttpMethod } from "@/types/http-method";

describe("HttpMethod", () => {
	describe("named methods", () => {
		test("should accept `GET`", () => {
			const method: HttpMethod = "GET";

			expect(method).toBe("GET");
		});

		test("should accept `POST`", () => {
			const method: HttpMethod = "POST";

			expect(method).toBe("POST");
		});

		test("should accept `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`", () => {
			const methods: HttpMethod[] = [
				"PUT",
				"PATCH",
				"DELETE",
				"HEAD",
				"OPTIONS",
			];

			expect(methods).toEqual([
				"PUT",
				"PATCH",
				"DELETE",
				"HEAD",
				"OPTIONS",
			]);
		});

		test("should accept the synthetic `WS` method for websocket upgrades", () => {
			const method: HttpMethod = "WS";

			expect(method).toBe("WS");
		});
	});

	describe("custom upper-case verbs", () => {
		test("should accept an arbitrary uppercase verb via the string brand", () => {
			const method: HttpMethod = "PURGE";

			expect(method).toBe("PURGE");
		});

		test("should accept a multi-word uppercase verb", () => {
			const method: HttpMethod = "REPORT";

			expect(method).toBe("REPORT");
		});
	});

	describe("subtype relations", () => {
		test('should accept `"GET"` as a subtype of HttpMethod', () => {
			const check: AssignableTo<"GET", HttpMethod> = true;

			expect(check).toBe(true);
		});

		test('should accept `"PURGE"` (custom upper-case) as a subtype', () => {
			const check: AssignableTo<"PURGE", HttpMethod> = true;

			expect(check).toBe(true);
		});

		test("should reject `number` as a subtype", () => {
			const check: AssignableTo<123, HttpMethod> = false;

			expect(check).toBe(false);
		});

		test("should reject `boolean` as a subtype", () => {
			const check: AssignableTo<true, HttpMethod> = false;

			expect(check).toBe(false);
		});

		test("should reject `null` as a subtype", () => {
			const check: AssignableTo<null, HttpMethod> = false;

			expect(check).toBe(false);
		});
	});

	describe("union membership", () => {
		test("should include all canonical named methods as assignable values", () => {
			type Named =
				| "DELETE"
				| "GET"
				| "HEAD"
				| "OPTIONS"
				| "PATCH"
				| "POST"
				| "PUT"
				| "WS";

			const check: AssignableTo<Named, HttpMethod> = true;

			expect(check).toBe(true);
		});

		test("should not be exactly equal to `string` (the brand preserves literals)", () => {
			const check: ExtendsType<HttpMethod, string> = false;

			expect(check).toBe(false);
		});
	});
});
