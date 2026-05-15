export type ExtendsType<Type, Extends, True = Type, False = Type> = [
	Type,
	Extends,
] extends [Extends, Type]
	? True
	: False;
