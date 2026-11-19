export type UndefinedToOptional<T extends object> = T extends unknown
	? T extends readonly unknown[]
		? T
		: keyof OptionalProperties<T> extends never
			? T
			: keyof UnchangedProperties<T> extends never
				? Partial<T>
				: OptionalProperties<T> & UnchangedProperties<T>
	: never;

type OptionalProperties<T extends object> = {
	[K in keyof T as undefined extends T[K] ? K : never]?: T[K];
};

type UnchangedProperties<T extends object> = {
	[K in keyof T as undefined extends T[K] ? never : K]: T[K];
};
