/**
 * @module
 * Concatenate two route fragments at the type level, normalizing the slash
 * on the boundary.
 */

/**
 * Strip a single trailing `/` from `Type`, leaving `"/"` itself untouched.
 *
 * @typeParam Type - Path-shaped string literal to normalize.
 */
type RemoveTrailingSlash<Type extends string> = Type extends "/"
	? Type
	: Type extends `${infer WithoutTrailingSlash}/`
		? WithoutTrailingSlash
		: Type;

/**
 * Join `Prefix` and `Path` into a single literal type, normalizing the
 * boundary: a single trailing `/` is stripped from each operand, so the
 * child's leading `/` becomes the one separator. Both operands must start
 * with `/`; either may be the root path. Doubled slashes anywhere else
 * (`"/a//"`, `"//"`) are kept as written.
 *
 * Parameter, rest, and wildcard segments (`:name`, `...name`, `*`) pass
 * through unchanged. Unions distribute pairwise.
 *
 * @typeParam Prefix - Parent prefix. Must start with `/`.
 * @typeParam Path - Child path. Must start with `/`.
 * @example
 * ```typescript
 * type A = MergePaths<"/a", "/b">; // "/a/b"
 * type B = MergePaths<"/a/", "/b/">; // "/a/b"
 * type C = MergePaths<"/", "/b">; // "/b"
 * type D = MergePaths<"/a", "/b/:p1">; // "/a/b/:p1"
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
