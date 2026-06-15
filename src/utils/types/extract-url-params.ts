/**
 * Resolve to a dictionary of the named parameters declared by the route
 * literal `Path`, used to type a handler's `params`. `Path` must be a string
 * literal.
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
		? ExtractUrlParams<
				Rest,
				Accumulated &
					Record<
						Param extends `${infer Name}?` ? Name : Param,
						First extends `...${string}`
							? Param extends `${string}?`
								? string[] | undefined
								: string[]
							: Param extends `${string}?`
								? string | undefined
								: string
					>
			>
		: ExtractUrlParams<Rest, Accumulated>
	: Path extends `:${infer Param}` | `...${infer Param}`
		? Accumulated &
				Record<
					Param extends `${infer Name}?` ? Name : Param,
					Path extends `...${string}`
						? Param extends `${string}?`
							? string[] | undefined
							: string[]
						: Param extends `${string}?`
							? string | undefined
							: string
				>
		: Accumulated;
