type ParamType<
	Param extends string,
	Type extends string | string[],
> = Param extends `${string}?` ? Type | undefined : Type;

type ParamEntry<Param extends string, Type extends string | string[]> = {
	[Key in Param extends `${infer Name}?` ? Name : Param]: ParamType<
		Param,
		Type
	>;
};

export type ExtractUrlParams<
	Path extends string,
	Accumulated extends Record<
		string,
		string | string[]
	> = NonNullable<unknown>,
> = Path extends `${infer First}/${infer Rest}`
	? First extends
			| `:${infer Param}`
			| `...${
					// biome-ignore lint/suspicious/noRedeclare: Infer Param
					infer Param
			  }`
		? ExtractUrlParams<
				Rest,
				Accumulated &
					ParamEntry<
						Param,
						First extends `...${string}` ? string[] : string
					>
			>
		: ExtractUrlParams<Rest, Accumulated>
	: Path extends
				| `:${infer Param}`
				| `...${
						// biome-ignore lint/suspicious/noRedeclare: Infer Param
						infer Param
				  }`
		? Accumulated &
				ParamEntry<
					Param,
					Path extends `...${string}` ? string[] : string
				>
		: Accumulated;
