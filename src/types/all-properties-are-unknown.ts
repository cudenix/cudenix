export type AllPropertiesAreUnknown<Type> = {
	[Key in keyof Type]: unknown extends Type[Key] ? true : false;
}[keyof Type] extends true | undefined
	? true
	: false;
