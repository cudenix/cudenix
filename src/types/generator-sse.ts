import type { AnyError } from "@/core/error";
import type { AnySuccess } from "@/core/success";

/**
 * @module
 * Server-Sent Events frame type — describe the shape of values yielded by a
 * streaming handler generator that targets the `text/event-stream` protocol.
 *
 * Use {@link GeneratorSSE} when typing the values produced by a streaming
 * handler, or {@link AnyGeneratorSSE} when you need a parameter-free
 * reference to that shape in a container or registry type.
 */

/**
 * Resolve to the object shape of a single frame yielded by a streaming
 * handler that targets the `text/event-stream` protocol.
 *
 * Reach for this when typing a generator that streams responses to the
 * browser — the framework serializes every yielded value into the SSE wire
 * format, so the type you yield from the handler is the type the transport
 * layer hands off to the runtime. Because the payload side is constrained to
 * {@link AnyError} or {@link AnySuccess}, the success/error discriminant is
 * preserved through the stream and the transport metadata (status, headers)
 * flows downstream untouched.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **`data` carries the payload** — restricted to {@link AnyError} or
 *   {@link AnySuccess} so the framework can route the frame through the same
 *   response envelope used for unary handlers.
 * - **`event` names the channel** — the literal value listeners attached via
 *   `EventSource.addEventListener` receive on. Defaults to `"message"`,
 *   which is the implicit channel the browser uses when no `event:` field is
 *   sent.
 * - **`id` is replayed on reconnect** — the browser sends it back in the
 *   `Last-Event-ID` header after a dropped connection, so use it to mark
 *   resumable positions in a stream.
 * - **`retry` advises the reconnection delay** — value is interpreted in
 *   milliseconds. Leave it `undefined` to fall back to the browser default.
 * - **All fields except `data` are optional** — emit only the metadata the
 *   receiver cares about; absent fields are dropped from the serialized
 *   frame.
 * - **Literal types are preserved on `Event`** — passing a string literal
 *   keeps the channel name precise downstream instead of widening to the
 *   generic `string` type.
 *
 * @typeParam Data - Payload carried by the frame. Must extend
 *   {@link AnyError} or {@link AnySuccess} so the success/error discriminant
 *   is preserved through the stream.
 * @typeParam Event - Literal name of the event channel. Defaults to
 *   `"message"`, the implicit channel browsers listen on when no `event:`
 *   field is sent.
 * @example
 * Type a frame on the default channel — the `event` parameter falls back to
 * `"message"` and the field can be omitted at the call site.
 * ```typescript
 * type A = GeneratorSSE<AnySuccess>;
 * // { data: AnySuccess; event?: "message"; id?: string; retry?: number }
 * ```
 * @example
 * Pin the frame to a named channel so listeners that subscribe to that event
 * receive it instead of the default `message` stream.
 * ```typescript
 * type A = GeneratorSSE<AnySuccess, "v1">;
 * // { data: AnySuccess; event?: "v1"; id?: string; retry?: number }
 * ```
 * @example
 * Carry an error envelope on the stream — the success/error discriminant
 * survives the frame so downstream consumers can pattern-match on it.
 * ```typescript
 * type A = GeneratorSSE<AnyError, "v2">;
 * // { data: AnyError; event?: "v2"; id?: string; retry?: number }
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
 * Resolve to a shape that matches any {@link GeneratorSSE} regardless of its
 * payload or event-name parameters.
 *
 * Reach for this in container, registry, or boundary types where the
 * concrete generics are irrelevant — for example when typing a list of
 * frames coming back from several handlers, or when annotating an
 * intermediate slot that just needs to know "this is an SSE frame" so it can
 * pass it through without inspecting the discriminant.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **Both generics are widened to `any`** — payload and event name accept
 *   anything that fits the underlying constraints, so the alias is
 *   intentionally permissive and should not be used at handler boundaries
 *   where the concrete shape still matters.
 * - **Field optionality is preserved** — only `data` is required; the
 *   `event`, `id`, and `retry` keys remain optional just like on the
 *   parameterized form.
 * - **Pairs with the parameterized form** — reach for {@link GeneratorSSE}
 *   when you need to keep the payload and event-name types precise, and use
 *   `AnyGeneratorSSE` only when that precision is not needed.
 *
 * @example
 * Match any concrete frame, regardless of payload or event-name parameters.
 * ```typescript
 * type A = AnyGeneratorSSE;
 * // { data: any; event?: any; id?: string; retry?: number }
 * ```
 * @example
 * Use it as the element type of a list that collects frames from
 * heterogeneous handlers without forcing every entry to share a payload
 * shape.
 * ```typescript
 * type A = AnyGeneratorSSE[];
 * // array of frames with any payload and any event name
 * ```
 */
export type AnyGeneratorSSE = GeneratorSSE<any, any>;
