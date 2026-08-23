import { describe, expect, it } from "bun:test";

import { decodeRestParam } from "@/utils/urls/decode-rest-param";

describe("decodeRestParam", () => {
	describe("without percent-encoding", () => {
		it("should split a single segment", () => {
			expect(decodeRestParam("a")).toEqual(["a"]);
		});

		it("should split every segment", () => {
			expect(decodeRestParam("a/b/c")).toEqual(["a", "b", "c"]);
		});

		it("should keep a plus sign literal", () => {
			expect(decodeRestParam("a+b/c")).toEqual(["a+b", "c"]);
		});
	});

	describe("with percent-encoding", () => {
		it("should decode each segment", () => {
			expect(decodeRestParam("a%20b/c%2Dd")).toEqual(["a b", "c-d"]);
		});

		it("should decode a segment that is entirely encoded", () => {
			expect(decodeRestParam("caf%C3%A9/%F0%9F%98%80")).toEqual([
				"café",
				"😀",
			]);
		});

		it("should keep an encoded slash inside its segment", () => {
			expect(decodeRestParam("a%2Fb/c")).toEqual(["a/b", "c"]);
		});

		it("should decode only the segments that need it", () => {
			expect(decodeRestParam("plain/a%20b/plain")).toEqual([
				"plain",
				"a b",
				"plain",
			]);
		});

		it("should replace a malformed sequence without dropping the segment", () => {
			expect(decodeRestParam("a/%FF/b")).toEqual(["a", "�", "b"]);
		});

		it("should replace a truncated escape", () => {
			expect(decodeRestParam("a/%2")).toEqual(["a", "�2"]);
		});
	});

	describe("degenerate input", () => {
		it("should return one empty segment for an empty value", () => {
			expect(decodeRestParam("")).toEqual([""]);
		});

		it("should preserve empty segments around separators", () => {
			expect(decodeRestParam("a//b")).toEqual(["a", "", "b"]);
		});
	});
});
