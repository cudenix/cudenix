import { describe, expectTypeOf, it } from "bun:test";

import type { AnyFail, AnyOk, Ok } from "@/core/reply";
import type { AnySSEFrame, SSEFrame } from "@/utils/types/sse-frame";

describe("SSEFrame", () => {
	it("should default the event to 'message' and require only `data`", () => {
		expectTypeOf<SSEFrame<AnyOk>>().toEqualTypeOf<{
			data: AnyOk;
			event?: "message";
			id?: string;
			retry?: number;
		}>();
	});

	it("should type `data` and `event` from its parameters", () => {
		type A = SSEFrame<Ok<{ a: true }>, "v1">;

		expectTypeOf<A["data"]>().toEqualTypeOf<Ok<{ a: true }>>();
		expectTypeOf<A["event"]>().toEqualTypeOf<"v1" | undefined>();
	});

	it("should reject a `data` parameter that is not a reply", () => {
		// @ts-expect-error - `string` does not satisfy `AnyFail | AnyOk`
		type _A = SSEFrame<string>;
	});

	it("should reject an `Event` parameter that is not a string", () => {
		// @ts-expect-error - `number` does not satisfy `Event extends string`
		type _A = SSEFrame<AnyOk, number>;
	});
});

describe("AnySSEFrame", () => {
	it("should be the widest frame: any reply on any event", () => {
		expectTypeOf<AnySSEFrame>().toEqualTypeOf<
			SSEFrame<AnyFail | AnyOk, string>
		>();
	});
});
