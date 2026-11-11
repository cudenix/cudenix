export type RequiredKeys<T extends object> =
	RequiredProperties<T>[keyof RequiredProperties<T>];

type RequiredProperties<T extends object> = {
	[K in keyof T as undefined extends T[K] ? never : K]-?: K;
};
