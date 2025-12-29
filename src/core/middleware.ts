import type { DeveloperContext } from "@/core/context";
import type { AnyError } from "@/core/error";
import type { AnySuccess } from "@/core/success";
import type { MaybePromise } from "@/types/maybe-promise";

export type MiddlewareFn<
	Return extends MaybePromise<AnyError | AnySuccess | void>,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = (
	context: DeveloperContext<Stores, Validators>,
	next: () => Promise<void>,
) => Return;

export type AnyMiddlewareFn = MiddlewareFn<any, any, any>;

export interface Middleware<
	Return extends MaybePromise<AnyError | AnySuccess | void>,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> {
	middleware: MiddlewareFn<Return, Stores, Validators>;
	type: "MIDDLEWARE";
}

export type AnyMiddleware = Middleware<any, any, any>;

type Constructor = new (middleware: AnyMiddlewareFn) => AnyMiddleware;

export const Middleware = function (
	this: AnyMiddleware,
	middleware: AnyMiddlewareFn,
) {
	this.middleware = middleware;
	this.type = "MIDDLEWARE";
} as unknown as Constructor;

export const middleware = <
	const Return extends MaybePromise<AnyError | AnySuccess | void>,
	const Stores extends Record<PropertyKey, unknown>,
	const Validators extends Record<PropertyKey, unknown>,
>(
	middleware: MiddlewareFn<Return, Stores, Validators>,
) => {
	return new Middleware(middleware) as Middleware<Return, Stores, Validators>;
};
