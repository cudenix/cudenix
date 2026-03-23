import type { MaybePromise } from "bun";

import type { DeveloperContext } from "@/core/context";
import type {
	AnyError,
	FilterError,
	IgnoreError,
	MergeErrors,
	TransformError,
} from "@/core/error";
import {
	type AnyGroup,
	type AnyGroupFn,
	type AnyGroupOptions,
	Group,
	type GroupFn,
	type GroupOptions,
} from "@/core/group";
import {
	type AnyMiddleware,
	type AnyMiddlewareFn,
	Middleware,
	type MiddlewareFn,
} from "@/core/middleware";
import {
	type AnyRoute,
	type AnyRouteFn,
	type AnyRouteOptions,
	type ParseRoute,
	type PathToObject,
	Route,
	type RouteFn,
	type RouteFnReturnGenerator,
	type RouteFnReturnWS,
	type RouteOptions,
	type ValidatorsWithParams,
} from "@/core/route";
import {
	type AnyStore,
	type AnyStoreFn,
	Store,
	type StoreFn,
} from "@/core/store";
import type {
	AnySuccess,
	FilterSuccess,
	MergeSuccesses,
	TransformSuccess,
} from "@/core/success";
import {
	type AnyValidator,
	type AnyValidatorOptions,
	type DeepInferValidatorError,
	type DeepInferValidatorInput,
	type DeepInferValidatorOutput,
	type MergeInferValidatorRequest,
	type TransformValidatorError,
	Validator,
	type ValidatorOptions,
	type ValidatorRequest,
} from "@/core/validator";
import type { AllPropertiesAreUnknown } from "@/types/all-properties-are-unknown";
import type { ExtractUrlParams } from "@/types/extract-url-params";
import type { HttpMethod } from "@/types/http-method";
import type { MergePaths } from "@/types/merge-paths";
import type { RequiredKeys } from "@/types/required-keys";
import type { ValueOf } from "@/types/value-of";
import { FreezeEmpty } from "@/utils/objects/empty";

export type ModuleChain = (
	| AnyGroup
	| AnyMiddleware
	| AnyModule
	| AnyRoute
	| AnyStore
	| AnyValidator
)[];

export interface ModuleExtendsOptions {
	execute?: boolean;
}

export interface Module<
	Errors extends Record<PropertyKey, unknown>,
	Prefix extends `/${string}`,
	Routes extends Record<PropertyKey, unknown>,
	Stores extends Record<PropertyKey, unknown>,
	Successes extends Record<PropertyKey, unknown>,
	Validators extends {
		inputs: Record<PropertyKey, unknown>;
		outputs: Record<PropertyKey, unknown>;
	},
> {
	chain: ModuleChain;
	extends<
		const ModuleErrors extends Record<PropertyKey, unknown>,
		const ModulePrefix extends `/${string}`,
		const ModuleRoutes extends Record<PropertyKey, unknown>,
		const ModuleStores extends Record<PropertyKey, unknown>,
		const ModuleSuccesses extends Record<PropertyKey, unknown>,
		const ModuleValidators extends {
			inputs: Record<PropertyKey, unknown>;
			outputs: Record<PropertyKey, unknown>;
		},
	>(
		module: Module<
			ModuleErrors,
			ModulePrefix,
			ModuleRoutes,
			ModuleStores,
			ModuleSuccesses,
			ModuleValidators
		>,
		options?: ModuleExtendsOptions,
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
			AnyError | AnySuccess | void
		> = void,
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
	prefix: string;
	route<
		const RouteMethod extends HttpMethod,
		const RoutePath extends `/${string}`,
		const RouteReturn extends RouteMethod extends "WS"
			? RouteFnReturnWS<
					Omit<
						DeveloperContext<
							Stores,
							ValidatorsWithParams<
								RoutePath,
								MergeInferValidatorRequest<
									Validators["outputs"],
									DeepInferValidatorOutput<
										RouteValidatorOptions["request"]
									>
								>
							>
						>,
						"response"
					>
				>
			: MaybePromise<AnyError | AnySuccess> | RouteFnReturnGenerator,
		const RouteValidatorOptions extends ValidatorOptions<
			Partial<ValidatorRequest>
		>,
	>(
		method: RouteMethod,
		path: RoutePath,
		route: RouteFn<
			RouteMethod,
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
				string | string[]
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

type Constructor = new (options: AnyModuleOptions) => AnyModule;

export const Module = function (
	this: AnyModule,
	{ prefix }: AnyModuleOptions = FreezeEmpty,
) {
	this.chain = [];
	this.prefix = prefix ?? "";
	this.type = "MODULE";
} as unknown as Constructor;

Module.prototype.extends = function (
	this: AnyModule,
	module: AnyModule,
	options?: ModuleExtendsOptions,
) {
	if (options?.execute !== false) {
		this.chain.push(module);
	}

	return this;
};

Module.prototype.group = function (
	this: AnyModule,
	group: AnyGroupFn,
	options: AnyGroupOptions = FreezeEmpty,
) {
	this.chain.push(new Group(group, options));

	return this;
};

Module.prototype.middleware = function (
	this: AnyModule,
	middleware: AnyMiddlewareFn,
) {
	this.chain.push(new Middleware(middleware));

	return this;
};

Module.prototype.route = function (
	this: AnyModule,
	method: HttpMethod,
	path: `/${string}`,
	route: AnyRouteFn,
	options: AnyRouteOptions = FreezeEmpty,
) {
	this.chain.push(new Route(method, path, route, options));

	return this;
};

Module.prototype.store = function (this: AnyModule, store: AnyStoreFn) {
	this.chain.push(new Store(store));

	return this;
};

Module.prototype.validator = function (
	this: AnyModule,
	options: AnyValidatorOptions,
) {
	this.chain.push(new Validator(options));

	return this;
};

export const module = <
	const Errors extends Record<PropertyKey, unknown> = NonNullable<unknown>,
	const Prefix extends `/${string}` = "/",
	const Routes extends Record<PropertyKey, unknown> = NonNullable<unknown>,
	const Stores extends Record<PropertyKey, unknown> = NonNullable<unknown>,
	const Successes extends Record<PropertyKey, unknown> = NonNullable<unknown>,
	const Validators extends {
		inputs: Record<PropertyKey, unknown>;
		outputs: Record<PropertyKey, unknown>;
	} = {
		inputs: NonNullable<unknown>;
		outputs: NonNullable<unknown>;
	},
>(
	options: ModuleOptions<Prefix> = FreezeEmpty,
) => {
	return new Module(options) as Module<
		Errors,
		Prefix,
		Routes,
		Stores,
		Successes,
		Validators
	>;
};
