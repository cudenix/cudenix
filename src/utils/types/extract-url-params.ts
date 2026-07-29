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
 * Replaces the accumulated entry for a repeated parameter name.
 */
type Override<
	Accumulated extends Record<string, string | string[] | undefined>,
	Latest extends Record<string, string | string[] | undefined>,
> = Omit<Accumulated, keyof Latest> & Latest;

/**
 * Extracts named parameters from a route path type.
 *
 * @example
 * ```typescript
 * type A = ExtractUrlParams<"/a/:p1">; // { p1: string }
 *
 * type B = ExtractUrlParams<"/a/:p1?/b/...r1">;
 * // { p1: string | undefined; r1: string[] }
 *
 * type C = ExtractUrlParams<"/:p1/...p1">; // { p1: string[] }
 * ```
 */
export type ExtractUrlParams<
	Path extends string,
	// "| undefined" keeps the constraint satisfiable by this type's own output,
	// which emits optional params as "string | undefined"
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
