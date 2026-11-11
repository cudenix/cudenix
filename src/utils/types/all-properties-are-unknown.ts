export type AllPropertiesAreUnknown<T extends object> = false extends (
	T extends unknown ? AllPropertiesAreUnknownInBranch<T> : never
)
	? false
	: true;

type AllPropertiesAreUnknownInBranch<T extends object> = keyof {
	[K in keyof T as unknown extends T[K] ? never : K]: T[K];
} extends never
	? true
	: false;
