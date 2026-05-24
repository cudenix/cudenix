/**
 * @module
 * Type-level path joiner — concatenate a router prefix with a child path
 * while normalizing the slash that sits on the boundary between them.
 *
 * Use {@link MergePaths} when you need to compose two route fragments at
 * the type level — overlaying a group or module prefix onto a child route,
 * or building a literal type that has to line up byte-for-byte with the
 * URL the runtime router will see.
 */

/**
 * Strip a single trailing `/` from `Type`, leaving the root path itself
 * untouched.
 *
 * Internal helper used by {@link MergePaths} to keep joined results free of
 * accidental double slashes when either operand already carries a trailing
 * separator.
 *
 * @typeParam Type - Path-shaped string literal to normalize.
 */
type RemoveTrailingSlash<Type extends string> = Type extends "/"
	? Type
	: Type extends `${infer WithoutTrailingSlash}/`
		? WithoutTrailingSlash
		: Type;

/**
 * Resolve to the string literal produced by joining `Prefix` and `Path`,
 * collapsing the boundary slash so neither a missing nor a duplicated
 * separator can sneak into the result.
 *
 * Reach for this whenever you need to compose two route fragments at the
 * type level — mounting a group or module prefix on top of a child route,
 * normalizing user-supplied path inputs into a canonical form, or building
 * a literal type that has to match the URL the runtime router will see.
 * Because both sides are normalized the same way, `"/a"` + `"/b"` and
 * `"/a/"` + `"/b/"` collapse to the same `"/a/b"` — callers do not have to
 * remember which side was responsible for the slash.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **Both operands must start with `/`** — the constraint enforces this at
 *   the type level, so a fragment like `"users"` is rejected at compile
 *   time instead of silently producing a malformed path.
 * - **Either side may be the root** — `"/"` on the `Prefix` side returns
 *   `Path` (normalized), `"/"` on the `Path` side returns `Prefix`
 *   (normalized), and `MergePaths<"/", "/">` resolves to `"/"`.
 * - **Trailing slashes are stripped before joining** — a single trailing
 *   `/` on either operand is dropped, so the result never carries an
 *   accidental double slash or a stray separator at the end.
 * - **Only one trailing slash is stripped** — a path like `"/a//"` keeps
 *   the inner `/`. The helper normalizes the boundary, it does not clean
 *   the whole input.
 * - **Parameter, rest, and wildcard syntax passes through** — `:name`,
 *   `...name`, and `*` segments are treated as ordinary characters, so
 *   router patterns compose without losing their special tokens.
 * - **Distributes over unions** — when either operand is a union of path
 *   literals, the result is the union of each pairwise join.
 * - **Literal types are preserved** — the result is a string-literal type,
 *   not the widened `string`, so it remains usable downstream as a key,
 *   discriminator, or template-literal input.
 *
 * @typeParam Prefix - Parent prefix to mount the child path under. Must be
 *   a string literal that starts with `/`.
 * @typeParam Path - Child path appended to `Prefix`. Must be a string
 *   literal that starts with `/`.
 * @example
 * Join a group prefix with a child route — the boundary slash is collapsed
 * to a single separator.
 * ```typescript
 * type A = MergePaths<"/a", "/b">;
 * // "/a/b"
 *
 * type B = MergePaths<"/a/b", "/c/d">;
 * // "/a/b/c/d"
 * ```
 * @example
 * Either operand can be the root path, in which case the other side wins
 * with its trailing slash normalized away.
 * ```typescript
 * type A = MergePaths<"/", "/b">;
 * // "/b"
 *
 * type B = MergePaths<"/a", "/">;
 * // "/a"
 *
 * type C = MergePaths<"/", "/">;
 * // "/"
 * ```
 * @example
 * Trailing slashes on either operand are stripped before joining, so the
 * result is the same regardless of which side carried the separator.
 * ```typescript
 * type A = MergePaths<"/a/", "/b">;
 * // "/a/b"
 *
 * type B = MergePaths<"/a", "/b/">;
 * // "/a/b"
 *
 * type C = MergePaths<"/a/", "/b/">;
 * // "/a/b"
 * ```
 * @example
 * Parameter and rest segments pass through unchanged, so router patterns
 * compose cleanly into longer routes.
 * ```typescript
 * type A = MergePaths<"/a", "/b/:p1">;
 * // "/a/b/:p1"
 *
 * type B = MergePaths<"/a", "/...r1">;
 * // "/a/...r1"
 * ```
 * @example
 * A union on either side distributes across the join, producing the union
 * of every pairwise combination.
 * ```typescript
 * type A = MergePaths<"/a" | "/b", "/c">;
 * // "/a/c" | "/b/c"
 *
 * type B = MergePaths<"/a", "/b" | "/c">;
 * // "/a/b" | "/a/c"
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
