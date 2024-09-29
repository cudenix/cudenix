export type Merge<FirstType extends object, SecondType extends object> = Omit<
	FirstType,
	keyof SecondType
> &
	SecondType;
