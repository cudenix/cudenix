export type RequiredKeys<Type extends Record<PropertyKey, unknown>> = {
	[Key in keyof Type]-?: undefined extends Type[Key] ? never : Key;
}[keyof Type];
