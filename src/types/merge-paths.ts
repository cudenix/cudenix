type RemoveTrailingSlash<Type extends string> = Type extends "/"
	? Type
	: Type extends `${infer WithoutTrailingSlash}/`
		? WithoutTrailingSlash
		: Type;

export type MergePaths<
	Prefix extends `/${string}`,
	Path extends `/${string}`,
> = Prefix extends "/"
	? RemoveTrailingSlash<Path>
	: Path extends "/"
		? RemoveTrailingSlash<Prefix>
		: `${RemoveTrailingSlash<Prefix>}${RemoveTrailingSlash<Path>}`;
