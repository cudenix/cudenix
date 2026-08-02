import type { Context } from "@/core/context";
import type { AnyFail, AnyOk } from "@/core/reply";
import type {
	AnyValidator,
	DeepInferValidatorOutput,
	MergeInferValidatorRequest,
	ValidatorOptions,
	ValidatorRequest,
} from "@/core/validator";
import type { ExtractUrlParams } from "@/utils/types/extract-url-params";
import type { GeneratorSSE } from "@/utils/types/generator-sse";
import type { HttpMethod } from "@/utils/types/http-method";
import type { MaybePromise } from "@/utils/types/maybe-promise";
import type { Merge } from "@/utils/types/merge";

/**
 * Converts a path into a nested object.
 *
 * @example
 * ```typescript
 * type A = PathToObject<"a/b/c", "v1">;
 * // { a: { b: { c: "v1" } } }
 *
 * type B = PathToObject<"a", "v1">; // { a: "v1" }
 * ```
 */
export type PathToObject<
	Path extends string,
	Value,
> = Path extends `${infer First}/${infer Rest}`
	? Record<First, PathToObject<Rest, Value>>
	: Record<Path, Value>;

/**
 * Converts a route into the client route tree.
 *
 * @example
 * ```typescript
 * type A = ParseRoute<"GET", "/a/b", { body: "v1" }, { 200: "v2" }>;
 * // {
 * //   a: { b: { get: {
 * //     method: "GET";
 * //     path: "/a/b";
 * //     request: { body: "v1" };
 * //     response: { 200: "v2" };
 * //   } } }
 * // }
 *
 * type B = ParseRoute<"POST", "/", unknown, unknown>;
 * // { index: { post: { method: "POST"; path: "/"; request: unknown; response: unknown } } }
 * ```
 */
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

/**
 * Distinguishes a route descriptor leaf from a path-segment branch.
 */
type IsRouteLeaf<T> = T extends { method: string; path: string } ? true : false;

/**
 * Merges two route trees with left-side precedence.
 *
 * @example
 * ```typescript
 * type A = MergeRoutes<
 *   { a: { get: { method: "GET"; path: "/a"; request: unknown; response: { 200: "v1" } } } },
 *   { a: { get: { method: "GET"; path: "/a"; request: unknown; response: { 200: "v2" } } } }
 * >;
 * // { a: { get: { method: "GET"; path: "/a"; request: unknown; response: { 200: "v1" } } } }
 * ```
 */
export type MergeRoutes<T extends object, U extends object> = {
	[K in keyof T | keyof U]: K extends keyof T
		? K extends keyof U
			? // cache both nodes for the leaf and branch checks
				T[K] extends infer Left
				? U[K] extends infer Right
					? [IsRouteLeaf<Left>, IsRouteLeaf<Right>] extends [
							true,
							true,
						]
						? Left
						: [IsRouteLeaf<Left>, IsRouteLeaf<Right>] extends [
									false,
									false,
								]
							? [Left, Right] extends [
									infer LeftObject extends object,
									infer RightObject extends object,
								]
								? MergeRoutes<LeftObject, RightObject>
								: Left & Right
							: Left & Right
					: never
				: never
			: T[K]
		: K extends keyof U
			? U[K]
			: never;
};

/**
 * Reply envelope emitted by a streaming route.
 *
 * @example
 * ```typescript
 * const a: RouteFnReturnGeneratorEnvelope = ok({ a: "v1" });
 * ```
 */
export type RouteFnReturnGeneratorEnvelope = AnyFail | AnyOk;

/**
 * SSE frame yielded by a streaming route.
 *
 * @example
 * ```typescript
 * const a: RouteFnReturnGeneratorFrame = {
 *   data: ok({ a: "v1" }),
 *   event: "message",
 * };
 * ```
 */
export type RouteFnReturnGeneratorFrame = GeneratorSSE<
	RouteFnReturnGeneratorEnvelope,
	string
>;

/**
 * Value a streaming route may return once its generator completes.
 */
type RouteFnReturnGeneratorResult =
	| RouteFnReturnGeneratorEnvelope
	| undefined
	| void;

/**
 * Generator returned by a streaming route.
 *
 * @example
 * ```typescript
 * const fn = async function* (): RouteFnReturnGenerator {
 *   yield { data: ok({ a: "v1" }) };
 *   yield { data: ok({ a: "v2" }) };
 *
 *   return ok({ a: "v3" });
 * };
 * ```
 */
