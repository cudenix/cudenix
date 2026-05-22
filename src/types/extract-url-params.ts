/**
 * @module
 * Type-level parser that derives the parameter dictionary from a route pattern.
 */

/**
 * Walk a route pattern at the type level and accumulate the named
 * parameters it declares.
 *
 * Recognizes the same segment vocabulary as the runtime `pathToRegexp`
 * helper:
 *
 * - `:name` — required string parameter.
 * - `:name?` — optional string parameter (`string | undefined`).
 * - `...name` — required rest parameter (`string[]`).
 * - `...name?` — optional rest parameter (`string[] | undefined`).
 *
 * Recursion proceeds through `${infer First}/${infer Rest}` template
 * splitting, threading an internal `Accumulated` record so each match merges
 * into the previous result. The base case handles the trailing segment
 * that has no separator. Always returns a value — the accumulator defaults
 * to an empty record, so paths with no parameters resolve to `{}`.
 *
 * @typeParam Path - Route pattern to parse. Must be a string literal type
 *   for the parser to make progress.
 * @typeParam Accumulated - Internal accumulator; do not pass explicitly.
 * @example
 * ```typescript
 * type A = ExtractUrlParams<"/a/:p1">;
 * // { p1: string }
 *
 * type B = ExtractUrlParams<"/a/:p1?/b">;
 * // { p1: string | undefined }
 *
 * type C = ExtractUrlParams<"/a/...r1">;
 * // { r1: string[] }
 *
 * type D = ExtractUrlParams<"/a">;
 * // {}
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
