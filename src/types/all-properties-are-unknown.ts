export type AllPropertiesAreUnknown<T> = {
	[K in keyof T]: T[K] extends unknown
		? unknown extends T[K]
			? true
			: false
		: false;
}[keyof T] extends true | undefined
	? true
	: false;
