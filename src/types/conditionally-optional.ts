type OptionalKeys<
	Type extends Record<PropertyKey, unknown>,
	OptionalType,
> = keyof {
	[Key in keyof Type as OptionalType extends Type[Key]
		? Key
		: never]: Type[Key];
};

export type ConditionallyOptional<
	Type extends Record<PropertyKey, unknown>,
	OptionalType,
> = Omit<Type, OptionalKeys<Type, OptionalType>> &
	Partial<Pick<Type, OptionalKeys<Type, OptionalType>>>;
