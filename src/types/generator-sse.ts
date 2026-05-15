import type { AnyError } from "@/core/error";
import type { AnySuccess } from "@/core/success";

/**
 * @module
 * Server-Sent Events frame produced by handler generators.
 */

/**
 * Single frame yielded by a streaming handler that targets the
 * `text/event-stream` protocol.
 *
 * The shape mirrors the
 * [SSE specification](https://html.spec.whatwg.org/multipage/server-sent-events.html):
 *
 * - `data` carries the payload, restricted to the framework's `AnyError` /
 *   `AnySuccess` envelopes so transport metadata flows downstream untouched.
 * - `event` names the channel listeners on `EventSource.addEventListener`
 *   will receive on.
 * - `id` becomes the value the browser replays via the `Last-Event-ID`
 *   header after a reconnect.
 * - `retry` advises the reconnection delay, in milliseconds.
 *
 * @typeParam Data - Payload type. Must extend `AnyError` or `AnySuccess` so
 *   the success/error discriminant is preserved through the stream.
 * @typeParam Event - Literal name of the event channel. Defaults to
 *   `"message"`, the implicit channel when no `event:` field is sent.
 * @example
 * ```typescript
 * function* stream(): Generator<GeneratorSSE<AnySuccess, "tick">> {
 *   yield { data: new Success({ time: Date.now() }), event: "tick" };
 * }
 * ```
 */
export interface GeneratorSSE<
	Data extends AnyError | AnySuccess,
	Event extends string = "message",
> {
	data: Data;
	event?: Event;
	id?: string;
	retry?: number;
}

/**
 * Convenience alias matching any {@link GeneratorSSE} regardless of payload
 * or event-name parameters.
 *
 * Reach for it in container or registry types where the concrete generics
 * are irrelevant — for example, when mapping over a list of frames produced
 * by several handlers.
 */
export type AnyGeneratorSSE = GeneratorSSE<any, any>;
