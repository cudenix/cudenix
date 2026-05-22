/**
 * @module
 * Type-level concatenation of route prefixes and paths.
 */

/**
 * Strip a single trailing `/` from `Type`, unless the input is the root path
 * itself.
 *
 * Internal helper used by {@link MergePaths} to keep joined results free of
 * accidental double slashes when either side carries a trailing separator.
 *
 * @typeParam Type - Path-shaped string literal to normalize.
 */
type RemoveTrailingSlash<Type extends string> = Type extends "/"
	? Type
	: Type extends `${infer WithoutTrailingSlash}/`
		? WithoutTrailingSlash
		: Type;

/**
 * Concatenate a router `Prefix` with a child `Path`, treating either side as
 * the root when it is exactly `"/"`.
 *
 * Both operands must already begin with `/`. Trailing slashes are stripped
 * from each side before joining so `"/api"` + `"/users"` and `"/api/"` +
 * `"/users/"` both resolve to `"/api/users"`.
 *
 * @typeParam Prefix - Parent prefix (e.g. `"/a"`).
 * @typeParam Path - Child path (e.g. `"/a/:p1"`).
 * @example
 * ```typescript
 * type A = MergePaths<"/a", "/b">;     // "/a/b"
 * type B = MergePaths<"/", "/b">;      // "/b"
 * type C = MergePaths<"/a", "/">;      // "/a"
 * type D = MergePaths<"/a/", "/b/">;   // "/a/b"
 * ```
 */
export type MergePaths<
	Prefix extends `/${string}`,
	Path extends `/${string}`,
> = Prefix extends "/"
	? RemoveTrailingSlash<Path>
	: Path extends "/"
		? RemoveTrailingSlash<Prefix>
		: `${RemoveTrailingSlash<Prefix>}${RemoveTrailingSlash<Path>}`;
