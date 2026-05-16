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
 * const ws: WSData = {
 *   open: () => console.log("connected"),
 *   message: (_, payload) => console.log("recv", payload),
 * };
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
