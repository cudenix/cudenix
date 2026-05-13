import type { DeveloperContext } from "@/core/context";
import type { AnyError } from "@/core/error";

export type StoreFn<
	Return extends Record<PropertyKey, unknown> | AnyError,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = (context: DeveloperContext<Stores, Validators>) => Return | Promise<Return>;

export type AnyStoreFn = StoreFn<any, any, any>;

export interface Store<
	Return extends Record<PropertyKey, unknown> | AnyError,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> {
	store: StoreFn<Return, Stores, Validators>;
	type: "STORE";
}

export type AnyStore = Store<any, any, any>;
