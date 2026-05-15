export type Merge<FirstType extends object, SecondType extends object> = {
	[Key in keyof FirstType as Key extends keyof SecondType
		? never
		: Key]: FirstType[Key];
} & SecondType;
