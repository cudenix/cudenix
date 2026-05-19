import { describe, expect, test } from "bun:test";

import type { AssignableTo } from "@/types/assignable-to";
import type { ExtendsType } from "@/types/extends-type";
import type { HttpMethod } from "@/types/http-method";

describe("HttpMethod", () => {
	describe("canonical named methods", () => {
		test("should accept `GET`", () => {
			const method: HttpMethod = "GET";

			expect(method).toBe("GET");
		});

		test("should accept `POST`", () => {
			const method: HttpMethod = "POST";

			expect(method).toBe("POST");
		});

		test("should accept `PUT`", () => {
			const method: HttpMethod = "PUT";

			expect(method).toBe("PUT");
		});

		test("should accept `PATCH`", () => {
			const method: HttpMethod = "PATCH";

			expect(method).toBe("PATCH");
		});

		test("should accept `DELETE`", () => {
			const method: HttpMethod = "DELETE";

			expect(method).toBe("DELETE");
		});

		test("should accept `HEAD`", () => {
			const method: HttpMethod = "HEAD";

			expect(method).toBe("HEAD");
		});

		test("should accept `OPTIONS`", () => {
			const method: HttpMethod = "OPTIONS";

			expect(method).toBe("OPTIONS");
		});

		test("should accept the synthetic `WS` method for websocket upgrades", () => {
			const method: HttpMethod = "WS";

			expect(method).toBe("WS");
		});
	});

	describe("custom upper-case verbs via the string brand", () => {
		test("should accept an arbitrary uppercase verb", () => {
			const method: HttpMethod = "PURGE";

			expect(method).toBe("PURGE");
		});

		test("should accept the WebDAV `REPORT` verb", () => {
			const method: HttpMethod = "REPORT";

			expect(method).toBe("REPORT");
		});

		test("should accept a long single-word uppercase verb", () => {
			const method: HttpMethod = "MKCALENDAR";

			expect(method).toBe("MKCALENDAR");
		});

		test("should accept an uppercase verb containing digits", () => {
			const method: HttpMethod = "HTTP2";

			expect(method).toBe("HTTP2");
		});

		test("should accept an uppercase verb containing a hyphen", () => {
			const method: HttpMethod = "X-CUSTOM";

			expect(method).toBe("X-CUSTOM");
		});

		test("should accept an uppercase verb containing an underscore", () => {
			const method: HttpMethod = "X_CUSTOM";

			expect(method).toBe("X_CUSTOM");
		});

		test("should accept the empty string (vacuously uppercase)", () => {
			const method: HttpMethod = "";

			expect(method).toBe("");
		});
	});

	describe("subtype relations", () => {
		test('should accept `"GET"` as a subtype', () => {
			const check: AssignableTo<"GET", HttpMethod> = true;

			expect(check).toBe(true);
		});

		test('should accept `"POST"` as a subtype', () => {
			const check: AssignableTo<"POST", HttpMethod> = true;

			expect(check).toBe(true);
		});

		test('should accept the synthetic `"WS"` as a subtype', () => {
			const check: AssignableTo<"WS", HttpMethod> = true;

			expect(check).toBe(true);
		});

		test('should accept `"PURGE"` (custom upper-case) as a subtype', () => {
			const check: AssignableTo<"PURGE", HttpMethod> = true;

			expect(check).toBe(true);
		});

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

		test("should accept `Uppercase<string>` (the underlying brand)", () => {
			const check: AssignableTo<Uppercase<string>, HttpMethod> = true;

			expect(check).toBe(true);
		});
	});

	describe("supertype relations", () => {
		test("should itself be assignable to `string` (every member is a string)", () => {
			const check: AssignableTo<HttpMethod, string> = true;

			expect(check).toBe(true);
		});

		test("should itself be assignable to `Uppercase<string>`", () => {
			const check: AssignableTo<HttpMethod, Uppercase<string>> = true;

			expect(check).toBe(true);
		});
	});

	describe("brand preservation", () => {
		test("should not be exactly equal to `string` (the brand preserves literals)", () => {
			const check: ExtendsType<HttpMethod, string> = false;

			expect(check).toBe(false);
		});
	});

	describe("case sensitivity", () => {
		test("should reject a fully lowercase verb", () => {
			const check: AssignableTo<"get", HttpMethod> = false;

			expect(check).toBe(false);
		});

		test("should reject a capitalised verb", () => {
			const check: AssignableTo<"Get", HttpMethod> = false;

			expect(check).toBe(false);
		});

		test("should reject a mixed-case verb", () => {
			const check: AssignableTo<"gEt", HttpMethod> = false;

			expect(check).toBe(false);
		});

		test("should reject a lowercase custom verb", () => {
			const check: AssignableTo<"purge", HttpMethod> = false;

			expect(check).toBe(false);
		});
	});

	describe("non-assignable types", () => {
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

		test("should reject `undefined` as a subtype", () => {
			const check: AssignableTo<undefined, HttpMethod> = false;

			expect(check).toBe(false);
		});

		test("should reject plain `string` as a subtype (too wide for the brand)", () => {
			const check: AssignableTo<string, HttpMethod> = false;

			expect(check).toBe(false);
		});
	});
});
