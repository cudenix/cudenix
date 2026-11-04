import type {
	RouteFnReturnGenerator,
	RouteFnReturnGeneratorEnvelope,
	RouteFnReturnGeneratorFrame,
} from "@/core/route";

const ENCODER = new TextEncoder();

const NEWLINES = /[\r\n]/g;

/**
 * Serializes an SSE frame.
 */
const chunk = (frame: RouteFnReturnGeneratorFrame): string => {
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
 * Streams serialized SSE frames from a route generator.
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
export const stream = (
	generator: RouteFnReturnGenerator,
): ReadableStream<Uint8Array> => {
	const iterator = generator as unknown as AsyncIterator<
		RouteFnReturnGeneratorFrame,
		RouteFnReturnGeneratorEnvelope | undefined
	>;
	// only an async generator steps through promises
	const isAsync = Symbol.asyncIterator in generator;

	return new ReadableStream<Uint8Array>({
		async cancel(): Promise<void> {
			try {
				await iterator.return?.();
			} catch {}
		},
		async pull(controller): Promise<void> {
			const stepped = iterator.next();
			const { done, value } = isAsync
				? await stepped
				: (stepped as unknown as Awaited<typeof stepped>);

			if (done === true) {
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
