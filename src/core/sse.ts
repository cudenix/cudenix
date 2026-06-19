import type {
	RouteFnReturnGenerator,
	RouteFnReturnGeneratorEnvelope,
	RouteFnReturnGeneratorFrame,
} from "@/core/route";

const ENCODER = new TextEncoder();

const NEWLINES = /[\r\n]/g;

/**
 * Serialize one {@link RouteFnReturnGeneratorFrame} into a single
 * `text/event-stream` event. `id`, `event`, and `retry` each become their own
 * field — `event` is dropped for the default `"message"` channel so the browser
 * dispatches the frame to `onmessage` — and the reply envelope's `content` is
 * JSON-encoded onto the `data` field, terminated by the blank line that ends an
 * event. A `content` of `undefined` is encoded as `null` so the client's
 * `JSON.parse` always has a value to read.
 *
 * `id` and `event` are stripped of `\r` and `\n` first: those characters
 * delimit fields on the wire, so a dynamic value carrying one would otherwise
 * inject extra (or fake `data`) fields and corrupt the stream. `data` needs no
 * such guard — `JSON.stringify` always escapes newlines — and `retry` is a
 * number.
 *
 * @example
 * ```typescript
 * chunk({ data: ok({ a: "v1" }), event: "tick", id: "1" });
 * // 'id: 1\nevent: tick\ndata: {"a":"v1"}\n\n'
 * ```
 */
const chunk = (frame: RouteFnReturnGeneratorFrame) => {
	let fields = "";

	if (frame.id !== undefined) {
		fields += `id: ${frame.id.replace(NEWLINES, "")}\n`;
	}

	if (frame.event !== undefined && frame.event !== "message") {
		fields += `event: ${frame.event.replace(NEWLINES, "")}\n`;
	}

	if (frame.retry !== undefined) {
		fields += `retry: ${frame.retry}\n`;
	}

	const data = JSON.stringify(frame.data?.content);

	return `${fields}data: ${data === undefined ? "null" : data}\n\n`;
};

/**
 * Adapt a route's {@link RouteFnReturnGenerator} into a `ReadableStream` of
 * encoded `text/event-stream` events — the body {@link materialize} wraps as an
 * SSE response. Each yielded frame becomes one event via {@link chunk}, and a
 * final `return`ed envelope, if any, is emitted as a trailing default-channel
 * event. The stream pulls lazily — one `next()` per consumer read, so a slow
 * generator never buffers ahead — and when the client disconnects Bun cancels
 * it, which `return`s the generator so its `finally` blocks release resources.
 * A throw from that cleanup is swallowed: the client is already gone, so there
 * is nothing actionable to do, and letting `cancel` reject would surface as an
 * unhandled rejection.
 *
 * @example
 * ```typescript
 * const a = stream(
 *   (async function* () {
 *     yield { data: ok("frame1") };
 *
 *     return ok("final");
 *   })(),
 * );
 *
 * a instanceof ReadableStream; // true
 * ```
 */
export const stream = (generator: RouteFnReturnGenerator) => {
	const iterator = generator as unknown as AsyncIterator<
		RouteFnReturnGeneratorFrame,
		RouteFnReturnGeneratorEnvelope | undefined
	>;

	return new ReadableStream<Uint8Array>({
		async cancel() {
			try {
				await iterator.return?.();
			} catch {}
		},
		async pull(controller) {
			const { done, value } = await iterator.next();

			if (done) {
				if (value) {
					controller.enqueue(ENCODER.encode(chunk({ data: value })));
				}

				controller.close();

				return;
			}

			controller.enqueue(ENCODER.encode(chunk(value)));
		},
	});
};
