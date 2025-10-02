import type { WebSocketHandler } from "bun";

import type { DeveloperContext } from "@/context";
import type { AnyError } from "@/error";
import type { AnySuccess } from "@/success";
import type {
	ConditionallyOmit,
	ExtendsType,
	ExtractUrlParams,
	GeneratorSSE,
	HttpMethod,
	MaybePromise,
} from "@/types";
import { Empty } from "@/utils/empty";
import {
	type AnyValidator,
	type DeepInferValidatorOutput,
	type MergeInferValidatorRequest,
	Validator,
	type ValidatorOptions,
	type ValidatorRequest,
} from "@/validator";

export type PathToObject<
	Path extends string,
	Value,
> = Path extends `${infer First}/${infer Rest}`
	? {
			[Key in First]: PathToObject<Rest, Value>;
		}
	: {
			[Key in Path]: Value;
		};

export type ParseRoute<
	Method extends HttpMethod,
	Path extends `/${string}`,
	Request,
	Response,
> = PathToObject<
	Path extends "/" ? "index" : Path extends `/${infer Rest}` ? Rest : Path,
	{
		[Key in Lowercase<Method>]: {
			method: Uppercase<Method>;
			path: Path;
			request: Request;
			response: Response;
		};
	}
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

export type RouteFn<
	Method extends HttpMethod,
	Path extends string,
	Return extends Method extends "WS"
		? RouteFnReturnWS<
				Omit<
					DeveloperContext<
						Stores,
						ExtendsType<
							ExtractUrlParams<Path>,
							NonNullable<unknown>,
							Validators,
							Validators &
								ConditionallyOmit<
									{
										params: ExtractUrlParams<Path>;
									},
									NonNullable<unknown>
								>
						>
					>,
					"response"
				>
			>
		: MaybePromise<AnyError | AnySuccess> | RouteFnReturnGenerator,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = (
	context: DeveloperContext<
		Stores,
		ExtendsType<
			ExtractUrlParams<Path>,
			NonNullable<unknown>,
			Validators,
			Validators &
				ConditionallyOmit<
					{
						params: ExtractUrlParams<Path>;
					},
					NonNullable<unknown>
				>
		>
	>,
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
						ExtendsType<
							ExtractUrlParams<Path>,
							NonNullable<unknown>,
							MergeInferValidatorRequest<
								Validators,
								DeepInferValidatorOutput<
									_ValidatorOptions["request"]
								>
							>,
							MergeInferValidatorRequest<
								Validators,
								DeepInferValidatorOutput<
									_ValidatorOptions["request"]
								>
							> &
								ConditionallyOmit<
									{
										params: ExtractUrlParams<Path>;
									},
									NonNullable<unknown>
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
	method: Method;
	path: Path;
	type: "ROUTE";
	validator?: AnyValidator | undefined;
}

export type AnyRoute = Route<any, any, any, any, any, any>;

export interface RouteOptions<
	_ValidatorOptions extends ValidatorOptions<Partial<ValidatorRequest>>,
> {
	validator?: _ValidatorOptions;
}

export type AnyRouteOptions = RouteOptions<any>;

type Constructor = new (
	method: HttpMethod,
	path: `/${string}`,
	route: AnyRouteFn,
	options: AnyRouteOptions,
) => AnyRoute;

export const Route = function (
	this: AnyRoute,
	method: HttpMethod,
	path: `/${string}`,
	route: AnyRouteFn,
	{ validator }: AnyRouteOptions = new Empty(),
) {
	this.generator = route.constructor.name.indexOf("GeneratorFunction") !== -1;
	this.method = method;
	this.path = path;
	this.route = route;
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
						ExtendsType<
							ExtractUrlParams<Path>,
							NonNullable<unknown>,
							MergeInferValidatorRequest<
								Validators,
								DeepInferValidatorOutput<
									_ValidatorOptions["request"]
								>
							>,
							MergeInferValidatorRequest<
								Validators,
								DeepInferValidatorOutput<
									_ValidatorOptions["request"]
								>
							> &
								ConditionallyOmit<
									{
										params: ExtractUrlParams<Path>;
									},
									NonNullable<unknown>
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
	route: RouteFn<
		Method,
		Path,
		Return,
		Stores,
		MergeInferValidatorRequest<
			Validators,
			DeepInferValidatorOutput<_ValidatorOptions["request"]>
		>
	>,
	options: RouteOptions<_ValidatorOptions> = new Empty(),
) => {
	return new Route(method, path, route, options) as Route<
		Method,
		Path,
		Return,
		Stores,
		_ValidatorOptions,
		Validators
	>;
};
