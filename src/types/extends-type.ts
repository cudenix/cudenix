export type ExtendsType<Type, Extends, True = Type, False = Type> = [
	Type,
] extends [Extends]
	? [Extends] extends [Type]
		? True
		: False
	: False;
