/**
 * Maps a `:param` or `...rest` segment to its parameter record.
 */
type ParamRecord<
	Segment extends string,
	Param extends string,
> = Param extends `${infer Name}?`
	? {
			[Key in Name]?:
				| (Segment extends `...${string}` ? string[] : string)
				| undefined;
		}
	: Record<Param, Segment extends `...${string}` ? string[] : string>;

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
 * // { p1?: string | undefined; r1: string[] }
 *
 * type C = ExtractUrlParams<"/:p1/...p1">; // { p1: string[] }
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
