import type { AnyError, DeveloperContext } from "@/core";

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

type Constructor = new (store: AnyStoreFn) => AnyStore;

export const Store = function (this: AnyStore, store: AnyStoreFn) {
	this.store = store;
	this.type = "STORE";
} as unknown as Constructor;

export const store = <
	const Return extends Record<PropertyKey, unknown> | AnyError,
	const Stores extends Record<PropertyKey, unknown>,
	const Validators extends Record<PropertyKey, unknown>,
>(
	store: StoreFn<Return, Stores, Validators>,
) => {
	return new Store(store) as Store<Return, Stores, Validators>;
};
