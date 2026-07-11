/**
 * Normalizes a path type by removing its trailing slash.
 */
type RemoveTrailingSlash<Type extends string> = Type extends "/"
	? Type
	: Type extends `${infer WithoutTrailingSlash}/`
		? WithoutTrailingSlash
		: Type;

/**
 * Joins prefix and path literals into a single path type.
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
