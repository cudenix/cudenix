export type MaybeFunction<Type> = Type | (() => Type | Promise<Type>);
