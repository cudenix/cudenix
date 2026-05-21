/**
 * @module
 * WebSocket lifecycle handler descriptor.
 */

/**
 * Bag of WebSocket lifecycle callbacks that a route can attach when
 * upgrading a connection.
 *
 * Each key matches an event the underlying server emits on the active
 * socket:
 *
 * - `open` — fires once after the upgrade handshake completes.
 * - `message` — fires for every inbound payload.
 * - `drain` — fires when the send buffer empties, useful for backpressure.
 * - `close` — fires once when the connection is torn down.
 *
 * All keys are optional, so handlers can opt out of events they do not care
 * about by simply omitting them. The whole type is itself `| undefined` to
 * let routes omit WebSocket configuration entirely.
 *
 * @example
 * ```typescript
 * type A = WSData;
 * // Partial<Record<"open" | "message" | "drain" | "close", (...args: any[]) => any>> | undefined
 *
 * type B = NonNullable<WSData>["open"];
 * // ((...args: any[]) => any) | undefined
 *
 * type C = undefined extends WSData ? true : false; // true (entire bag is optional)
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
