import type { AnyFail, AnyOk } from "@/core/reply";

/**
 * @module
 * Server-Sent Events frame shape for streaming handlers.
 */

/**
 * Shape of one frame yielded by a generator handler targeting
 * `text/event-stream`. `data` is the payload; `event`, `id`, and `retry` are
 * the optional SSE fields.
 *
 * @example
 * ```typescript
 * type A = GeneratorSSE<AnyOk>;
 * // { data: AnyOk; event?: "message"; id?: string; retry?: number }
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
 * Any {@link GeneratorSSE} regardless of its payload or event-name type
 * parameters. Use it where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * type A = AnyGeneratorSSE;
 * // { data: any; event?: any; id?: string; retry?: number }
 * ```
 */
export type AnyGeneratorSSE = GeneratorSSE<any, any>;
