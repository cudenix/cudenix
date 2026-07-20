import type {
	AnyGroup,
	AnyGroupFn,
	AnyGroupOptions,
	GroupFn,
	GroupOptions,
} from "@/core/group";
import type {
	AnyMiddleware,
	AnyMiddlewareFn,
	MiddlewareFn,
} from "@/core/middleware";
import type { AnyMount, MountFn, MountOptions } from "@/core/mount";
import type { AnyFail, AnyOk, MergeReplies } from "@/core/reply";
import type {
	AnyRoute,
	AnyRouteFn,
	AnyRouteHandler,
	AnyRouteOptions,
	MergeRoutes,
	ParseRoute,
	PathToObject,
	RouteFnReturnGenerator,
	RouteHandler,
	RouteOptions,
} from "@/core/route";
import type { AnyStore, AnyStoreFn, StoreFn } from "@/core/store";
import type {
	AnyValidator,
	AnyValidatorOptions,
	DeepInferValidatorError,
	DeepInferValidatorInput,
	DeepInferValidatorOutput,
	MergeInferValidatorRequest,
	TransformValidatorError,
	ValidatorOptions,
	ValidatorRequest,
} from "@/core/validator";
import { isGenerator } from "@/utils/functions/is-generator";
import { FrozenEmpty } from "@/utils/objects/empty";
import type { AllPropertiesAreUnknown } from "@/utils/types/all-properties-are-unknown";
import type { ExtractUrlParams } from "@/utils/types/extract-url-params";
import type { HttpMethod } from "@/utils/types/http-method";
import type { MaybePromise } from "@/utils/types/maybe-promise";
import type { Merge } from "@/utils/types/merge";
import type { MergePaths } from "@/utils/types/merge-paths";
import type { RequiredKeys } from "@/utils/types/required-keys";
import type { ValueOf } from "@/utils/types/value-of";

/**
 * Lists the links accumulated by a module.
 *
 * @example
 * ```typescript
 * const a: ModuleChain = [];
 * ```
 */
export type ModuleChain = (
	| AnyGroup
	| AnyMiddleware
	| AnyModule
	| AnyMount
	| AnyRoute
	| AnyStore
	| AnyValidator
)[];

/**
 * Constrains the validator maps of a {@link Module}.
 *
 * @example
 * ```typescript
 * const a: ModuleValidatorsConstraint = {
 *   inputs: { body: { a: "v1" } },
 *   outputs: { body: { a: 1 } },
 * };
 * ```
 */
export interface ModuleValidatorsConstraint {
	inputs: Record<PropertyKey, unknown>;
	outputs: Record<PropertyKey, unknown>;
}

/**
 * Fluent module builder for assembling routes.
 *
 * @example
 * ```typescript
 * const a = new Module()
 *   .store(() => ({ a: "v1" }))
 *   .route("GET", "/a/:p1", (context) =>
 *     ok({ a: context.request.params.p1, b: context.store.a }),
 *   );
 * ```
 */
export interface Module<
	Errors extends Record<PropertyKey, unknown>,
	Prefix extends `/${string}`,
	Routes extends Record<PropertyKey, unknown>,
	Stores extends Record<PropertyKey, unknown>,
	Successes extends Record<PropertyKey, unknown>,
	Validators extends ModuleValidatorsConstraint,
