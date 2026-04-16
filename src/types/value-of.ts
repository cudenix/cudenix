export type ValueOf<Type extends Record<PropertyKey, unknown>> =
	Type[keyof Type];
