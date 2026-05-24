/**
 * @module
 * WebSocket lifecycle callback descriptor.
 *
 * Use {@link WSData} as the return type of a `WS` route handler when you want
 * the framework to wire your callbacks into the underlying socket's lifecycle
 * events.
 */

/**
 * Bag of optional WebSocket lifecycle callbacks that a `WS` route returns to
 * register handlers for the underlying socket's lifecycle events.
 *
 * Reach for this as the return shape of a WebSocket route handler when the
 * route needs to react to events on the active connection. Each key matches a
 * named event the underlying server emits, and the framework forwards the
 * original event arguments to the matching callback you provide.
 *
 * The recognized events are:
 *
 * - `open` — fires once after the upgrade handshake completes. Receives the
 *   `ServerWebSocket` instance.
 * - `message` — fires for every inbound payload. Receives the
 *   `ServerWebSocket` and the raw payload.
 * - `drain` — fires when the send buffer empties, useful for backpressure
 *   recovery. Receives the `ServerWebSocket`.
 * - `close` — fires once when the connection is torn down. Receives the
 *   `ServerWebSocket`, the close code, and the close reason.
 *
 * Behavior worth knowing before you use it:
 *
 * - **All keys are optional** — omit any callback the route does not need and
 *   the framework will silently skip that event.
 * - **Whole bag is optional** — the type itself unions with `undefined`, so
 *   non-WebSocket routes (or WebSocket routes that opt out of lifecycle
 *   handling) can return nothing at all.
 * - **Loose callback signatures** — each entry is typed as
 *   `(...options: any[]) => any` so individual routes can declare the
 *   concrete parameter list they care about without fighting the union.
 * - **Event-keyed only** — keys outside `open`, `message`, `drain`, and
 *   `close` are rejected at the type level. Unknown events have nowhere to
 *   attach.
 *
 * @example
 * The full shape — a partial record of the four recognized events, or
 * `undefined` when the route opts out entirely.
 * ```typescript
 * type A = WSData;
 * // Partial<Record<"close" | "drain" | "message" | "open", (...options: any[]) => any>> | undefined
 * ```
 * @example
 * Each event slot is itself optional, so reading one off the non-null bag
 * still yields a `| undefined` callback.
 * ```typescript
 * type A = NonNullable<WSData>["open"];
 * // ((...options: any[]) => any) | undefined
 * ```
 * @example
 * The whole descriptor is assignable from `undefined`, which lets a route
 * skip WebSocket configuration without an explicit empty object.
 * ```typescript
 * type A = undefined extends WSData ? true : false; // true
 * ```
 */
export type WSData =
	| Partial<
			Record<
				"close" | "drain" | "message" | "open",
				(...options: any[]) => any
			>
	  >
	| undefined;
