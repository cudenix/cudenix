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
 * Route types — handler signatures accepted by `module.route`, the compiled
 * descriptor stored on the chain, and the helpers that lift a route
 * declaration into the client-facing route tree.
 */

/**
 * Lift a slash-separated `Path` literal into a nested record whose deepest
 * leaf carries `Value`. Each segment becomes one level of nesting. Used by
 * {@link ParseRoute} to fold a flat route declaration into the recursive
 * shape consumed by the type-side route tree.
 *
 * Pass paths already stripped of their leading `/`. Empty segments (`"a//b"`)
 * are not collapsed — they yield a record with an empty-string key in the
 * middle.
 *
 * @typeParam Path - Slash-separated path literal.
 * @typeParam Value - Type placed at the deepest leaf.
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
 * route tree expects. The root `"/"` is rekeyed to `"index"`, any other path
 * has its leading `/` stripped, and the deepest leaf is keyed by the
 * lower-cased method and carries the method, path, request, and response
 * metadata.
 *
 * @typeParam Method - HTTP verb the route binds to. Lower-cased on the leaf.
 * @typeParam Path - Route pattern starting with `/`.
 * @typeParam Request - Inferred request shape (body, query, params, …).
 * @typeParam Response - Inferred response shape (status-keyed envelope map).
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
 * Distinguish a route descriptor leaf from a path-segment branch. Only leaves
 * carry string-valued `method`/`path` fields; branch nodes map segment names
 * to further records.
 */
export type IsRouteLeaf<T> = T extends { method: string; path: string }
	? true
	: false;

/**
 * Deeply merge two route trees, resolving each shared key by what the runtime
 * router actually serves. Unlike `T & U`, a duplicate route does not intersect
 * the two descriptors into an impossible merged response.
 *
 * - Shared key, both leaves — duplicate registration of the same method and
 *   path: the first tree's descriptor wins, mirroring the runtime, which only
 *   ever serves the first registration.
 * - Shared key, both branches: merged recursively.
 * - Shared key, leaf on one side and branch on the other (a segment named
 *   like a method): intersected, since both the descriptor and the deeper
 *   routes are served.
 * - Exclusive keys pass through unchanged.
 *
 * @typeParam T - Route tree accumulated so far. Wins on duplicate leaves.
 * @typeParam U - Route tree contributed by the new registration.
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
 * Union of the two envelope shapes a streaming route can emit — either an
 * {@link AnyFail} or an {@link AnyOk}. Used as the payload of each
 * {@link RouteFnReturnGeneratorFrame} and as the final return of a
 * {@link RouteFnReturnGenerator}.
 *
 * @example
 * ```typescript
 * const a: RouteFnReturnGeneratorEnvelope = ok({ a: "v1" });
 * ```
 */
export type RouteFnReturnGeneratorEnvelope = AnyFail | AnyOk;

/**
 * Single frame yielded by a streaming route — a {@link GeneratorSSE} whose
 * payload is restricted to the {@link RouteFnReturnGeneratorEnvelope}
 * discriminant so the success/error tag survives the wire.
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
 * {@link RouteFnReturnGeneratorFrame} per chunk and may optionally `return`
 * a final {@link RouteFnReturnGeneratorEnvelope} that becomes the closing
 * value of the stream.
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
 * pattern declares any URL parameters; otherwise pass the map through
 * unchanged. Lets a route handler's typed context surface `:name`/`...name`
 * segments without a redundant manual `params` validator. A `params` slot
 * already declared by a validator wins wholesale, mirroring the runtime,
 * where the validator's output replaces the slot.
 *
 * @typeParam Path - Route pattern parsed by {@link ExtractUrlParams}.
 * @typeParam Validators - Existing per-slot validator map.
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
 * Function signature of a route handler. Receives a fully-typed
 * {@link DeveloperContext} — augmented with any URL parameters parsed from
 * `Path` — and returns either a sync or async `AnyFail | AnyOk`
 * envelope, or a {@link RouteFnReturnGenerator} for streaming.
 *
 * @typeParam Path - Route pattern. Drives the inferred `params` slot.
 * @typeParam Return - Concrete return type the handler produces.
 * @typeParam Stores - Cumulative store shape threaded from `module.store`.
 * @typeParam Validators - Cumulative per-slot request map threaded from
 *   prior validators.
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
 * Wildcard alias matching any {@link RouteFn} regardless of generics. Reach
 * for it on chain or registry types where the concrete method, path, and
 * inputs are irrelevant.
 *
 * @example
 * ```typescript
 * const fn: AnyRouteFn = (context) =>
 *   ok({ a: context.request.raw.url });
 * ```
 */
