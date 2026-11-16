import { describe, expect, it } from "bun:test";

import { parseUrlencoded } from "@/utils/urls/parse-urlencoded";

const parseForm = (text: string): Record<string, unknown> =>
	parseUrlencoded(text, 0, text.length, false);

const parseSearch = (text: string): Record<string, unknown> =>
	parseUrlencoded(text, 0, text.length, true);

const searchParams = (text: string): Record<string, unknown> => {
	const params: Record<string, unknown> = {};

	for (const [key, value] of new URLSearchParams(text)) {
		const current = params[key];

		if (current === undefined) {
			params[key] = value;
		} else if (Array.isArray(current)) {
			current.push(value);
		} else {
			params[key] = [current, value];
		}
	}

	return params;
};

describe("parseUrlencoded", () => {
	describe("range", () => {
		it("should parse only the pairs between start and end", () => {
			expect(parseUrlencoded("/a?b=v1&c=v2#d=v3", 3, 12, true)).toEqual({
				b: "v1",
				c: "v2",
			});
		});

		it("should cut a value at end even without a separator", () => {
			expect(parseUrlencoded("a=v1v2", 0, 4, false)).toEqual({ a: "v1" });
		});

		it.each([
			["start equals end", 2, 2],
			["start is past end", 4, 2],
		])("should return an empty dictionary when %s", (_, start, end) => {
			const result = parseUrlencoded("a=v1&b=v2", start, end, true);

			expect(Object.keys(result)).toHaveLength(0);
			expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
		});
	});

	describe("shared behavior", () => {
		it.each([
			["a=v1&b=v2", { a: "v1", b: "v2" }],
			["a", { a: "" }],
			["a=", { a: "" }],
			["a=v1=v2", { a: "v1=v2" }],
			["&&a=v1&&", { a: "v1" }],
			["a+b=v1+v2", { "a b": "v1 v2" }],
			["a%20b=%C3%A9", { "a b": "é" }],
			["a=%2B+%26", { a: "+ &" }],
			["a=1&b=true&c=null", { a: "1", b: "true", c: "null" }],
			["a=1&b=2&a=3&b=4&a=5", { a: ["1", "3", "5"], b: ["2", "4"] }],
		])("should parse %p the same way in both modes", (text, expected) => {
			expect(parseForm(text)).toEqual(expected);
			expect(parseSearch(text)).toEqual(expected);
		});

		it.each([
			["a=%2&b=%", { a: "%2", b: "%" }],
			["a=%ZZ%20", { a: "%ZZ " }],
			["a=%E9", { a: "�" }],
			["%E0%A4=v1", { "�": "v1" }],
			["a=é%FF", { a: "é�" }],
			["a=%EF%BB%BFv1%FF", { a: "﻿v1�" }],
		])("should decode malformed %p without throwing", (text, expected) => {
			expect(parseForm(text)).toEqual(expected);
			expect(parseSearch(text)).toEqual(expected);
		});

		it("should replace the prototype with an array when the key is `__proto__`", () => {
			const result = parseForm("__proto__=v1&a=v2");

			expect(Object.keys(result)).toEqual(["a"]);
			expect(Object.getPrototypeOf(result)).toEqual([
				Object.prototype,
				"v1",
			]);
		});

		it.each(["constructor", "toString"])(
			"should pair the inherited member with the value when the key is `%s`",
			(key) => {
				const result = parseForm(`${key}=v1`);

				expect(Object.keys(result)).toEqual([key]);
				expect(Reflect.get(result, key)).toEqual([
					Reflect.get(Object.prototype, key),
					"v1",
				]);
			},
		);

		it("should return a plain object", () => {
			expect(Object.getPrototypeOf(parseForm("a=v1"))).toBe(
				Object.prototype,
			);
		});
	});

	describe("query mode", () => {
		it("should drop pairs with an empty key", () => {
			expect(parseSearch("=v1&a=v2")).toEqual({ a: "v2" });
		});

		it.each([
			['a={"b":1}', { a: { b: 1 } }],
			["a=[1,2]", { a: [1, 2] }],
			["a=%7B%22b%22%3A1%7D", { a: { b: 1 } }],
			["a={b}", { a: "{b}" }],
			["a={", { a: "{" }],
			["a=[1,2}", { a: "[1,2}" }],
			["a=[1]+", { a: "[1] " }],
			['a={"b":1}+', { a: '{"b":1} ' }],
		])("should parse %p with JSON detection", (text, expected) => {
			expect(parseSearch(text)).toEqual(expected);
		});

		it("should keep a JSON array apart from a repeated key", () => {
			expect(parseSearch("a=[1,2]&a=v1")).toEqual({ a: [[1, 2], "v1"] });
		});
	});

	describe("form mode", () => {
		it("should keep a pair with an empty key and a value", () => {
			expect(parseForm("=v1&a=v2")).toEqual({ "": "v1", a: "v2" });
		});

		it("should leave JSON-shaped values as strings", () => {
			expect(parseForm('a={"b":1}&c=[1,2]')).toEqual({
				a: '{"b":1}',
				c: "[1,2]",
			});
		});

		it("should match URLSearchParams on generated bodies", () => {
			const fragments = [
				"a",
				"b",
				"v1",
				"=",
				"&",
				"+",
				"%20",
				"%",
				"%zz",
				"%C3",
				"%C3%A9",
				"%ED%A0%80",
				"%3D",
				"%26",
			];
			const differences: string[] = [];

			let seed = 1_234_567;

			const next = (bound: number): number => {
				seed = (seed * 48_271) % 2_147_483_647;

				return seed % bound;
			};

			for (let i = 0; i < 3000; i++) {
				const parts = 1 + next(8);

				let text = "";

				for (let part = 0; part < parts; part++) {
					text += fragments[next(fragments.length)];
				}

				if (
					!Bun.deepEquals(parseForm(text), searchParams(text), true)
				) {
					differences.push(text);
				}
			}

			expect(differences).toEqual([]);
		});
	});
});
