import type { AnyFail, AnyOk } from "@/core/reply";

/**
 * Describe the shape of one frame yielded by a generator handler targeting `text/event-stream`.
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
 * Resolve to any {@link GeneratorSSE} regardless of its payload or event-name
 * type parameters.
 *
 * @example
 * ```typescript
 * type A = AnyGeneratorSSE;
 * // { data: any; event?: any; id?: string; retry?: number }
 * ```
 */
export type AnyGeneratorSSE = GeneratorSSE<any, any>;
