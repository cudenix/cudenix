type OmitKeys<Type, OmitType> = {
	[Key in keyof Type]: [Type[Key], OmitType] extends [OmitType, Type[Key]]
		? Key
		: never;
}[keyof Type];

export type ConditionallyOmit<
	Type extends Record<PropertyKey, unknown>,
	OmitType,
> = Omit<Type, OmitKeys<Type, OmitType>>;
