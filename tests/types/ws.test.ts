import { describe, expectTypeOf, test } from "bun:test";

import type { WSData } from "@/types/ws";

type A = Partial<
	Record<"close" | "drain" | "message" | "open", (...options: any[]) => any>
>;

describe("WSData", () => {
	describe("full lifecycle config", () => {
		test("should accept a config with every lifecycle handler", () => {
			expectTypeOf<{
				close: () => undefined;
				drain: () => undefined;
				message: () => undefined;
				open: () => undefined;
			}>().toExtend<WSData>();
		});
	});

	describe("single-handler configs", () => {
		test("should accept a config with only the `open` handler", () => {
			expectTypeOf<{ open: () => undefined }>().toExtend<WSData>();
		});

		test("should accept a config with only the `message` handler", () => {
			expectTypeOf<{
				message: (socket: unknown, payload: unknown) => undefined;
			}>().toExtend<WSData>();
		});

		test("should accept a config with only the `close` handler", () => {
			expectTypeOf<{ close: () => undefined }>().toExtend<WSData>();
		});

		test("should accept a config with only the `drain` handler", () => {
			expectTypeOf<{ drain: () => undefined }>().toExtend<WSData>();
		});
	});

	describe("handler signature flexibility", () => {
		test("should accept handlers with arbitrary parameter shapes", () => {
			expectTypeOf<{
				message: (a: number, b: string, c: boolean) => "v1";
				open: () => null;
			}>().toExtend<WSData>();
		});

		test("should accept handlers with arbitrary return types", () => {
			expectTypeOf<{
				close: () => "v1";
				drain: () => Promise<number>;
			}>().toExtend<WSData>();
		});
	});

	describe("empty and undefined inputs", () => {
		test("should accept the empty object (no handlers)", () => {
			expectTypeOf<NonNullable<unknown>>().toExtend<WSData>();
		});

		test("should accept a handler explicitly set to `undefined` (Partial makes values nullable)", () => {
			expectTypeOf<{ open: undefined }>().toExtend<WSData>();
		});

		test("should accept `undefined` to opt out of websocket configuration entirely", () => {
			expectTypeOf<undefined>().toExtend<WSData>();
		});
	});

	describe("assignability of valid supertypes", () => {
		test("should permit `undefined` as a member of the WSData union", () => {
			expectTypeOf<undefined>().toExtend<WSData>();
		});

		test("should permit `{}` as a partial config", () => {
			expectTypeOf<NonNullable<unknown>>().toExtend<WSData>();
		});

		test("should accept the underlying `Partial<Record<…>>` shape as a subtype", () => {
			expectTypeOf<A>().toExtend<WSData>();
		});

		test("should tolerate extra unknown keys when paired with a recognized key (TypeScript width subtyping)", () => {
			interface A {
				a: () => void;
				open: () => void;
			}

			expectTypeOf<A>().toExtend<WSData>();
		});
	});

	describe("type-level invariants", () => {
		test("should not collapse to its non-undefined branch", () => {
			expectTypeOf<WSData>().not.toEqualTypeOf<A>();
		});
	});

	describe("rejected inputs", () => {
		test("should not accept `null` (only undefined is in the union)", () => {
			expectTypeOf<null>().not.toExtend<WSData>();
		});

		test("should not accept a `number` value", () => {
			expectTypeOf<1>().not.toExtend<WSData>();
		});

		test("should not accept a `string` value", () => {
			expectTypeOf<"v1">().not.toExtend<WSData>();
		});

		test("should not accept a `boolean` value", () => {
			expectTypeOf<true>().not.toExtend<WSData>();
		});

		test("should not accept a known key whose value is not a function", () => {
			interface A {
				open: 1;
			}

			expectTypeOf<A>().not.toExtend<WSData>();
		});

		test("should reject a config whose only key is unknown (TypeScript weak-type rule)", () => {
			interface A {
				a: () => void;
			}

			expectTypeOf<A>().not.toExtend<WSData>();
		});
	});
});
