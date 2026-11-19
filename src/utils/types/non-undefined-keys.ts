export type NonUndefinedKeys<T extends object> =
	NonUndefinedProperties<T>[keyof NonUndefinedProperties<T>];

type NonUndefinedProperties<T extends object> = {
	[K in keyof T as undefined extends T[K] ? never : K]-?: K;
};
