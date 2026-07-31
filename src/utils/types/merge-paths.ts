/**
 * Collapses runs of "/" into a single separator.
 */
type CollapseSlashes<Path extends string> =
	Path extends `${infer Head}//${infer Tail}`
		? CollapseSlashes<`${Head}/${Tail}`>
		: Path;

/**
 * Removes every trailing slash from a path body.
 */
type RemoveTrailingSlash<Path extends string> = Path extends `${infer Rest}/`
	? RemoveTrailingSlash<Rest>
	: Path;

/**
 * Removes every leading slash from a path body.
 */
type RemoveLeadingSlash<Path extends string> = Path extends `/${infer Rest}`
	? RemoveLeadingSlash<Rest>
	: Path;

/**
 * Normalizes a path type the way the router normalizes a request path.
 */
type NormalizeBody<Path extends `/${string}`> = Path extends `/${infer Body}`
	? RemoveTrailingSlash<CollapseSlashes<RemoveLeadingSlash<Body>>>
	: string;

/**
 * Rebuilds the leading "/" outside the conditional, so the result stays a
 * template literal type.
 */
type Normalize<Path extends `/${string}`> = `/${NormalizeBody<Path>}`;

/**
 * Joins normalized path types while retaining the root cases represented by
 * broad template literal types.
 */
type JoinNormalized<
	Prefix extends `/${string}`,
	Path extends `/${string}`,
> = Prefix extends "/"
	? Path
	: Path extends "/"
		? Prefix
		:
				| `${Prefix}${Path}`
				| ("/" extends Prefix ? Path : never)
				| ("/" extends Path ? Prefix : never);

/**
 * Joins prefix and path literals into a single path type.
 *
 * @example
 * ```typescript
 * type A = MergePaths<"/a", "/b">; // "/a/b"
 * type B = MergePaths<"/a/", "/b/">; // "/a/b"
 * type C = MergePaths<"/", "/b">; // "/b"
 * type D = MergePaths<"/a//", "//b">; // "/a/b"
 * ```
 */
export type MergePaths<
	Prefix extends `/${string}`,
	Path extends `/${string}`,
	// both sides distribute before being normalized: testing Normalize<...>
	// directly would compare the whole union against "/" and never take the
	// root branch for a union member
> = Prefix extends unknown
	? Path extends unknown
		? JoinNormalized<Normalize<Prefix>, Normalize<Path>>
		: never
	: never;
