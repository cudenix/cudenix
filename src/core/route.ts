import type { WebSocketHandler } from "bun";

import type { DeveloperContext } from "@/core/context";
import type { AnyError } from "@/core/error";
import type { AnySuccess } from "@/core/success";
import type {
	AnyValidator,
	DeepInferValidatorOutput,
	MergeInferValidatorRequest,
	ValidatorOptions,
	ValidatorRequest,
} from "@/core/validator";
import { Validator } from "@/core/validator";
import type { ExtractUrlParams } from "@/types/extract-url-params";
import type { GeneratorSSE } from "@/types/generator-sse";
import type { HttpMethod } from "@/types/http-method";
import type { MaybePromise } from "@/types/maybe-promise";
import { isGenerator } from "@/utils/functions/is-generator";
import { FreezeEmpty } from "@/utils/objects/empty";

export type PathToObject<
	Path extends string,
	Value,
> = Path extends `${infer First}/${infer Rest}`
	? Record<First, PathToObject<Rest, Value>>
	: Record<Path, Value>;

export type ParseRoute<
	Method extends HttpMethod,
	Path extends `/${string}`,
	Request,
	Response,
> = PathToObject<
	Path extends "/" ? "index" : Path extends `/${infer Rest}` ? Rest : Path,
	Record<
		Lowercase<Method>,
		{
			method: Uppercase<Method>;
			path: Path;
			request: Request;
			response: Response;
		}
	>
>;

export type RouteFnReturnWS<Context> = WebSocketHandler<Context>;

export type RouteFnReturnGenerator =
	| Generator<
			GeneratorSSE<AnyError | AnySuccess, string>,
			AnyError | AnySuccess | void
	  >
	| AsyncGenerator<
			GeneratorSSE<AnyError | AnySuccess, string>,
			AnyError | AnySuccess | void
	  >;

export type ValidatorsWithParams<
	Path extends string,
	Validators extends Record<PropertyKey, unknown>,
> =
	ExtractUrlParams<Path> extends infer Params
		? [Params] extends [NonNullable<unknown>]
			? [NonNullable<unknown>] extends [Params]
				? Validators
				: Validators & {
						params: Params;
					}
			: Validators & {
					params: Params;
				}
		: never;

export type RouteFn<
	Method extends HttpMethod,
	Path extends string,
	Return extends Method extends "WS"
		? RouteFnReturnWS<
				Omit<
					DeveloperContext<
						Stores,
						ValidatorsWithParams<Path, Validators>
					>,
					"response"
				>
			>
		: MaybePromise<AnyError | AnySuccess> | RouteFnReturnGenerator,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = (
	context: DeveloperContext<Stores, ValidatorsWithParams<Path, Validators>>,
) => Return;

export type AnyRouteFn = RouteFn<any, any, any, any, any>;

export interface Route<
	Method extends HttpMethod,
	Path extends `/${string}`,
	Return extends Method extends "WS"
		? RouteFnReturnWS<
				Omit<
					DeveloperContext<
						Stores,
						ValidatorsWithParams<
							Path,
							MergeInferValidatorRequest<
								Validators,
								DeepInferValidatorOutput<
									_ValidatorOptions["request"]
								>
							>
						>
					>,
					"response"
				>
			>
		: MaybePromise<AnyError | AnySuccess> | RouteFnReturnGenerator,
	Stores extends Record<PropertyKey, unknown>,
	_ValidatorOptions extends ValidatorOptions<Partial<ValidatorRequest>>,
	Validators extends Record<PropertyKey, unknown>,
> {
	generator: boolean;
	literal: boolean;
	method: Method;
	path: Path;
	route: RouteFn<
		Method,
		Path,
		Return,
		Stores,
		MergeInferValidatorRequest<
			Validators,
			DeepInferValidatorOutput<_ValidatorOptions["request"]>
		>
	>;
	static: boolean;
	type: "ROUTE";
	validator?: AnyValidator | undefined;
}

export type AnyRoute = Route<any, any, any, any, any, any>;

export type RouteHandler<
	Method extends HttpMethod,
	Path extends `/${string}`,
	Return extends Method extends "WS"
		? RouteFnReturnWS<
				Omit<
					DeveloperContext<
						Stores,
						ValidatorsWithParams<Path, Validators>
					>,
					"response"
				>
			>
		: MaybePromise<AnyError | AnySuccess> | RouteFnReturnGenerator,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> =
	| RouteFn<Method, Path, Return, Stores, Validators>
	| Extract<Awaited<Return>, AnyError | AnySuccess>;

export type AnyRouteHandler = RouteHandler<any, any, any, any, any>;

export interface RouteOptions<
	_ValidatorOptions extends ValidatorOptions<Partial<ValidatorRequest>>,
> {
	static?: boolean;
	validator?: _ValidatorOptions;
}

export type AnyRouteOptions = RouteOptions<any>;

type Constructor = new (
	method: HttpMethod,
	path: `/${string}`,
	handler: AnyRouteHandler,
	options?: AnyRouteOptions,
) => AnyRoute;

export const Route = function Route(
	this: AnyRoute,
	method: HttpMethod,
	path: `/${string}`,
	handler: AnyRouteHandler,
	{ static: staticOption, validator }: AnyRouteOptions = FreezeEmpty,
) {
	const isFn = typeof handler === "function";

	this.generator = isGenerator(handler as AnyRouteFn);
	this.literal = !isFn;
	this.method = method;
	this.path = path;
	this.route = isFn
		? (handler as AnyRouteFn)
		: () => {
				return handler as AnyError | AnySuccess;
			};
	this.static =
		method !== "WS" &&
		!this.generator &&
		(staticOption ?? this.literal) === true;
	this.type = "ROUTE";
	this.validator = validator ? new Validator(validator) : undefined;
} as unknown as Constructor;

export const route = <
	const Method extends HttpMethod,
	const Path extends `/${string}`,
	const Return extends Method extends "WS"
		? RouteFnReturnWS<
				Omit<
					DeveloperContext<
						Stores,
						ValidatorsWithParams<
							Path,
							MergeInferValidatorRequest<
								Validators,
								DeepInferValidatorOutput<
									_ValidatorOptions["request"]
								>
							>
						>
					>,
					"response"
				>
			>
		: MaybePromise<AnyError | AnySuccess> | RouteFnReturnGenerator,
	const Stores extends Record<PropertyKey, unknown>,
	const _ValidatorOptions extends ValidatorOptions<Partial<ValidatorRequest>>,
	const Validators extends Record<PropertyKey, unknown>,
>(
	method: Method,
	path: Path,
	handler: RouteHandler<
		Method,
		Path,
		Return,
		Stores,
		MergeInferValidatorRequest<
			Validators,
			DeepInferValidatorOutput<_ValidatorOptions["request"]>
		>
	>,
	options?: RouteOptions<_ValidatorOptions>,
) => {
	return new Route(method, path, handler, options) as Route<
		Method,
		Path,
		Return,
		Stores,
		_ValidatorOptions,
		Validators
	>;
};
