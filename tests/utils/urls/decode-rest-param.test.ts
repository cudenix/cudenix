import { describe, expect, it } from "bun:test";

import { decodeRestParam } from "@/utils/urls/decode-rest-param";

describe("decodeRestParam", () => {
	it.each([
		["return one empty segment for an empty value", "", [""]],
		["decode a value without separators", "a%20b", ["a b"]],
		["split a value without escapes", "a/b/c", ["a", "b", "c"]],
		[
			"preserve empty segments without escapes",
			"/a//b/",
			["", "a", "", "b", ""],
		],
		["decode an escape in the first segment", "a%20b/c", ["a b", "c"]],
		[
			"decode an escape in a middle segment",
			"a/b%20c/d",
			["a", "b c", "d"],
		],
		["decode an escape in the last segment", "a/b/c%21", ["a", "b", "c!"]],
		[
			"preserve empty segments next to an encoded one",
			"/a%20b//c/",
			["", "a b", "", "c", ""],
		],
		["keep an encoded slash inside its segment", "a%2Fb/c", ["a/b", "c"]],
	] as const)("should %s", (_, value, expected) => {
		expect(decodeRestParam(value)).toEqual([...expected]);
	});
});
