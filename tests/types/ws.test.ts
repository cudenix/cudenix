import { beforeAll, describe, expect, test } from "bun:test";

import type { AssignableTo } from "@/types/assignable-to";
import type { ExtendsType } from "@/types/extends-type";
import type { WSData } from "@/types/ws";

type Inner = Partial<
	Record<"close" | "drain" | "message" | "open", (...options: any[]) => any>
>;

describe("WSData", () => {
	describe("full lifecycle config", () => {
		let value: WSData;

		beforeAll(() => {
			value = {
				close: () => undefined,
				drain: () => undefined,
				message: () => undefined,
				open: () => undefined,
			};
		});

		test("should accept a config with every lifecycle handler", () => {
			expect(typeof value?.open).toBe("function");
			expect(typeof value?.close).toBe("function");
			expect(typeof value?.drain).toBe("function");
			expect(typeof value?.message).toBe("function");
		});
	});

	describe("single-handler configs", () => {
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

		test("should accept a config with only the `close` handler", () => {
			const value: WSData = { close: () => undefined };

			expect(typeof value?.close).toBe("function");
			expect(value?.open).toBeUndefined();
		});

		test("should accept a config with only the `drain` handler", () => {
			const value: WSData = { drain: () => undefined };

			expect(typeof value?.drain).toBe("function");
			expect(value?.message).toBeUndefined();
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

	describe("empty and undefined inputs", () => {
		test("should accept the empty object (no handlers)", () => {
			const value: WSData = {};

			expect(value).toEqual({});
		});

		test("should accept a handler explicitly set to `undefined` (Partial makes values nullable)", () => {
			const value: WSData = { open: undefined };

			expect(value?.open).toBeUndefined();
		});

		test("should accept `undefined` to opt out of websocket configuration entirely", () => {
			const value: WSData = undefined;

			expect(value).toBeUndefined();
		});
	});

	describe("assignability of valid supertypes", () => {
		test("should permit `undefined` as a member of the WSData union", () => {
			const check: AssignableTo<undefined, WSData> = true;

			expect(check).toBe(true);
		});

		test("should permit `{}` as a partial config", () => {
			const check: AssignableTo<NonNullable<unknown>, WSData> = true;

			expect(check).toBe(true);
		});

		test("should accept the underlying `Partial<Record<…>>` shape as a subtype", () => {
			const check: AssignableTo<Inner, WSData> = true;

			expect(check).toBe(true);
		});

		test("should tolerate extra unknown keys when paired with a recognized key (TypeScript width subtyping)", () => {
			interface Mixed {
				open: () => void;
				unexpected: () => void;
			}

			const check: AssignableTo<Mixed, WSData> = true;

			expect(check).toBe(true);
		});
	});

	describe("type-level invariants", () => {
		test("should not collapse to its non-undefined branch", () => {
			const check: ExtendsType<WSData, Inner> = false;

			expect(check).toBe(false);
		});
	});

	describe("rejected inputs", () => {
		test("should not accept `null` (only undefined is in the union)", () => {
			const check: AssignableTo<null, WSData> = false;

			expect(check).toBe(false);
		});

		test("should not accept a `number` value", () => {
			const check: AssignableTo<123, WSData> = false;

			expect(check).toBe(false);
		});

		test("should not accept a `string` value", () => {
			const check: AssignableTo<"ws", WSData> = false;

			expect(check).toBe(false);
		});

		test("should not accept a `boolean` value", () => {
			const check: AssignableTo<true, WSData> = false;

			expect(check).toBe(false);
		});

		test("should not accept a known key whose value is not a function", () => {
			interface Bad {
				open: 1;
			}

			const check: ExtendsType<AssignableTo<Bad, WSData>, false> = true;

			expect(check).toBe(true);
		});

		test("should reject a config whose only key is unknown (TypeScript weak-type rule)", () => {
			interface Bad {
				unexpected: () => void;
			}

			const check: ExtendsType<AssignableTo<Bad, WSData>, false> = true;

			expect(check).toBe(true);
		});
	});
});
