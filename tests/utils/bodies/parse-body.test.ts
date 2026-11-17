import { describe, expect, it } from "bun:test";

import { parseBody } from "@/utils/bodies/parse-body";

const BINARY = "application/octet-stream";
const JSON_TYPE = "application/json";
const MULTIPART = "multipart/form-data";
const MULTIPART_BODY = [
	"--v2",
	'Content-Disposition: form-data; name="a"',
	"",
	"v1",
	"--v2--",
	"",
].join("\r\n");

const URLENCODED = "application/x-www-form-urlencoded";

const request = (body: Bun.BodyInit, contentType?: string): Request =>
	new Request(
		"http://localhost/a",
		contentType === undefined
			? { body, method: "POST" }
			: {
					body,
					headers: { "content-type": contentType },
					method: "POST",
				},
	);

// Bun joins duplicate request headers with ", "
const variants = (type: string): string[] => [
	type,
	type.toUpperCase(),
	`${type};a=b`,
	`${type} \t, a/b`,
];

describe("parseBody", () => {
	describe("media type matching", () => {
		it.each(variants(JSON_TYPE))(
			"should parse %p as JSON",
			async (contentType) => {
				expect(
					await parseBody(request('{"a":"v1"}', contentType)),
				).toEqual({ a: "v1" });
			},
		);

		it.each(variants(BINARY))(
			"should read %p as an ArrayBuffer",
			async (contentType) => {
				expect(
					await parseBody(
						request(new Uint8Array([1, 2, 3]), contentType),
					),
				).toEqual(new Uint8Array([1, 2, 3]).buffer);
			},
		);

		it.each(variants(URLENCODED))(
			"should parse %p as a urlencoded form",
			async (contentType) => {
				expect(await parseBody(request("a=v1", contentType))).toEqual({
					a: "v1",
				});
			},
		);

		it.each([
			`${MULTIPART}; boundary=v2`,
			"Multipart/Form-Data; boundary=v2",
			`${MULTIPART} \t; boundary=v2`,
		])("should parse %p as a multipart form", async (contentType) => {
			expect(
				await parseBody(request(MULTIPART_BODY, contentType)),
			).toEqual({ a: "v1" });
		});

		it.each([MULTIPART, `${MULTIPART}, a/b`])(
			"should take the multipart branch for %p, which rejects without a boundary",
			async (contentType) => {
				expect(
					await parseBody(request("v1", contentType)).catch(
						(error: unknown) => error,
					),
				).toBeInstanceOf(TypeError);
			},
		);

		it.each(
			[JSON_TYPE, BINARY, URLENCODED, MULTIPART].flatMap((type) => [
				`${type}x`,
				`a/b, ${type}`,
			]),
		)("should read %p as text", async (contentType) => {
			expect(await parseBody(request("v1", contentType))).toBe("v1");
		});
	});

	describe("text fallback", () => {
		it("should read the body as text when there is no content type", async () => {
			const bytes = request(new Uint8Array([118, 49]));

			expect(bytes.headers.get("content-type")).toBeNull();
			expect(await parseBody(bytes)).toBe("v1");
		});

		it.each(["", "text/plain"])(
			"should read the body as text when the content type is %p",
			async (contentType) => {
				expect(await parseBody(request("v1", contentType))).toBe("v1");
			},
		);
	});

	describe("urlencoded bodies", () => {
		it("should parse the whole body in form mode", async () => {
			expect(
				await parseBody(request('=v1&a={"b":1}&c=v2', URLENCODED)),
			).toEqual({ "": "v1", a: '{"b":1}', c: "v2" });
		});
	});

	describe("multipart bodies", () => {
		it("should keep single values and collect repeated fields into an array", async () => {
			const formData = new FormData();

			formData.append("a", "v1");
			formData.append("b", new File(["v2"], "b.txt"));
			formData.append("c", "v3");
			formData.append("c", "v4");
			formData.append("c", "v5");

			const result = (await parseBody(request(formData))) as Record<
				string,
				unknown
			>;

			expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
			expect(Object.keys(result)).toEqual(["a", "b", "c"]);
			expect(result.a).toBe("v1");
			expect(result.b).toBeInstanceOf(File);
			expect(result.c).toEqual(["v3", "v4", "v5"]);
		});

		it("should pair field names inherited from Object.prototype with the inherited member", async () => {
			const formData = new FormData();

			formData.append("__proto__", "v1");
			formData.append("constructor", "v2");

			const result = await parseBody(request(formData));

			expect(Object.getPrototypeOf(result)).toEqual([
				Object.prototype,
				"v1",
			]);
			expect(result).toEqual({ constructor: [Object, "v2"] });
		});
	});
});