> {
	chain: ModuleChain;
	group<
		const GroupReturn extends AnyModule,
		const GroupPrefix extends `/${string}` = "/",
	>(
		handler: GroupFn<
			Module<
				Errors,
				MergePaths<Prefix, GroupPrefix>,
				NonNullable<unknown>,
				Stores,
				Successes,
				Validators
			>,
			GroupReturn
		>,
		options?: GroupOptions<GroupPrefix>,
	): Module<
		Errors,
		Prefix,
		MergeRoutes<Routes, GroupReturn["routes"]>,
		Stores,
		Successes,
		Validators
	>;
	middleware<
		const MiddlewareReturn extends MaybePromise<
			AnyFail | AnyOk | void
		> = undefined,
	>(
		handler: MiddlewareFn<MiddlewareReturn, Stores, Validators["outputs"]>,
	): Module<
		MergeReplies<
			Errors,
			Record<
				Extract<MiddlewareReturn, AnyFail>["status"],
				Extract<MiddlewareReturn, AnyFail>
			>
		>,
		Prefix,
		Routes,
		Stores,
		MergeReplies<
			Successes,
			Record<
				Extract<MiddlewareReturn, AnyOk>["status"],
				Extract<MiddlewareReturn, AnyOk>
			>
		>,
		Validators
	>;
	mount(
		fetch: MountFn,
		options?: MountOptions,
	): Module<Errors, Prefix, Routes, Stores, Successes, Validators>;
	prefix: `/${string}`;
	route<
		const RouteMethod extends HttpMethod,
		const RoutePath extends `/${string}`,
		const RouteReturn extends
			| MaybePromise<AnyFail | AnyOk>
			| RouteFnReturnGenerator,
		const RouteValidatorRequest extends
			Partial<ValidatorRequest> = NonNullable<unknown>,
	>(
		method: RouteMethod,
		path: RoutePath,
		handler: RouteHandler<
			RoutePath,
			RouteReturn,
			Stores,
			MergeInferValidatorRequest<
				Validators["outputs"],
				DeepInferValidatorOutput<RouteValidatorRequest>
			>
		>,
		options?: RouteOptions<ValidatorOptions<RouteValidatorRequest>>,
	): MergePaths<Prefix, RoutePath> extends infer MergedPath extends
		`/${string}`
		? ExtractUrlParams<MergedPath> extends infer PathParams extends object
			? Module<
					Errors,
					Prefix,
					MergeRoutes<
						Routes,
						ParseRoute<
							RouteMethod,
							MergedPath,
							MergeInferValidatorRequest<
								Validators["inputs"],
								DeepInferValidatorInput<RouteValidatorRequest>
							> &
								([NonNullable<unknown>] extends [PathParams]
									? NonNullable<unknown>
									: {
											params: RequiredKeys<PathParams> extends never
												? PathParams | undefined
												: PathParams;
										}),
							| Awaited<RouteReturn>
							| ValueOf<
									AllPropertiesAreUnknown<RouteValidatorRequest> extends true
										? Errors
										: MergeReplies<
												Errors,
												TransformValidatorError<
													DeepInferValidatorError<RouteValidatorRequest>
												>
											>
							  >
							| ValueOf<Successes>
						>
					>,
					Stores,
					Successes,
					Validators
				>
			: never
		: never;
	routes: Routes;
	store<
		const StoreReturn extends MaybePromise<
			Record<PropertyKey, unknown> | AnyFail
		>,
	>(
		handler: StoreFn<StoreReturn, Stores, Validators["outputs"]>,
	): Module<
		MergeReplies<
			Errors,
			Record<
				Extract<Awaited<StoreReturn>, AnyFail>["status"],
				Extract<Awaited<StoreReturn>, AnyFail>
			>
		>,
		Prefix,
		Routes,
		Merge<Stores, Exclude<Awaited<StoreReturn>, AnyFail>>,
		Successes,
		Validators
	>;
	type: "MODULE";
	use<
		const ModuleErrors extends Record<PropertyKey, unknown>,
		const ModulePrefix extends `/${string}`,
		const ModuleRoutes extends Record<PropertyKey, unknown>,
		const ModuleStores extends Record<PropertyKey, unknown>,
		const ModuleSuccesses extends Record<PropertyKey, unknown>,
		const ModuleValidators extends ModuleValidatorsConstraint,
	>(
		module: Module<
			ModuleErrors,
			ModulePrefix,
			ModuleRoutes,
			ModuleStores,
			ModuleSuccesses,
			ModuleValidators
		>,
	): Module<
		MergeReplies<Errors, ModuleErrors>,
		MergePaths<Prefix, ModulePrefix>,
		MergeRoutes<
			Routes,
			Prefix extends "/"
				? ModuleRoutes
				: Prefix extends `/${infer Rest}`
					? PathToObject<Rest, ModuleRoutes>
					: ModuleRoutes
		>,
		Merge<Stores, ModuleStores>,
		MergeReplies<Successes, ModuleSuccesses>,
		{
			inputs: MergeInferValidatorRequest<
				Validators["inputs"],
				ModuleValidators["inputs"]
			>;
			outputs: MergeInferValidatorRequest<
				Validators["outputs"],
				ModuleValidators["outputs"]
			>;
		}
	>;
	validator<const _ValidatorRequest extends Partial<ValidatorRequest>>(
		options: ValidatorOptions<_ValidatorRequest>,
	): Module<
		MergeReplies<
			Errors,
			TransformValidatorError<DeepInferValidatorError<_ValidatorRequest>>
		>,
		Prefix,
		Routes,
		Stores,
		Successes,
		{
			inputs: MergeInferValidatorRequest<
				Validators["inputs"],
				DeepInferValidatorInput<_ValidatorRequest>
			>;
			outputs: MergeInferValidatorRequest<
				Validators["outputs"],
				DeepInferValidatorOutput<_ValidatorRequest>
			>;
		}
	>;
}

/**
 * Any {@link Module} regardless of its generics.
 *
 * @example
 * ```typescript
 * const a: AnyModule[] = [];
 * ```
 */
export type AnyModule = Module<any, any, any, any, any, any>;

/**
 * Options for the {@link Module} constructor.
 *
 * @example
 * ```typescript
 * const a: ModuleOptions<"/v1"> = { prefix: "/v1" };
 * const b: ModuleOptions<"/"> = {};
 * ```
 */
export interface ModuleOptions<Prefix extends `/${string}`> {
	prefix?: Prefix;
}

/**
 * Any {@link ModuleOptions} regardless of its prefix generic.
 *
 * @example
 * ```typescript
 * const fn = (options: AnyModuleOptions = {}) => options.prefix ?? "/";
 * ```
 */
export type AnyModuleOptions = ModuleOptions<any>;

