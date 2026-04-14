export type ConditionallyOptional<Type extends Record<PropertyKey, unknown>, OptionalType> = {
	[Key in keyof Type as OptionalType extends Type[Key] ? never : Key]: Type[Key];
} & {
	[Key in keyof Type as OptionalType extends Type[Key] ? Key : never]?: Type[Key];
};
