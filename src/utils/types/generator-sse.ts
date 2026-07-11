import type { AnyFail, AnyOk } from "@/core/reply";

/**
 * Describes an SSE event yielded by a generator handler.
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
 * Represents a generator SSE event without type constraints.
 *
 * @example
 * ```typescript
 * type A = AnyGeneratorSSE;
 * // { data: any; event?: any; id?: string; retry?: number }
 * ```
 */
export type AnyGeneratorSSE = GeneratorSSE<any, any>;
