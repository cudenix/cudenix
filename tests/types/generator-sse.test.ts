import { describe, expect, test } from "bun:test";

import type { AnyError, Error } from "@/core/error";
import type { AnySuccess, Success } from "@/core/success";
import type { AssignableTo } from "@/types/assignable-to";
import type { ExtendsType } from "@/types/extends-type";
import type { AnyGeneratorSSE, GeneratorSSE } from "@/types/generator-sse";
import type { RequiredKeys } from "@/types/required-keys";

describe("GeneratorSSE", () => {
	describe("structural conformance", () => {
		test("should accept a frame whose `data` is an `AnySuccess`", () => {
			type Frame = GeneratorSSE<AnySuccess>;

			const value: Frame = {
				data: { content: { ok: true }, status: 200 } as Success<
					{ ok: true },
					200
				>,
			};

			expect(value.data).toBeDefined();
		});

		test("should accept a frame whose `data` is an `AnyError`", () => {
			type Frame = GeneratorSSE<AnyError>;

			const value: Frame = {
				data: { content: { reason: "bad" }, status: 400 } as Error<
					{ reason: "bad" },
					400
				>,
			};

			expect(value.data).toBeDefined();
		});

		test("should accept a frame parametrized with a concrete `Success` envelope", () => {
			type Frame = GeneratorSSE<Success<{ ok: true }, 200>>;

			const value: Frame = {
				data: { content: { ok: true }, status: 200, success: true },
			};

			expect(value.data.success).toBe(true);
			expect(value.data.status).toBe(200);
		});

		test("should accept a frame parametrized with a concrete `Error` envelope", () => {
			type Frame = GeneratorSSE<Error<{ reason: "bad" }, 400>>;

			const value: Frame = {
				data: {
					content: { reason: "bad" },
					status: 400,
					success: false,
				},
			};

			expect(value.data.success).toBe(false);
			expect(value.data.status).toBe(400);
		});

		test("should accept a frame whose `data` is a `Success | Error` union", () => {
			type Frame = GeneratorSSE<AnyError | AnySuccess>;

			const ok: Frame = { data: {} as AnySuccess };
			const ko: Frame = { data: {} as AnyError };

			expect(ok.data).toBeDefined();
			expect(ko.data).toBeDefined();
		});

		test("should accept a frame with every optional field present", () => {
			type Frame = GeneratorSSE<AnySuccess, "tick">;

			const value: Frame = {
				data: {} as AnySuccess,
				event: "tick",
				id: "1",
				retry: 1000,
			};

			expect(value.id).toBe("1");
			expect(value.retry).toBe(1000);
			expect(value.event).toBe("tick");
		});

		test("should mark only `data` as required on the parametrized form", () => {
			type Frame = GeneratorSSE<AnySuccess, "tick">;

			const check: ExtendsType<RequiredKeys<Frame>, "data"> = true;

			expect(check).toBe(true);
		});
	});

	describe("event channel parameter", () => {
		test('should default the event channel to `"message"`', () => {
			type Default = GeneratorSSE<AnySuccess>;
			type Explicit = GeneratorSSE<AnySuccess, "message">;

			const check: ExtendsType<Default, Explicit> = true;

			expect(check).toBe(true);
		});

		test("should make `event` optional regardless of the channel literal", () => {
			type Frame = GeneratorSSE<AnySuccess, "tick">;

			const value: Frame = { data: {} as AnySuccess };

			expect(value.event).toBeUndefined();
		});

		test("should narrow `event` to the channel literal plus `undefined`", () => {
			type Frame = GeneratorSSE<AnySuccess, "tick">;

			const check: ExtendsType<Frame["event"], "tick" | undefined> = true;

			expect(check).toBe(true);
		});

		test("should reject an `event` value outside the channel literal", () => {
			type Frame = GeneratorSSE<AnySuccess, "tick">;

			const check: AssignableTo<
				{ data: AnySuccess; event: "other" },
				Frame
			> = false;

			expect(check).toBe(false);
		});

		test("should accept either member when the channel is a string-literal union", () => {
			type Frame = GeneratorSSE<AnySuccess, "a" | "b">;

			const first: Frame = { data: {} as AnySuccess, event: "a" };
			const second: Frame = { data: {} as AnySuccess, event: "b" };

			expect(first.event).toBe("a");
			expect(second.event).toBe("b");
		});

		test("should accept any string when the channel is widened to `string`", () => {
			type Frame = GeneratorSSE<AnySuccess, string>;

			const value: Frame = {
				data: {} as AnySuccess,
				event: "arbitrary-name",
			};

			expect(value.event).toBe("arbitrary-name");
		});
	});

	describe("optional fields", () => {
		test("should not require `id` to be present", () => {
			type Frame = GeneratorSSE<AnySuccess>;

			const value: Frame = { data: {} as AnySuccess };

			expect(value.id).toBeUndefined();
		});

		test("should not require `retry` to be present", () => {
			type Frame = GeneratorSSE<AnySuccess>;

			const value: Frame = { data: {} as AnySuccess };

			expect(value.retry).toBeUndefined();
		});

		test("should type `id` as `string | undefined`", () => {
			type Frame = GeneratorSSE<AnySuccess>;

			const check: ExtendsType<Frame["id"], string | undefined> = true;

			expect(check).toBe(true);
		});

		test("should type `retry` as `number | undefined`", () => {
			type Frame = GeneratorSSE<AnySuccess>;

			const check: ExtendsType<Frame["retry"], number | undefined> = true;

			expect(check).toBe(true);
		});
	});

	describe("AnyGeneratorSSE", () => {
		test("should match a concrete frame regardless of data and event generics", () => {
			type Frame = GeneratorSSE<AnySuccess, "tick">;

			const value: AnyGeneratorSSE = {
				data: {} as AnySuccess,
				event: "tick",
			} satisfies Frame;

			expect(value.event).toBe("tick");
		});

		test("should accept frames whose `data` is `AnyError`", () => {
			const value: AnyGeneratorSSE = { data: {} as AnyError };

			expect(value).toBeDefined();
		});

		test("should keep `data` required even on the relaxed alias", () => {
			type HasDataKey = "data" extends keyof AnyGeneratorSSE
				? true
				: false;

			const check: ExtendsType<HasDataKey, true> = true;

			expect(check).toBe(true);
		});

		test("should accept any concrete `GeneratorSSE<X, Y>` as a subtype", () => {
			type Frame = GeneratorSSE<Success<{ ok: true }, 200>, "tick">;

			const check: AssignableTo<Frame, AnyGeneratorSSE> = true;

			expect(check).toBe(true);
		});

		test("should accept a `Success` subtype through `data` covariance", () => {
			type Specific = GeneratorSSE<Success<{ ok: true }, 200>>;
			type Generic = GeneratorSSE<AnySuccess>;

			const check: AssignableTo<Specific, Generic> = true;

			expect(check).toBe(true);
		});

		test("should accept any string for the `event` channel", () => {
			const value: AnyGeneratorSSE = {
				data: {} as AnySuccess,
				event: "anything",
			};

			expect(value.event).toBe("anything");
		});
	});
});
