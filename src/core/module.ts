import type {
	AnyError,
	FilterError,
	IgnoreError,
	MergeErrors,
	TransformError,
} from "@/core/error";
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
	AnySuccess,
	FilterSuccess,
	MergeSuccesses,
	TransformSuccess,
} from "@/core/success";
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
import type { AllPropertiesAreUnknown } from "@/types/all-properties-are-unknown";
import type { ExtractUrlParams } from "@/types/extract-url-params";
import type { HttpMethod } from "@/types/http-method";
import type { MaybePromise } from "@/types/maybe-promise";
import type { MergePaths } from "@/types/merge-paths";
import type { RequiredKeys } from "@/types/required-keys";
import type { ValueOf } from "@/types/value-of";
import { isGenerator } from "@/utils/functions/is-generator";
import { FrozenEmpty } from "@/utils/objects/empty";

export type ModuleChain = (
	| AnyGroup
	| AnyMiddleware
	| AnyModule
	| AnyRoute
	| AnyStore
	| AnyValidator
)[];

export interface ModuleMountOptions {
	execute?: boolean;
}

export interface ModuleValidatorsConstraint {
	inputs: Record<PropertyKey, unknown>;
	outputs: Record<PropertyKey, unknown>;
}

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
		group: GroupFn<
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
			AnyError | AnySuccess | undefined
		> = undefined,
	>(
		middleware: MiddlewareFn<
			MiddlewareReturn,
			Stores,
			Validators["outputs"]
		>,
	): Module<
		MergeErrors<Errors, TransformError<FilterError<MiddlewareReturn>>>,
		Prefix,
		Routes,
		Stores,
		MergeSuccesses<
			Successes,
			TransformSuccess<FilterSuccess<MiddlewareReturn>>
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
		options?: ModuleMountOptions,
	): Module<
		MergeErrors<Errors, ModuleErrors>,
		MergePaths<Prefix, ModulePrefix>,
		Routes &
			(Prefix extends "/"
				? ModuleRoutes
				: Prefix extends `/${infer Rest}`
					? PathToObject<Rest, ModuleRoutes>
					: ModuleRoutes),
		Stores & ModuleStores,
		MergeSuccesses<Successes, ModuleSuccesses>,
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
	prefix: string;
	route<
		const RouteMethod extends HttpMethod,
		const RoutePath extends `/${string}`,
		const RouteReturn extends
			| MaybePromise<AnyError | AnySuccess>
			| RouteFnReturnGenerator,
		const RouteValidatorOptions extends ValidatorOptions<
			Partial<ValidatorRequest>
		>,
	>(
		method: RouteMethod,
		path: RoutePath,
		handler: RouteHandler<
			RoutePath,
			RouteReturn,
			Stores,
			MergeInferValidatorRequest<
				Validators["outputs"],
				DeepInferValidatorOutput<RouteValidatorOptions["request"]>
			>
		>,
		options?: RouteOptions<RouteValidatorOptions>,
	): MergePaths<Prefix, RoutePath> extends infer MergedPath extends
		`/${string}`
		? ExtractUrlParams<MergedPath> extends infer PathParams extends Record<
				string,
				string | string[] | undefined
			>
			? Module<
					Errors,
					Prefix,
					Routes &
						ParseRoute<
							RouteMethod,
							MergedPath,
							MergeInferValidatorRequest<
								Validators["inputs"],
								DeepInferValidatorInput<
									RouteValidatorOptions["request"]
								>
							> &
								([NonNullable<unknown>] extends [PathParams]
									? NonNullable<unknown>
									: {
											params: RequiredKeys<PathParams> extends never
												? PathParams | undefined
												: PathParams;
										}),
							| Awaited<RouteReturn>
							| (AllPropertiesAreUnknown<
									RouteValidatorOptions["request"]
							  > extends true
									? ValueOf<Errors>
									: ValueOf<
											MergeErrors<
												Errors,
												TransformValidatorError<
													DeepInferValidatorError<
														RouteValidatorOptions["request"]
													>
												>
											>
										>)
							| ValueOf<Successes>
						>,
					Stores,
					Successes,
					Validators
				>
			: never
		: never;
	routes: Routes;
	store<const StoreReturn extends Record<PropertyKey, unknown> | AnyError>(
		store: StoreFn<StoreReturn, Stores, Validators["outputs"]>,
	): Module<
		MergeErrors<Errors, TransformError<FilterError<StoreReturn>>>,
		Prefix,
		Routes,
		Stores & IgnoreError<StoreReturn>,
		Successes,
		Validators
	>;
	type: "MODULE";
	validator<const _ValidatorRequest extends Partial<ValidatorRequest>>(
		options: ValidatorOptions<_ValidatorRequest>,
	): Module<
		MergeErrors<
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

export type AnyModule = Module<any, any, any, any, any, any>;

export interface ModuleOptions<Prefix extends `/${string}`> {
	prefix?: Prefix;
}

export type AnyModuleOptions = ModuleOptions<any>;

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

export const Module = function Module(
	this: AnyModule,
	{ prefix = "" }: AnyModuleOptions = FrozenEmpty,
) {
	this.chain = [];
	this.prefix = prefix;
	this.type = "MODULE";
} as unknown as ModuleConstructor;

Module.prototype.group = function (
	this: AnyModule,
	group: AnyGroupFn,
	{ prefix = "" }: AnyGroupOptions = FrozenEmpty,
) {
	this.chain.push({ group, prefix, type: "GROUP" as const });

	return this;
};

Module.prototype.middleware = function (
	this: AnyModule,
	middleware: AnyMiddlewareFn,
) {
	this.chain.push({ middleware, type: "MIDDLEWARE" as const });

	return this;
};

Module.prototype.mount = function (
	this: AnyModule,
	module: AnyModule,
	{ execute = true }: ModuleMountOptions = FrozenEmpty,
) {
	if (execute) {
		this.chain.push(module);
	}

	return this;
};

Module.prototype.route = function (
	this: AnyModule,
	method: HttpMethod,
	path: `/${string}`,
	handler: AnyRouteHandler,
	{ jit, validator }: AnyRouteOptions = FrozenEmpty,
) {
	const isFn = typeof handler === "function";

	this.chain.push({
		jit,
		method,
		path,
		route: isFn
			? (handler as AnyRouteFn)
			: () => handler as AnyError | AnySuccess,
		sse: isGenerator(handler as AnyRouteFn),
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

Module.prototype.store = function (this: AnyModule, store: AnyStoreFn) {
	this.chain.push({ store, type: "STORE" as const });

	return this;
};

Module.prototype.validator = function validator(
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
