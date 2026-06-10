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
import type { AnyFail, AnyOk, MergeReplies } from "@/core/reply";
import type {
	AnyRoute,
	AnyRouteFn,
	AnyRouteHandler,
	AnyRouteOptions,
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
 * @module
 * Module builder — the fluent chain that gathers groups, middlewares, stores,
 * validators, and routes, threading the accumulated errors, prefix, routes,
 * stores, successes, and validator inputs/outputs through each call so every
 * step sees the cumulative type-level shape it operates on.
 */

/**
 * Ordered list of links a module accumulates. Each entry is one of the chain
 * kinds — a nested {@link AnyGroup}, {@link AnyMiddleware}, mounted
 * {@link AnyModule}, {@link AnyRoute}, {@link AnyStore}, or
 * {@link AnyValidator} — in the exact order the builder methods pushed them.
 * The compiler walks this list to flatten a module into its endpoints.
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
	| AnyRoute
	| AnyStore
	| AnyValidator
)[];

/**
 * Constraint on the `Validators` generic threaded through {@link Module}. Holds
 * the two per-slot request maps a module accumulates as validators register:
 * `inputs` is the pre-validation shape a caller must send (recorded in the
 * client-facing route tree), and `outputs` is the parsed shape later
 * middlewares, stores, and routes receive on `context.request`.
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
 * Fluent module builder. Each builder method returns a new `Module` type whose
 * generics fold in that step's contribution — accumulated errors, the prefix,
 * the client-facing route tree, the request-scoped stores, the successes, and
 * the validator inputs/outputs — so every subsequent call is typed against the
 * cumulative shape rather than only the slice it touches. The runtime side
 * pushes a descriptor onto {@link ModuleChain} per call and returns `this` for
 * chaining; the compiler later walks that chain to produce endpoints.
 *
 * Builder methods:
 *
 * - `group` — declare an isolated sub-module via {@link GroupFn}; its routes
 *   merge into the parent under the group prefix, but links it adds stay
 *   inside the group.
 * - `middleware` — register a {@link MiddlewareFn}; any error or success it can
 *   return folds into the module's `Errors`/`Successes`.
 * - `mount` — graft another module in, merging its errors, routes (nested
 *   under this prefix), stores, successes, and validator maps.
 * - `route` — bind a handler to a method and path; the merged path drives the
 *   route tree entry, and the optional per-route validator refines the typed
 *   request.
 * - `store` — register a {@link StoreFn}; its non-error return shallow-merges
 *   into `Stores` — an overlapping key is replaced wholesale, mirroring the
 *   runtime merge — while any error it can return folds into `Errors`.
 * - `validator` — register a {@link ValidatorOptions} schema map; its inferred
 *   inputs/outputs thread into `Validators` and its issues into `Errors`.
 *
 * Fields:
 *
 * - `chain` — the accumulated {@link ModuleChain} of pushed links.
 * - `prefix` — the path every route in this module is mounted under.
 * - `routes` — the client-facing route tree built up by `route`/`mount`.
 * - `type` — the `"MODULE"` discriminant the chain walker dispatches on.
 *
 * @typeParam Errors - Accumulated status-keyed error envelope map.
 * @typeParam Prefix - Path prefix this module is mounted under. Starts with `/`.
 * @typeParam Routes - Client-facing route tree gathered so far.
 * @typeParam Stores - Cumulative `context.store` shape threaded from `store`.
 * @typeParam Successes - Accumulated status-keyed success envelope map.
 * @typeParam Validators - Cumulative validator inputs/outputs; see
 *   {@link ModuleValidatorsConstraint}.
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
		Routes & GroupReturn["routes"],
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
	mount<
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
		Routes &
			(Prefix extends "/"
				? ModuleRoutes
				: Prefix extends `/${infer Rest}`
					? PathToObject<Rest, ModuleRoutes>
					: ModuleRoutes),
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
					Routes &
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
 * Wildcard alias matching any {@link Module} regardless of its accumulated
 * generics. Reach for it in container, chain, and runtime types where the
 * concrete errors, prefix, routes, stores, successes, and validators are
 * irrelevant — for example the mounted-module slot of {@link ModuleChain} or
 * the `this` type of the runtime builder methods.
 *
 * @example
 * ```typescript
 * const a: AnyModule[] = [];
 * ```
 */
export type AnyModule = Module<any, any, any, any, any, any>;

/**
 * Options accepted by the {@link Module} constructor. The `prefix` seeds the
 * module's `prefix` field — every route declared on the module is mounted
 * under it, and `mount`/`group` concatenate it with their own prefixes. Omit
 * it to keep the module rooted at `/`.
 *
 * Must start with `/` so the type-level path mergers can normalize the
 * boundary slash.
 *
 * @typeParam Prefix - Path prefix for the module. Must start with `/`.
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
 * Wildcard alias matching any {@link ModuleOptions} regardless of its prefix
 * parameter. Reach for it where the concrete prefix is erased — for example,
 * the runtime body of the {@link Module} constructor, which destructures
 * `prefix` without caring about its literal type.
 *
 * @example
 * ```typescript
 * const fn = (options: AnyModuleOptions = {}) => options.prefix ?? "/";
 * ```
 */
export type AnyModuleOptions = ModuleOptions<any>;

/**
 * Constructor signature of {@link Module}, declared separately so the runtime
 * value can be defined with a plain `function` and cast to a constructable
 * type. Every generic defaults to the empty accumulator, so `new Module()`
 * starts from a clean module rooted at `/` and each builder call refines the
 * type from there.
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
 * Construct a {@link Module} from an optional options object. Must be invoked
 * with `new`; the resulting instance carries an empty `chain`, the resolved
 * `prefix`, and `type: "MODULE"` — the three fields the compiler and chain
 * walker read.
 *
 * `prefix` defaults to `""` at runtime when `options` is omitted (the
 * type-level default is `"/"`); {@link FrozenEmpty} is the default options
 * object, so the no-argument path skips a fresh `{}` allocation. The builder
 * methods live on the prototype and are not set here.
 *
 * @param options - Optional construction options; see {@link ModuleOptions}.
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
 * Push a `"GROUP"` link onto the chain, deferring the {@link GroupFn} factory
 * and its prefix to the compiler. The factory is invoked later against an
 * inner module that inherits the parent's prior links, so links it adds stay
 * scoped to the group while its routes merge into the parent under `prefix`.
 *
 * `prefix` defaults to `""` when `options` is omitted; {@link FrozenEmpty} is
 * the default options object.
 *
 * @param handler - Group factory deferred to the compiler.
 * @param options - Optional group options; see {@link GroupOptions}.
 * @returns The module, for chaining.
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
 * Push a `"MIDDLEWARE"` link onto the chain, pairing the {@link MiddlewareFn}
 * with its discriminator so the chain walker can dispatch on link kind. The
 * handler wraps the rest of the chain through its `next` continuation when the
 * compiled endpoint runs.
 *
 * @param handler - Middleware function appended to the chain.
 * @returns The module, for chaining.
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
 * Push another module onto the chain as a nested link. The compiler walks the
 * mounted module in place, so its routes nest under this module's prefix and
 * its errors, stores, successes, and validator maps merge into the parent.
 *
 * @param module - Module to graft into this one's chain.
 * @returns The module, for chaining.
 * @example
 * ```typescript
 * const a = new Module({ prefix: "/v1" }).mount(
 *   new Module().route("GET", "/a", () => ok("v1")),
 * );
 * ```
 */
Module.prototype.mount = function (this: AnyModule, module: AnyModule) {
	this.chain.push(module);

	return this;
};

/**
 * Push a `"ROUTE"` link onto the chain, normalizing the handler before it is
 * stored. A function handler is kept as-is; a static {@link AnyFail}/
 * {@link AnyOk} envelope is wrapped in a function that returns it, so the
 * runtime always invokes a callable. The `sse` flag records whether a function
 * handler is a generator (driving SSE framing), `static` records that the
 * handler arrived as a value, and an optional `validator` is compiled to a
 * descriptor with its slot `keys` pre-extracted from `request`.
 *
 * `jit` and `validator` default to `undefined` when `options` is omitted;
 * {@link FrozenEmpty} is the default options object.
 *
 * @param method - HTTP verb the route binds to.
 * @param path - Route pattern starting with `/`.
 * @param handler - Route function or a static envelope to return.
 * @param options - Optional route options; see {@link RouteOptions}.
 * @returns The module, for chaining.
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
	{ jit, validator }: AnyRouteOptions = FrozenEmpty,
) {
	const isFn = typeof handler === "function";

	this.chain.push({
		handler: isFn
			? (handler as AnyRouteFn)
			: () => handler as AnyFail | AnyOk,
		jit,
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
 * Push a `"STORE"` link onto the chain, pairing the {@link StoreFn} with its
 * discriminator. When the compiled endpoint runs, the handler's record return
 * is merged into `context.store` for later links, while an error return halts
 * the chain and becomes the response.
 *
 * @param handler - Store function appended to the chain.
 * @returns The module, for chaining.
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
 * Push a `"VALIDATOR"` link onto the chain, compiling the
 * {@link ValidatorOptions} into a descriptor. The slot `keys` are pre-extracted
 * from `options.request` so the runtime can iterate the declared slots without
 * rebuilding the array per request, and the schema map is carried through as
 * `request`.
 *
 * @param options - Validator options whose `request` map is compiled.
 * @returns The module, for chaining.
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
