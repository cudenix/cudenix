export type ConditionallyOptional<
	Type extends Record<PropertyKey, unknown>,
	OptionalType,
> = {
	[Key in keyof Type]: OptionalType extends Type[Key] ? Key : never;
}[keyof Type] extends infer OptionalKey extends keyof Type
	? Omit<Type, OptionalKey> & { [Key in OptionalKey]?: Type[Key] }
	: never;
