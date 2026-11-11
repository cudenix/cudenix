export type Prettify<T extends object> = {
	[K in keyof T]: T[K];
};
