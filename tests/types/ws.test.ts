import { describe, expect, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";
import type { WSData } from "@/types/ws";

type AssignableTo<Sub, Super> = [Sub] extends [Super] ? true : false;

describe("WSData", () => {
	describe("structural conformance", () => {
		test("should accept a config with every lifecycle handler", () => {
			const value: WSData = {
				close: () => undefined,
				drain: () => undefined,
				message: () => undefined,
				open: () => undefined,
			};

			expect(typeof value?.open).toBe("function");
			expect(typeof value?.close).toBe("function");
			expect(typeof value?.drain).toBe("function");
			expect(typeof value?.message).toBe("function");
		});

		test("should accept a config with only the `open` handler", () => {
			const value: WSData = { open: () => undefined };

			expect(typeof value?.open).toBe("function");
			expect(value?.close).toBeUndefined();
		});

		test("should accept a config with only the `message` handler", () => {
			const value: WSData = {
				message: (_socket: unknown, _payload: unknown) => undefined,
			};

			expect(typeof value?.message).toBe("function");
		});

		test("should accept the empty object (no handlers)", () => {
			const value: WSData = {};

			expect(value).toEqual({});
		});

		test("should accept `undefined` to opt out of websocket configuration entirely", () => {
			const value: WSData = undefined;

			expect(value).toBeUndefined();
		});
	});

	describe("handler signature flexibility", () => {
		test("should accept handlers with arbitrary parameter shapes", () => {
			const value: WSData = {
				message: (_a: number, _b: string, _c: boolean) => "any",
				open: () => null,
			};

			expect(typeof value?.message).toBe("function");
		});

		test("should accept handlers with arbitrary return types", () => {
			const value: WSData = {
				close: () => "closed",
				drain: () => Promise.resolve(1),
			};

			expect(typeof value?.drain).toBe("function");
			expect(typeof value?.close).toBe("function");
		});
	});

	describe("structural relations", () => {
		test("should permit `undefined` as a member of the WSData union", () => {
			const check: AssignableTo<undefined, WSData> = true;

			expect(check).toBe(true);
		});

		test("should permit `{}` as a partial config", () => {
			const check: AssignableTo<NonNullable<unknown>, WSData> = true;

			expect(check).toBe(true);
		});

		test("should not accept `null` (only undefined is in the union)", () => {
			const check: AssignableTo<null, WSData> = false;

			expect(check).toBe(false);
		});

		test("should not accept a config with an unknown event key", () => {
			type Bad = { unexpected: () => void };

			const check: ExtendsType<AssignableTo<Bad, WSData>, false> = true;

			expect(check).toBe(true);
		});
	});
});
