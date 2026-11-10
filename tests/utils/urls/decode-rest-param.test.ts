import { describe, expect, it } from "bun:test";

import { decodePathParam } from "@/utils/urls/decode-path-param";
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

		it("should decode a segment long enough to grow the shared byte buffer", () => {
			// a grown run leaks no bytes across segments
			expect(decodeRestParam(`a/${"%FF".repeat(600)}`)).toEqual([
				"a",
				"�".repeat(600),
			]);
		});

		it("should replace a surrogate pair without recombining it", () => {
			expect(decodeRestParam("%ED%A0%80%ED%B0%80/a")).toEqual([
				"��",
				"a",
			]);
		});

		it("should keep the character after a malformed escape", () => {
			expect(decodeRestParam("a/%é/b")).toEqual(["a", "�é", "b"]);
		});
	});

	describe("degenerate input", () => {
		it("should return one empty segment for an empty value", () => {
			expect(decodeRestParam("")).toEqual([""]);
		});

		it("should preserve empty segments around separators", () => {
			expect(decodeRestParam("a//b")).toEqual(["a", "", "b"]);
		});

		it("should preserve leading and trailing empty segments", () => {
			expect(decodeRestParam("/a/b/")).toEqual(["", "a", "b", ""]);
		});

		it("should preserve empty segments next to an encoded one", () => {
			expect(decodeRestParam("/a%20b//c/")).toEqual([
				"",
				"a b",
				"",
				"c",
				"",
			]);
		});

		it("should not read an escape across a separator", () => {
			expect(decodeRestParam("a%2/0b")).toEqual(["a�2", "0b"]);
		});
	});

	describe("segment boundaries", () => {
		it("should decode an escape at the start and end of the value", () => {
			expect(decodeRestParam("%41/b/%42")).toEqual(["A", "b", "B"]);
		});

		it("should decode an escape only in the last segment", () => {
			expect(decodeRestParam("a/b/c%21")).toEqual(["a", "b", "c!"]);
		});

		it("should decode a value that is one encoded slash", () => {
			expect(decodeRestParam("%2F")).toEqual(["/"]);
		});

		it("should keep literal non-ASCII characters", () => {
			expect(decodeRestParam("café/日本/😀")).toEqual([
				"café",
				"日本",
				"😀",
			]);
			expect(decodeRestParam("café/a%20b/😀")).toEqual([
				"café",
				"a b",
				"😀",
			]);
		});

		it("should not join a sequence split by a separator", () => {
			expect(decodeRestParam("%C3/%A9")).toEqual(["�", "�"]);
		});
	});

	describe("result", () => {
		it("should return a new array on every call", () => {
			const first = decodeRestParam("a/b");
			const second = decodeRestParam("a/b");

			expect(first).not.toBe(second);

			first.push("c");

			expect(decodeRestParam("a/b")).toEqual(["a", "b"]);
		});
	});

	describe("equivalence with decodePathParam", () => {
		// seeded generator so the cases are reproducible
		let seed = 0x9e_37_79_b9;

		const pieces = [
			"a",
			"bc",
			"users",
			"/",
			"/",
			"/",
			"%20",
			"%2F",
			"%25",
			"%C3%A9",
			"%F0%9F%98%80",
			"%E6%97%A5%E6%9C%AC%E8%AA%9E",
			"%FF",
			"%ED%A0%80",
			"%",
			"%2",
			"%G1",
			"%é",
			"é",
			"😀",
			"+",
			"",
		];

		const random = (): number => {
			seed ^= seed << 13;
			seed ^= seed >>> 17;
			seed ^= seed << 5;

			return (seed >>> 0) / 4_294_967_296;
		};

		it("should match a split followed by a decode of each segment", () => {
			for (let i = 0; i < 5000; i++) {
				const count = Math.floor(random() * 12);

				let value = "";

				for (let j = 0; j < count; j++) {
					value += pieces[Math.floor(random() * pieces.length)];
				}

				expect(decodeRestParam(value)).toEqual(
					value.split("/").map((segment) => decodePathParam(segment)),
				);
			}
		});
	});
});
