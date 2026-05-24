/**
 * @module
 * Type-level route parameter extractor — read the named params out of a route
 * pattern and produce the dictionary type a handler would receive at runtime.
 *
 * Use {@link ExtractUrlParams} when you need to type a handler's `params`
 * argument, validate a route literal against the shape of its parameters, or
 * generate a typed accessor for any framework piece that consumes routes.
 */

/**
 * Resolve to the dictionary of named parameters declared by `Path`, mirroring
 * the segment vocabulary the runtime router understands.
 *
 * Reach for this whenever a route literal needs to be translated into the
 * shape of the params dictionary it produces — typing the `params` argument
 * of a handler, deriving a typed body for middleware that depends on route
 * keys, or constraining a generic so that callers can only reference
 * parameters that actually appear in the pattern. Because the parser mirrors
 * the runtime path matcher, the resulting type stays in sync with what
 * handlers will receive at request time.
 *
 * Recognized segment vocabulary:
 *
 * - `:name` — required named parameter, resolves to `string`.
 * - `:name?` — optional named parameter, resolves to `string | undefined`.
 * - `...name` — required rest parameter, resolves to `string[]`.
 * - `...name?` — optional rest parameter, resolves to `string[] | undefined`.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **Requires a string literal** — the parser walks `Path` through template
 *   literal inference, so passing the widened `string` type yields the empty
 *   accumulator. Keep the input literal (or `as const`) for it to make
 *   progress.
 * - **Empty paths resolve to an empty record** — `"/"`, `""`, and any path
 *   without parameter segments produce `{}`. The accumulator defaults to an
 *   empty record so paths that only contain literals always type-check.
 * - **Parameters accumulate left-to-right** — every `:name` and `...name`
 *   segment is merged into the result in declaration order, so a path that
 *   mixes several kinds yields one combined dictionary.
 * - **Optional and rest semantics compose** — the `?` suffix and the `...`
 *   prefix combine independently, so `...name?` yields a rest parameter that
 *   may be absent (`string[] | undefined`).
 * - **Bare `:` and `...` are accepted** — a segment like `/:` or `/...`
 *   produces an entry under the empty key `""` rather than rejecting the
 *   pattern. Mirrors the runtime matcher, which captures the segment without
 *   a name.
 * - **Leading and trailing slashes are tolerated** — the parser treats `/`
 *   as a separator, so `"a/:p1"`, `"/a/:p1"`, and `"/a/:p1/"` all extract
 *   the same `{ p1: string }`.
 * - **The accumulator is internal** — `Accumulated` exists to thread the
 *   merged result through the recursion. Do not pass it explicitly; always
 *   invoke `ExtractUrlParams` with a single type argument.
 *
 * @typeParam Path - Route pattern to parse. Must be a string literal type for
 *   the parser to walk it segment by segment.
 * @typeParam Accumulated - Internal accumulator threaded through recursive
 *   calls. Do not pass explicitly — it defaults to an empty record and is
 *   only exposed so the recursion can build the result incrementally.
 * @example
 * A `:name` segment becomes a required `string` entry in the dictionary.
 * ```typescript
 * type A = ExtractUrlParams<"/a/:p1">;
 * // { p1: string }
 *
 * type B = ExtractUrlParams<"/a/:p1/b/:p2">;
 * // { p1: string; p2: string }
 * ```
 * @example
 * Appending `?` to a named segment marks the entry as optional, widening
 * its value type to include `undefined`.
 * ```typescript
 * type A = ExtractUrlParams<"/a/:p1?">;
 * // { p1: string | undefined }
 *
 * type B = ExtractUrlParams<"/a/:p1?/b">;
 * // { p1: string | undefined }
 * ```
 * @example
 * A `...name` segment captures the tail of the path as a `string[]`, and the
 * `?` suffix makes the whole rest optional.
 * ```typescript
 * type A = ExtractUrlParams<"/a/...r1">;
 * // { r1: string[] }
 *
 * type B = ExtractUrlParams<"/a/...r1?">;
 * // { r1: string[] | undefined }
 * ```
 * @example
 * Required, optional, and rest segments accumulate into a single dictionary
 * in the order they appear in the pattern.
 * ```typescript
 * type A = ExtractUrlParams<"/a/:p1/b/:p2?/c/...r1">;
 * // { p1: string; p2: string | undefined; r1: string[] }
 * ```
 * @example
 * Paths with no parameter segments — including the root and empty path —
 * resolve to an empty record.
 * ```typescript
 * type A = ExtractUrlParams<"/">;
 * // {}
 *
 * type B = ExtractUrlParams<"/a/b/c">;
 * // {}
 * ```
 * @example
 * Bare `:` and `...` produce an entry under the empty key, matching the
 * runtime matcher's behavior for unnamed captures.
 * ```typescript
 * type A = ExtractUrlParams<"/:">;
 * // { "": string }
 *
 * type B = ExtractUrlParams<"/...?">;
 * // { "": string[] | undefined }
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
