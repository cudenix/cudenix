import type { OptionalKeys } from "@/utils/types/optional-keys";
import type { Prettify } from "@/utils/types/prettify";

/**
 * Maps a route segment to its decoded value type.
 */
type ParamValue<Segment extends string> = Segment extends `...${string}`
	? [string, ...string[]]
	: string;

/**
 * Maps a `:param` or `...rest` segment to its parameter record.
 */
type ParamRecord<
	Segment extends string,
	Param extends string,
> = Param extends `${infer Name}?`
	? {
			[Key in Name]?: ParamValue<Segment> | undefined;
		}
	: Record<Param, ParamValue<Segment>>;

/**
 * Applies the latest capture for a repeated parameter name. A required capture
 * always replaces the previous value; an optional capture preserves the
 * previous value when absent and overwrites it when present.
 */
type Override<
	Accumulated extends Record<string, string | string[] | undefined>,
	Latest extends Record<string, string | string[] | undefined>,
> = Prettify<
	{
		[K in keyof Accumulated as K extends Exclude<
			keyof Latest,
			OptionalKeys<Latest>
		>
			? never
			: K]: K extends keyof Latest
			? Accumulated[K] | Exclude<Latest[K], undefined>
			: Accumulated[K];
	} & {
		[K in keyof Latest as K extends OptionalKeys<Latest>
			? K extends keyof Accumulated
				? never
				: K
			: K]: Latest[K];
	}
>;

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
	// "| undefined" keeps the constraint satisfiable by optional properties,
	// whose indexed value type includes undefined
	Accumulated extends Record<
		string,
		string | string[] | undefined
	> = NonNullable<unknown>,
> = Path extends `${infer First}/${infer Rest}`
	? First extends `:${infer Param}` | `...${infer Param}`
		? ExtractUrlParams<
				Rest,
				Override<Accumulated, ParamRecord<First, Param>>
			>
		: ExtractUrlParams<Rest, Accumulated>
	: Path extends `:${infer Param}` | `...${infer Param}`
		? Override<Accumulated, ParamRecord<Path, Param>>
		: Accumulated;
