/**
 * Maps a `:param` or `...rest` segment to its parameter record.
 */
type ParamRecord<Segment extends string, Param extends string> = Record<
	Param extends `${infer Name}?` ? Name : Param,
	Segment extends `...${string}`
		? Param extends `${string}?`
			? string[] | undefined
			: string[]
		: Param extends `${string}?`
			? string | undefined
			: string
>;

/**
 * Extracts named parameters from a route path type.
 *
 * @example
 * ```typescript
 * type A = ExtractUrlParams<"/a/:p1">; // { p1: string }
 *
 * type B = ExtractUrlParams<"/a/:p1?/b/...r1">;
 * // { p1: string | undefined; r1: string[] }
 * ```
 */
export type ExtractUrlParams<
	Path extends string,
	Accumulated extends Record<
		string,
		string | string[]
	> = NonNullable<unknown>,
> = Path extends `${infer First}/${infer Rest}`
	? First extends `:${infer Param}` | `...${infer Param}`
		? ExtractUrlParams<Rest, Accumulated & ParamRecord<First, Param>>
		: ExtractUrlParams<Rest, Accumulated>
	: Path extends `:${infer Param}` | `...${infer Param}`
		? Accumulated & ParamRecord<Path, Param>
		: Accumulated;
