import { describe, expect, test } from "bun:test";

import type { AnyError, Error } from "@/core/error";
import type { AnySuccess, Success } from "@/core/success";
import type { ExtendsType } from "@/types/extends-type";
import type { AnyGeneratorSSE, GeneratorSSE } from "@/types/generator-sse";

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
	});
});
