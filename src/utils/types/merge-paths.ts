import type { NormalizePathSeparators } from "@/utils/types/normalize-path-separators";

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
	// both sides distribute before being normalized
> = Prefix extends unknown
	? Path extends unknown
		? Prefix extends "/"
			? Normalize<Path>
			: Path extends "/"
				? Normalize<Prefix>
				: JoinNormalized<Normalize<Prefix>, Normalize<Path>>
		: never
	: never;

/**
 * Collapses runs of "/" into a single separator.
 */
type CollapseSlashes<Path extends string> =
	Path extends `${infer Head}//${infer Tail}`
		? CollapseSlashes<`${Head}/${Tail}`>
		: Path;

/**
 * Joins two normalized path types.
 */
type JoinNormalized<
	Prefix extends `/${string}`,
	Path extends `/${string}`,
> = Prefix extends "/"
	? Path
	: Path extends "/"
		? Prefix
		:
				| ("/" extends Path ? Prefix : never)
				| ("/" extends Prefix ? Path : never)
				| `${Prefix}${Path}`;

/**
 * Rebuilds the leading "/".
 */
type Normalize<Path extends `/${string}`> = `/${NormalizeBody<Path>}`;

/**
 * Normalizes a path body.
 */
type NormalizeBody<Path extends `/${string}`> = Path extends `/${infer Body}`
	? // skip the passes for a body that is already normalized
		Body extends UnnormalizedBody
		? RemoveTrailingSlash<
				CollapseSlashes<
					RemoveLeadingSlash<NormalizePathSeparators<Body>>
				>
			>
		: Body
	: string;

/**
 * Removes every leading slash from a path body.
 */
type RemoveLeadingSlash<Path extends string> = Path extends `/${infer Rest}`
	? RemoveLeadingSlash<Rest>
	: Path;

/**
 * Removes every trailing slash from a path body.
 */
type RemoveTrailingSlash<Path extends string> = Path extends `${infer Rest}/`
	? RemoveTrailingSlash<Rest>
	: Path;

/**
 * Matches a path body that still needs a normalization pass.
 */
type UnnormalizedBody =
	| `/${string}`
	| `${string}//${string}`
	| `${string}/`
	| `${string}\\${string}`;
