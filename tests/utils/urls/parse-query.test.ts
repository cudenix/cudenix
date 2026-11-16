import { describe, expect, it } from "bun:test";

import { parseQuery } from "@/utils/urls/parse-query";

describe("parseQuery", () => {
	it.each([
		["/a?b=v1&c=v2", { b: "v1", c: "v2" }],
		["http://localhost/a?b=v1", { b: "v1" }],
		["?b=v1", { b: "v1" }],
		["/a?b=v1?v2", { b: "v1?v2" }],
		["/a?b=v1#c=v2", { b: "v1" }],
		["/a?b#c", { b: "" }],
		["/a?b=v1#c?d=v2", { b: "v1" }],
		["/a?b=1%232&c=v1", { b: "1#2", c: "v1" }],
	])("should parse the query of %p", (url, expected) => {
		expect(parseQuery(url)).toEqual(expected);
	});

	it.each(["/a", "", "/a?", "/a?#b", "/a#c?b=v1"])(
		"should return an empty plain object for %p",
		(url) => {
			const result = parseQuery(url);

			expect(Object.keys(result)).toHaveLength(0);
			expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
		},
	);

	it("should return a fresh object when the URL has no query", () => {
		expect(parseQuery("/a")).not.toBe(parseQuery("/a"));
	});

	it("should parse in query mode", () => {
		expect(parseQuery('/a?=v1&b={"c":1}&d=[1,2]')).toEqual({
			b: { c: 1 },
			d: [1, 2],
		});
	});
});
