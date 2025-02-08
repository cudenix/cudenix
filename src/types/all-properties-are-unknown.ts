export type AllPropertiesAreUnknown<Type> = {
	[Key in keyof Type]: Type[Key] extends unknown
		? unknown extends Type[Key]
			? true
			: false
		: false;
}[keyof Type] extends true | undefined
	? true
	: false;
