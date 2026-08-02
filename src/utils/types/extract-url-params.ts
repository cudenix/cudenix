import type { Prettify } from "@/utils/types/prettify";

/**
 * Maps a route segment to its decoded value type.
 */
type ParamValue<Segment extends string> = Segment extends `...${string}`
	? [string, ...string[]]
	: string;

/**
 * Applies the latest capture for a repeated parameter name.
 */
type Override<
	Accumulated extends object,
	Segment extends string,
	Param extends string,
> = Accumulated extends unknown
	? Param extends `${infer Name}?`
		? Name extends keyof Accumulated
			? Prettify<
					{
						[K in keyof Accumulated as K]: K extends Name
							? Accumulated[K] | ParamValue<Segment>
							: Accumulated[K];
					} & NonNullable<unknown>
				>
			: Prettify<
					Accumulated & {
						[Key in Name]?: ParamValue<Segment> | undefined;
					}
				>
		: Prettify<
				{
					[K in keyof Accumulated as K extends Param
						? never
						: K]: Accumulated[K];
				} & Record<Param, ParamValue<Segment>>
			>
	: never;

/**
 * Walks the path without rechecking the accumulator constraint.
 */
type ExtractUrlParamsInternal<
	Path extends string,
	Accumulated extends object,
> = Path extends `${infer First}/${infer Rest}`
	? First extends `:${infer Param}` | `...${infer Param}`
		? ExtractUrlParamsInternal<Rest, Override<Accumulated, First, Param>>
		: ExtractUrlParamsInternal<Rest, Accumulated>
	: Path extends `:${infer Param}` | `...${infer Param}`
		? Override<Accumulated, Path, Param>
		: Accumulated;

/**
 * Extracts named parameters from a route path type.
 *
 * @example
 * ```typescript
 * type A = ExtractUrlParams<"/a/:p1">; // { p1: string }
 *
 * type B = ExtractUrlParams<"/a/:p1?/b/...r1">;
 * // { p1?: string | undefined; r1: [string, ...string[]] }
 *
 * type C = ExtractUrlParams<"/:p1/...p1">;
 * // { p1: [string, ...string[]] }
 * ```
 */
export type ExtractUrlParams<
	Path extends string,
	// "| undefined" covers optional properties
	Accumulated extends Record<
		string,
		string | string[] | undefined
	> = NonNullable<unknown>,
	// skip the segment walk when the path carries no capture marker
> = Path extends `${string}:${string}` | `${string}...${string}`
	? ExtractUrlParamsInternal<Path, Accumulated>
	: Accumulated;
