/**
 * @module
 * Type-level route parameter extractor — read named params out of a route
 * pattern.
 */

/**
 * Dictionary of named parameters declared by `Path`, mirroring the segment
 * vocabulary the runtime router understands. Use it to type a handler's
 * `params` argument from a route literal.
 *
 * Segment vocabulary:
 *
 * - `:name` — required, resolves to `string`.
 * - `:name?` — optional, resolves to `string | undefined`.
 * - `...name` — required rest, resolves to `string[]`.
 * - `...name?` — optional rest, resolves to `string[] | undefined`.
 *
 * `Path` must be a string literal (or `as const`) for the parser to walk it
 * segment by segment — the widened `string` type yields the empty record.
 * Bare `:` and `...` produce an entry under the empty key `""`, matching the
 * runtime matcher's unnamed-capture behavior. The non-capturing `*` wildcard
 * contributes no entry. A union of path literals distributes, yielding a
 * union of dictionaries.
 *
 * @typeParam Path - Route pattern to parse. Must be a string literal.
 * @typeParam Accumulated - Internal accumulator. Do not pass explicitly.
 * @example
 * ```typescript
 * type A = ExtractUrlParams<"/a/:p1">; // { p1: string }
 *
 * type B = ExtractUrlParams<"/a/:p1?/b/...r1">;
 * // { p1: string | undefined; r1: string[] }
 *
 * type C = ExtractUrlParams<"/a/b/c">; // {}
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
