import type { NormalizePathSeparators } from "@/utils/types/normalize-path-separators";

export type MergePaths<
	Prefix extends `/${string}`,
	Path extends `/${string}`,
> = Prefix extends unknown
	? Path extends unknown
		? Prefix extends "/"
			? Normalize<Path>
			: Path extends "/"
				? Normalize<Prefix>
				: JoinNormalized<Normalize<Prefix>, Normalize<Path>>
		: never
	: never;

type CollapseSlashes<Path extends string> =
	Path extends `${infer Head}//${infer Tail}`
		? CollapseSlashes<`${Head}/${Tail}`>
		: Path;

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

type Normalize<Path extends `/${string}`> = `/${NormalizeBody<Path>}`;

type NormalizeBody<Path extends `/${string}`> = Path extends `/${infer Body}`
	? Body extends UnnormalizedBody
		? RemoveTrailingSlash<
				CollapseSlashes<
					RemoveLeadingSlash<NormalizePathSeparators<Body>>
				>
			>
		: Body
	: string;

type RemoveLeadingSlash<Path extends string> = Path extends `/${infer Rest}`
	? RemoveLeadingSlash<Rest>
	: Path;

type RemoveTrailingSlash<Path extends string> = Path extends `${infer Rest}/`
	? RemoveTrailingSlash<Rest>
	: Path;

type UnnormalizedBody =
	| `/${string}`
	| `${string}//${string}`
	| `${string}/`
	| `${string}\\${string}`;
