import type { MaybePromise } from "@/utils/types/maybe-promise";

export type MaybeFunction<T> = (() => MaybePromise<T>) | T;
