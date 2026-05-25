/**
 * @module
 * WebSocket lifecycle callback descriptor.
 */

/**
 * Return shape of a `WS` route handler. Each key registers a callback on the
 * underlying socket's lifecycle:
 *
 * - `open` — fires once after the upgrade handshake. Receives the
 *   `ServerWebSocket`.
 * - `message` — fires for every inbound payload. Receives the
 *   `ServerWebSocket` and the raw payload.
 * - `drain` — fires when the send buffer empties (backpressure recovery).
 * - `close` — fires once on tear-down. Receives the `ServerWebSocket`, close
 *   code, and reason.
 *
 * Every callback is optional and the whole descriptor unions with `undefined`,
 * so a non-WebSocket route (or one that opts out of lifecycle handling) can
 * return nothing.
 *
 * @example
 * ```typescript
 * const a: WSData = {
 *   open(socket) { socket.send("ready"); },
 *   message(socket, payload) { socket.send(payload); },
 * };
 *
 * const b: WSData = undefined; // route opts out of lifecycle handling
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
