export type ConditionallyOmit<Type extends Record<PropertyKey, unknown>, OmitType> = {
	[Key in keyof Type as [Type[Key]] extends [OmitType]
		? [OmitType] extends [Type[Key]]
			? never
			: Key
		: Key]: Type[Key];
};