export type AnyRouteFn = RouteFn<any, any, any, any>;

/**
 * Compiled route descriptor stored on the chain. Holds the static metadata
 * (`method`, `path`, `type: "ROUTE"`) plus the normalized handler the
 * runtime invokes per request, with flags that tell the dispatcher how to
 * call it.
 *
 * Fields:
 *
 * - `handler` — the always-callable handler. A static envelope handed to
 *   `module.route` is wrapped in a function that returns it before it lands
 *   here.
 * - `jit` — opt-in per-route JIT compilation override. Unset falls back to
 *   the app-level default.
 * - `method` — HTTP verb the route binds to.
 * - `path` — route pattern starting with `/`.
 * - `sse` — `true` when the handler was a `function*`/`async function*`,
 *   so the dispatcher iterates frames into the SSE encoder.
 * - `static` — `true` when the handler was registered as a value, not a
 *   function; pairs with the wrapped `handler` above.
 * - `type` — `"ROUTE"` discriminant the chain walker dispatches on.
 * - `validator` — optional per-route compiled {@link AnyValidator} whose
 *   output threads into the handler's typed `request`.
 *
 * @typeParam Method - HTTP verb the route binds to.
 * @typeParam Path - Route pattern starting with `/`.
 * @typeParam Return - Concrete return type produced by the handler.
 * @typeParam Stores - Cumulative store shape.
 * @typeParam RouteValidatorOptions - Per-route validator options, used to refine
 *   `Validators` for the handler's typed context.
 * @typeParam Validators - Cumulative per-slot request map.
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
 * Wildcard alias matching any {@link Route} regardless of generics. Used in
 * container or chain types where the concrete generics are irrelevant — for
 * example, the union of link kinds walked by the dispatcher.
 *
 * @example
 * ```typescript
 * const a: AnyRoute[] = []; // chain slot for any registered route
 * ```
 */
export type AnyRoute = Route<any, any, any, any, any, any>;

/**
 * Value accepted by `module.route` for the handler argument — either a
 * {@link RouteFn} or the already-built {@link AnyFail}/{@link AnyOk}
 * envelope it would return. The runtime normalizes the static form by
 * wrapping it in a function before storing the route on the chain.
 *
 * @typeParam Path - Route pattern starting with `/`.
 * @typeParam Return - Return type expected from the function form.
 * @typeParam Stores - Cumulative store shape.
 * @typeParam Validators - Cumulative per-slot request map.
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
 * Wildcard alias matching any {@link RouteHandler} regardless of generics.
 * Used by the runtime to accept handler arguments without resolving the
 * caller's concrete generics.
 *
 * @example
 * ```typescript
 * const fn = (handler: AnyRouteHandler) => handler;
 * ```
 */
export type AnyRouteHandler = RouteHandler<any, any, any, any>;

/**
 * Options object accepted as the trailing argument to `module.route`.
 *
 * - `jit` — opt-in JIT compilation override for this single route. Unset
 *   falls back to the app-level default.
 * - `validator` — route-scoped {@link ValidatorOptions} whose request map
 *   refines the handler's typed `request` slot via
 *   {@link MergeInferValidatorRequest}.
 *
 * @typeParam RouteValidatorOptions - Route-scoped validator options, used to
 *   drive the handler's typed context.
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
 * Wildcard alias matching any {@link RouteOptions} regardless of generics.
 * Reach for it where the concrete validator shape is irrelevant — for
 * example, the runtime body of `module.route`, which only reads the option
 * fields it dispatches on.
 *
 * @example
 * ```typescript
 * const fn = (options: AnyRouteOptions) => options.jit;
 * ```
 */
export type AnyRouteOptions = RouteOptions<any>;
