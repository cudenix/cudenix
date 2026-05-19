import { beforeAll, describe, expect, test } from "bun:test";

import type { AnyError, Error } from "@/core/error";
import type { AnySuccess, Success } from "@/core/success";
import type { AssignableTo } from "@/types/assignable-to";
import type { ExtendsType } from "@/types/extends-type";
import type { AnyGeneratorSSE, GeneratorSSE } from "@/types/generator-sse";
import type { RequiredKeys } from "@/types/required-keys";

describe("GeneratorSSE", () => {
	describe("minimal frame", () => {
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
	});

	describe("`data` payload typing", () => {
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

		describe("with `data` as an `AnyError | AnySuccess` union", () => {
			type Frame = GeneratorSSE<AnyError | AnySuccess>;

			test("should accept a frame whose `data` is `AnySuccess`", () => {
				const value: Frame = { data: {} as AnySuccess };

				expect(value.data).toBeDefined();
			});

			test("should accept a frame whose `data` is `AnyError`", () => {
				const value: Frame = { data: {} as AnyError };

				expect(value.data).toBeDefined();
			});
		});
	});

	describe("`event` channel parameter", () => {
		test('should default the channel literal to `"message"`', () => {
			type Default = GeneratorSSE<AnySuccess>;
			type Explicit = GeneratorSSE<AnySuccess, "message">;

			const check: ExtendsType<Default, Explicit> = true;

			expect(check).toBe(true);
		});

		describe("with channel literal 'tick'", () => {
			type Frame = GeneratorSSE<AnySuccess, "tick">;

			test("should make `event` optional", () => {
				const value: Frame = { data: {} as AnySuccess };

				expect(value.event).toBeUndefined();
			});

			test("should narrow `event` to the channel literal plus `undefined`", () => {
				const check: ExtendsType<Frame["event"], "tick" | undefined> =
					true;

				expect(check).toBe(true);
			});

			test("should reject an `event` value outside the channel literal", () => {
				const check: AssignableTo<
					{ data: AnySuccess; event: "other" },
					Frame
				> = false;

				expect(check).toBe(false);
			});
		});

		describe("with channel union 'a' | 'b'", () => {
			type Frame = GeneratorSSE<AnySuccess, "a" | "b">;

			test("should accept the 'a' member as `event`", () => {
				const value: Frame = { data: {} as AnySuccess, event: "a" };

				expect(value.event).toBe("a");
			});

			test("should accept the 'b' member as `event`", () => {
				const value: Frame = { data: {} as AnySuccess, event: "b" };

				expect(value.event).toBe("b");
			});
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

	describe("`id` optional field", () => {
		type Frame = GeneratorSSE<AnySuccess>;

		test("should not require `id` to be present", () => {
			const value: Frame = { data: {} as AnySuccess };

			expect(value.id).toBeUndefined();
		});

		test("should type `id` as `string | undefined`", () => {
			const check: ExtendsType<Frame["id"], string | undefined> = true;

			expect(check).toBe(true);
		});
	});

	describe("`retry` optional field", () => {
		type Frame = GeneratorSSE<AnySuccess>;

		test("should not require `retry` to be present", () => {
			const value: Frame = { data: {} as AnySuccess };

			expect(value.retry).toBeUndefined();
		});

		test("should type `retry` as `number | undefined`", () => {
			const check: ExtendsType<Frame["retry"], number | undefined> = true;

			expect(check).toBe(true);
		});
	});

	describe("required keys contract", () => {
		test("should mark only `data` as required on the parametrized form", () => {
			type Frame = GeneratorSSE<AnySuccess, "tick">;

			const check: ExtendsType<RequiredKeys<Frame>, "data"> = true;

			expect(check).toBe(true);
		});
	});

	describe("complete frame with every optional field", () => {
		type Frame = GeneratorSSE<AnySuccess, "tick">;

		let value: Frame;

		beforeAll(() => {
			value = {
				data: {} as AnySuccess,
				event: "tick",
				id: "1",
				retry: 1000,
			};
		});

		test("should preserve `event` set to the channel literal", () => {
			expect(value.event).toBe("tick");
		});

		test("should preserve `id`", () => {
			expect(value.id).toBe("1");
		});

		test("should preserve `retry`", () => {
			expect(value.retry).toBe(1000);
		});
	});

	describe("AnyGeneratorSSE", () => {
		test("should keep `data` required even on the relaxed alias", () => {
			type HasDataKey = "data" extends keyof AnyGeneratorSSE
				? true
				: false;

			const check: ExtendsType<HasDataKey, true> = true;

			expect(check).toBe(true);
		});

		test("should accept a frame whose `data` is `AnyError`", () => {
			const value: AnyGeneratorSSE = { data: {} as AnyError };

			expect(value).toBeDefined();
		});

		test("should accept any string for the `event` channel", () => {
			const value: AnyGeneratorSSE = {
				data: {} as AnySuccess,
				event: "anything",
			};

			expect(value.event).toBe("anything");
		});

		test("should accept a concrete frame regardless of `data` and `event` generics", () => {
			type Frame = GeneratorSSE<AnySuccess, "tick">;

			const value: AnyGeneratorSSE = {
				data: {} as AnySuccess,
				event: "tick",
			} satisfies Frame;

			expect(value.event).toBe("tick");
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
	});
});
