import type { DeveloperContext } from "@/core/context";
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
 * @module
 * Route types — handler signatures, the compiled descriptor, and the helpers
 * that lift a route declaration into the client-facing route tree.
 */

/**
 * Lift a slash-separated `Path` literal into a nested record whose deepest
 * leaf carries `Value`.
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
 * Compose a single route declaration into the nested record the client-facing
 * route tree expects, keyed by lower-cased method at the deepest leaf (root
 * `"/"` becomes `"index"`).
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
 * Distinguish a route descriptor leaf from a path-segment branch.
 */
export type IsRouteLeaf<T> = T extends { method: string; path: string }
	? true
	: false;

/**
 * Deeply merge two route trees; on a duplicate route the first tree's
 * descriptor wins.
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
			? [IsRouteLeaf<T[K]>, IsRouteLeaf<U[K]>] extends [true, true]
				? T[K]
				: [IsRouteLeaf<T[K]>, IsRouteLeaf<U[K]>] extends [false, false]
					? T[K] extends object
						? U[K] extends object
							? MergeRoutes<T[K], U[K]>
							: T[K] & U[K]
						: T[K] & U[K]
					: T[K] & U[K]
			: T[K]
		: K extends keyof U
			? U[K]
			: never;
};

/**
 * Envelope a streaming route can emit — an {@link AnyFail} or an
 * {@link AnyOk}.
 *
 * @example
 * ```typescript
 * const a: RouteFnReturnGeneratorEnvelope = ok({ a: "v1" });
 * ```
 */
export type RouteFnReturnGeneratorEnvelope = AnyFail | AnyOk;

/**
 * Single frame yielded by a streaming route — a {@link GeneratorSSE} carrying
 * a {@link RouteFnReturnGeneratorEnvelope}.
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
 * Sync or async generator returned by a streaming route. Yields a
 * {@link RouteFnReturnGeneratorFrame} per chunk and may `return` a final
 * {@link RouteFnReturnGeneratorEnvelope}.
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
	| Generator<
			RouteFnReturnGeneratorFrame,
			RouteFnReturnGeneratorEnvelope | undefined
	  >
	| AsyncGenerator<
			RouteFnReturnGeneratorFrame,
			RouteFnReturnGeneratorEnvelope | undefined
	  >;

/**
 * Augment a validator map with a `params` slot inferred from `Path` when the
 * pattern declares URL parameters; otherwise pass the map through unchanged. A
 * `params` slot already declared by a validator wins.
 *
 * @example
 * ```typescript
 * type A = ValidatorsWithParams<"/a/:p1", { body: { a: string } }>;
 * // { body: { a: string }; params: { p1: string } }
 *
 * type B = ValidatorsWithParams<"/a/b", { body: { a: string } }>;
 * // { body: { a: string } }
 *
 * type C = ValidatorsWithParams<"/a/:p1", { params: { p1: number } }>;
 * // { params: { p1: number } }
 * ```
 */
export type ValidatorsWithParams<
	Path extends string,
	Validators extends Record<PropertyKey, unknown>,
> =
	ExtractUrlParams<Path> extends infer Params
		? [NonNullable<unknown>] extends [Params]
			? Validators
			: Merge<{ params: Params }, Validators>
		: never;

/**
 * Function signature of a route handler. Receives a typed
 * {@link DeveloperContext} and returns a sync or async `AnyFail | AnyOk`
 * envelope, or a {@link RouteFnReturnGenerator} for streaming.
 *
 * @example
 * ```typescript
 * const fn: RouteFn<
 *   "/a/:p1",
 *   MaybePromise<AnyOk>,
 *   NonNullable<unknown>,
 *   NonNullable<unknown>
 * > = (context) => ok({ a: context.request.params.p1 });
 * ```
 */
export type RouteFn<
	Path extends `/${string}`,
	Return extends MaybePromise<AnyFail | AnyOk> | RouteFnReturnGenerator,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = (
	context: DeveloperContext<Stores, ValidatorsWithParams<Path, Validators>>,
) => Return;

/**
 * Any {@link RouteFn} regardless of its generics. Use it where the concrete
 * method, path, and inputs are irrelevant.
 *
 * @example
 * ```typescript
 * const fn: AnyRouteFn = (context) =>
 *   ok({ a: context.request.raw.url });
 * ```
 */
export type AnyRouteFn = RouteFn<any, any, any, any>;

/**
 * Compiled route descriptor stored on the chain, tagged `type: "ROUTE"`.
 *
 * @example
 * ```typescript
 * const a: AnyRoute = {
 *   method: "GET",
 *   path: "/a",
 *   handler: () => ok({ a: "v1" }),
 *   sse: false,
 *   static: true,
 *   type: "ROUTE",
 * };
 * ```
 */
export interface Route<
	Method extends HttpMethod,
	Path extends `/${string}`,
	Return extends MaybePromise<AnyFail | AnyOk> | RouteFnReturnGenerator,
	Stores extends Record<PropertyKey, unknown>,
	RouteValidatorOptions extends ValidatorOptions<Partial<ValidatorRequest>>,
	Validators extends Record<PropertyKey, unknown>,
> {
	handler: RouteFn<
		Path,
		Return,
		Stores,
		MergeInferValidatorRequest<
			Validators,
			DeepInferValidatorOutput<RouteValidatorOptions["request"]>
		>
	>;
	jit?: boolean | undefined;
	method: Method;
	path: Path;
	sse: boolean;
	static: boolean;
	type: "ROUTE";
	validator?: AnyValidator | undefined;
}

/**
 * Any {@link Route} regardless of its generics. Use it where the concrete
 * generics are irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyRoute[] = [];
 * ```
 */
export type AnyRoute = Route<any, any, any, any, any, any>;

/**
 * Value accepted by `module.route` for the handler argument — either a
 * {@link RouteFn} or the already-built {@link AnyFail}/{@link AnyOk} envelope
 * it would return.
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
 * Any {@link RouteHandler} regardless of its generics. Use it where the
 * concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const fn = (handler: AnyRouteHandler) => handler;
 * ```
 */
export type AnyRouteHandler = RouteHandler<any, any, any, any>;

/**
 * Options object accepted as the trailing argument to `module.route` — a
 * per-route `jit` override and a route-scoped {@link ValidatorOptions}.
 *
 * @example
 * ```typescript
 * const a: RouteOptions<{ request: { body: SomeSchema } }> = {
 *   jit: true,
 *   validator: { request: { body: someSchema } },
 * };
 * ```
 */
export interface RouteOptions<
	RouteValidatorOptions extends ValidatorOptions<Partial<ValidatorRequest>>,
> {
	jit?: boolean;
	validator?: RouteValidatorOptions;
}

/**
 * Any {@link RouteOptions} regardless of its validator generics. Use it where
 * the concrete validator shape is irrelevant.
 *
 * @example
 * ```typescript
 * const fn = (options: AnyRouteOptions) => options.jit;
 * ```
 */
export type AnyRouteOptions = RouteOptions<any>;
