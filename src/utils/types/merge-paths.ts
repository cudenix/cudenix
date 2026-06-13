/**
 * @module
 * Concatenate two route fragments at the type level, normalizing the slash
 * on the boundary.
 */

/**
 * Strip a single trailing `/` from `Type`, leaving `"/"` itself untouched.
 */
type RemoveTrailingSlash<Type extends string> = Type extends "/"
	? Type
	: Type extends `${infer WithoutTrailingSlash}/`
		? WithoutTrailingSlash
		: Type;

/**
 * Join `Prefix` and `Path` into one path literal, collapsing the slash on the
 * boundary so there is exactly one separator between them. Both must start
 * with `/`.
 *
 * @example
 * ```typescript
 * type A = MergePaths<"/a", "/b">; // "/a/b"
 * type B = MergePaths<"/a/", "/b/">; // "/a/b"
 * type C = MergePaths<"/", "/b">; // "/b"
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
