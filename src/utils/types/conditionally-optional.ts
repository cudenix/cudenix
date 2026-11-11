export type ConditionallyOptional<T extends object, U> = T extends unknown
	? T extends readonly unknown[]
		? T
		: keyof OptionalProperties<T, U> extends never
			? T
			: keyof UnchangedProperties<T, U> extends never
				? Partial<T>
				: OptionalProperties<T, U> & UnchangedProperties<T, U>
	: never;

type OptionalProperties<T extends object, U> = {
	[K in keyof T as U extends T[K] ? K : never]?: T[K];
};

type UnchangedProperties<T extends object, U> = {
	[
		K in keyof T as [U extends T[K] ? K : never] extends [never] ? K : never
	]: T[K];
};