/**
 * Constructor signature of {@link Module}.
 *
 * @example
 * ```typescript
 * const Ctor: ModuleConstructor = Module;
 *
 * const a = new Ctor({ prefix: "/v1" });
 *
 * a.prefix; // "/v1"
 * ```
 */
export interface ModuleConstructor {
	new <
		const Errors extends Record<
			PropertyKey,
			unknown
		> = NonNullable<unknown>,
		const Prefix extends `/${string}` = "/",
		const Routes extends Record<
			PropertyKey,
			unknown
		> = NonNullable<unknown>,
		const Stores extends Record<
			PropertyKey,
			unknown
		> = NonNullable<unknown>,
		const Successes extends Record<
			PropertyKey,
			unknown
		> = NonNullable<unknown>,
		const Validators extends ModuleValidatorsConstraint = {
			inputs: NonNullable<unknown>;
			outputs: NonNullable<unknown>;
		},
	>(
		options?: ModuleOptions<Prefix>,
	): Module<Errors, Prefix, Routes, Stores, Successes, Validators>;
}

/**
 * Construct a {@link Module} from optional {@link ModuleOptions}.
 *
 * @example
 * ```typescript
 * const a = new Module({ prefix: "/v1" });
 *
 * a.chain;  // []
 * a.prefix; // "/v1"
 * a.type;   // "MODULE"
 * ```
 */
export const Module = function (
	this: AnyModule,
	{ prefix = "" }: AnyModuleOptions = FrozenEmpty,
) {
	this.chain = [];
	this.prefix = prefix;
	this.type = "MODULE";
} as unknown as ModuleConstructor;

/**
 * Add a nested group to the module.
 *
 * @example
 * ```typescript
 * const a = new Module().group(
 *   (module) => module.route("GET", "/a", () => ok("v1")),
 *   { prefix: "/v1" },
 * );
 * ```
 */
Module.prototype.group = function (
	this: AnyModule,
	handler: AnyGroupFn,
	{ prefix = "" }: AnyGroupOptions = FrozenEmpty,
) {
	this.chain.push({ handler, prefix, type: "GROUP" as const });

	return this;
};

/**
 * Add a middleware to the module.
 *
 * @example
 * ```typescript
 * const a = new Module().middleware(async (_, next) => {
 *   await next();
 * });
 * ```
 */
Module.prototype.middleware = function (
	this: AnyModule,
	handler: AnyMiddlewareFn,
) {
	this.chain.push({ handler, type: "MIDDLEWARE" as const });

	return this;
};

/**
 * Compose another module into this one.
 *
 * @example
 * ```typescript
 * const a = new Module({ prefix: "/v1" }).use(
 *   new Module().route("GET", "/a", () => ok("v1")),
 * );
 * ```
 */
Module.prototype.use = function (this: AnyModule, module: AnyModule) {
	this.chain.push(module);

	return this;
};

/**
 * Mount a WinterCG `fetch` handler.
 *
 * @example
 * ```typescript
 * const a = new Module().mount(hono.fetch, { prefix: "/hono" });
 *
 * const b = new Module().mount((request) => new Response(request.url));
 * ```
 */
Module.prototype.mount = function (
	this: AnyModule,
	fetch: MountFn,
	{ prefix = "/" }: MountOptions = FrozenEmpty,
) {
	this.chain.push({ fetch, path: prefix, type: "MOUNT" as const });

	return this;
};

/**
 * Add a route binding a handler to a method and path.
 *
 * @example
 * ```typescript
 * const a = new Module().route(
 *   "GET",
 *   "/a/:p1",
 *   (context) => ok({ a: context.request.params.p1 }),
 * );
 * ```
 */
Module.prototype.route = function (
	this: AnyModule,
	method: HttpMethod,
	path: `/${string}`,
	handler: AnyRouteHandler,
	{ validator }: AnyRouteOptions = FrozenEmpty,
) {
	const isFn = typeof handler === "function";

	this.chain.push({
		handler: isFn
			? (handler as AnyRouteFn)
			: () => handler as AnyFail | AnyOk,
		method,
		path,
		sse: isFn && isGenerator(handler as AnyRouteFn),
		static: !isFn,
		type: "ROUTE" as const,
		validator: validator
			? {
					keys: Object.keys(
						validator.request,
					) as (keyof ValidatorRequest)[],
					request: validator.request,
					type: "VALIDATOR" as const,
				}
			: undefined,
	});

	return this;
};

/**
 * Add a store to the module.
 *
 * @example
 * ```typescript
 * const a = new Module().store(() => ({ a: "v1" }));
 * ```
 */
Module.prototype.store = function (this: AnyModule, handler: AnyStoreFn) {
	this.chain.push({ handler, type: "STORE" as const });

	return this;
};

/**
 * Add a validator to the module.
 *
 * @example
 * ```typescript
 * const a = new Module().validator({ request: { body: someSchema } });
 * ```
 */
Module.prototype.validator = function (
	this: AnyModule,
	options: AnyValidatorOptions,
) {
	this.chain.push({
		keys: Object.keys(options.request) as (keyof ValidatorRequest)[],
		request: options.request,
		type: "VALIDATOR" as const,
	});

	return this;
};
