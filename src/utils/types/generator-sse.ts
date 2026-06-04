import type { AnyFail, AnyOk } from "@/core/reply";

/**
 * @module
 * Server-Sent Events frame shape for streaming handlers.
 */

/**
 * Shape of a single frame yielded by a generator handler that targets the
 * `text/event-stream` protocol. The framework serializes each yielded value
 * into the SSE wire format.
 *
 * Fields:
 *
 * - `data` — payload, restricted to {@link AnyFail} or {@link AnyOk} so
 *   the success/error discriminant survives the stream.
 * - `event` — channel name listeners receive on. Defaults to `"message"`.
 * - `id` — replayed in `Last-Event-ID` on reconnect; use it to mark resumable
 *   positions.
 * - `retry` — advised reconnect delay in milliseconds.
 *
 * @typeParam Data - Payload type carried by the frame.
 * @typeParam Event - Literal name of the event channel. Defaults to `"message"`.
 * @example
 * ```typescript
 * type A = GeneratorSSE<AnyOk>;
 * // { data: AnyOk; event?: "message"; id?: string; retry?: number }
 *
 * type B = GeneratorSSE<AnyFail, "v1">;
 * // { data: AnyFail; event?: "v1"; id?: string; retry?: number }
 * ```
 */
export interface GeneratorSSE<
	Data extends AnyFail | AnyOk,
	Event extends string = "message",
> {
	data: Data;
	event?: Event;
	id?: string;
	retry?: number;
}

/**
 * Parameter-free alias matching any {@link GeneratorSSE} regardless of payload
 * or event-name parameters. Use in container, registry, or boundary types
 * where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * type A = AnyGeneratorSSE;
 * // { data: any; event?: any; id?: string; retry?: number }
 * ```
 */
export type AnyGeneratorSSE = GeneratorSSE<any, any>;
