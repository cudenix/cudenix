import type { ExtendsType } from "@/types";

type OmitKeys<Type extends Record<PropertyKey, unknown>, OmitType> = keyof {
	[Key in keyof Type as ExtendsType<
		Type[Key],
		OmitType,
		Key,
		never
	>]: Type[Key];
};

export type ConditionallyOmit<
	Type extends Record<PropertyKey, unknown>,
	OptionalType,
> = Omit<Type, OmitKeys<Type, OptionalType>>;
