import type { MaybePromise } from "@/types/maybe-promise";

export type MaybeFunction<Type> = Type | (() => MaybePromise<Type>);