export type RouteFnReturnGenerator =
	| Generator<RouteFnReturnGeneratorFrame, RouteFnReturnGeneratorResult>
	| AsyncGenerator<RouteFnReturnGeneratorFrame, RouteFnReturnGeneratorResult>;

/**
 * Adds inferred URL parameters to a validator map.
 */
type ValidatorsWithParams<
	Path extends string,
	Validators extends Record<PropertyKey, unknown>,
> =
	ExtractUrlParams<Path> extends infer Params
		? [Params] extends [never]
			? never
			: [Params extends unknown ? keyof Params : never] extends [never]
				? Validators
				: Merge<{ params: Params }, Validators>
		: never;

/**
 * Defines a typed route handler.
 */
type RouteFn<
	Path extends `/${string}`,
	Return extends MaybePromise<AnyFail | AnyOk> | RouteFnReturnGenerator,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = (
	context: Context<Stores, ValidatorsWithParams<Path, Validators>>,
) => Return;

/**
 * Any {@link RouteFn} regardless of its generics.
 *
 * @example
 * ```typescript
 * const fn: AnyRouteFn = (context) =>
 *   ok({ a: context.request.raw.url });
 * ```
 */
export type AnyRouteFn = RouteFn<any, any, any, any>;

/**
 * Handler accepted by `module.route`.
 *
 * @example
 * ```typescript
 * const fn: RouteHandler<
 *   "/a/:p1",
 *   MaybePromise<AnyOk>,
 *   NonNullable<unknown>,
 *   NonNullable<unknown>
 * > = (context) => ok({ a: context.request.params.p1 });
 *
 * const a: AnyRouteHandler = ok({ a: "v1" }); // static form
 * ```
 */
export type RouteHandler<
	Path extends `/${string}`,
	Return extends MaybePromise<AnyFail | AnyOk> | RouteFnReturnGenerator,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> =
	| RouteFn<Path, Return, Stores, Validators>
	| Extract<Awaited<Return>, AnyFail | AnyOk>;

/**
 * Any {@link RouteHandler} regardless of its generics.
 *
 * @example
 * ```typescript
 * const fn = (handler: AnyRouteHandler) => handler;
 * ```
 */
export type AnyRouteHandler = RouteHandler<any, any, any, any>;

/**
 * Options accepted by `module.route`.
 *
 * @example
 * ```typescript
 * const a: RouteOptions<{ request: { body: SomeSchema } }> = {
 *   validator: { request: { body: someSchema } },
 * };
 * ```
 */
export interface RouteOptions<
	RouteValidatorOptions extends ValidatorOptions<Partial<ValidatorRequest>>,
> {
	validator?: RouteValidatorOptions;
}

/**
 * Any {@link RouteOptions} regardless of its validator generics.
 *
 * @example
 * ```typescript
 * const fn = (options: AnyRouteOptions) => options.validator;
 * ```
 */
export type AnyRouteOptions = RouteOptions<any>;

/**
 * Compiled route descriptor stored on the chain, tagged `type: "ROUTE"`.
 */
interface Route<
	Method extends HttpMethod,
	Path extends `/${string}`,
	Return extends MaybePromise<AnyFail | AnyOk> | RouteFnReturnGenerator,
	Stores extends Record<PropertyKey, unknown>,
	RouteValidatorOptions extends ValidatorOptions<Partial<ValidatorRequest>>,
	Validators extends Record<PropertyKey, unknown>,
> {
	/** Route handler, with a static reply wrapped into a function. */
	handler: RouteFn<
		Path,
		Return,
		Stores,
		MergeInferValidatorRequest<
			Validators,
			DeepInferValidatorOutput<RouteValidatorOptions["request"]>
		>
	>;
	/** HTTP method the route answers. */
	method: Method;
	/** Path appended to the inherited module prefixes. */
	path: Path;
	/** Handler is a generator streamed as SSE. */
	sse: boolean;
	/** Handler was a plain reply, not a function. */
	static: boolean;
	/** Discriminant used when walking the chain. */
	type: "ROUTE";
	/** Per-route validator appended to the route's chain. */
	validator?: AnyValidator | undefined;
}

/**
 * Any {@link Route} regardless of its generics.
 *
 * @example
 * ```typescript
 * const a: AnyRoute[] = [];
 * ```
 */
export type AnyRoute = Route<any, any, any, any, any, any>;
