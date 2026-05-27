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
import type { ExtractUrlParams } from "@/types/extract-url-params";
import type { GeneratorSSE } from "@/types/generator-sse";
import type { HttpMethod } from "@/types/http-method";
import type { MaybePromise } from "@/types/maybe-promise";

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
 * Union of the two envelope shapes a streaming route can emit — either an
 * {@link AnyError} or an {@link AnySuccess}. Used as the payload of each
 * {@link RouteFnReturnGeneratorFrame} and as the final return of a
 * {@link RouteFnReturnGenerator}.
 *
 * @example
 * ```typescript
 * const a: RouteFnReturnGeneratorEnvelope = new Success({ a: "v1" });
 * ```
 */
export type RouteFnReturnGeneratorEnvelope = AnyError | AnySuccess;

/**
 * Single frame yielded by a streaming route — a {@link GeneratorSSE} whose
 * payload is restricted to the {@link RouteFnReturnGeneratorEnvelope}
 * discriminant so the success/error tag survives the wire.
 *
 * @example
 * ```typescript
 * const a: RouteFnReturnGeneratorFrame = {
 *   data: new Success({ a: "v1" }),
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
 *   yield { data: new Success({ a: "v1" }) };
 *   yield { data: new Success({ a: "v2" }) };
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
 * segments without a redundant manual `params` validator.
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
 * ```
 */
export type ValidatorsWithParams<
	Path extends string,
	Validators extends Record<PropertyKey, unknown>,
> =
	ExtractUrlParams<Path> extends infer Params
		? [NonNullable<unknown>] extends [Params]
			? Validators
			: Validators & { params: Params }
		: never;

/**
 * Function signature of a route handler. Receives a fully-typed
 * {@link DeveloperContext} — augmented with any URL parameters parsed from
 * `Path` — and returns either a sync or async `AnyError | AnySuccess`
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
 *   MaybePromise<AnySuccess>,
 *   NonNullable<unknown>,
 *   NonNullable<unknown>
 * > = (context) => new Success({ a: context.request.params.p1 });
 * ```
 */
export type RouteFn<
	Path extends `/${string}`,
	Return extends MaybePromise<AnyError | AnySuccess> | RouteFnReturnGenerator,
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
 *   new Success({ a: context.request.raw.url });
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
 * - `generator` — `true` when the handler was a `function*`/`async function*`,
 *   so the dispatcher iterates frames into the SSE encoder.
 * - `jit` — opt-in per-route JIT compilation override. Unset falls back to
 *   the app-level default.
 * - `route` — the always-callable handler. A static envelope handed to
 *   `module.route` is wrapped in a function that returns it before it lands
 *   here.
 * - `static` — `true` when the handler was registered as a value, not a
 *   function; pairs with the wrapped `route` above.
 * - `type` — `"ROUTE"` discriminant the chain walker dispatches on.
 * - `validator` — optional per-route compiled {@link AnyValidator} whose
 *   output threads into the handler's typed `request`.
 *
 * @typeParam Method - HTTP verb the route binds to.
 * @typeParam Path - Route pattern starting with `/`.
 * @typeParam Return - Concrete return type produced by the handler.
 * @typeParam Stores - Cumulative store shape.
 * @typeParam _ValidatorOptions - Per-route validator options, used to refine
 *   `Validators` for the handler's typed context.
 * @typeParam Validators - Cumulative per-slot request map.
 * @example
 * ```typescript
 * const a: AnyRoute = {
 *   generator: false,
 *   method: "GET",
 *   path: "/a",
 *   route: () => new Success({ a: "v1" }),
 *   static: true,
 *   type: "ROUTE",
 * };
 * ```
 */
export interface Route<
	Method extends HttpMethod,
	Path extends `/${string}`,
	Return extends MaybePromise<AnyError | AnySuccess> | RouteFnReturnGenerator,
	Stores extends Record<PropertyKey, unknown>,
	_ValidatorOptions extends ValidatorOptions<Partial<ValidatorRequest>>,
	Validators extends Record<PropertyKey, unknown>,
> {
	generator: boolean;
	jit?: boolean | undefined;
	method: Method;
	path: Path;
	route: RouteFn<
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
 * {@link RouteFn} or the already-built {@link AnyError}/{@link AnySuccess}
 * envelope it would return. The runtime normalizes the static form by
 * wrapping it in a function before storing the route on the chain.
 *
 * @typeParam Path - Route pattern starting with `/`.
 * @typeParam Return - Return type expected from the function form.
 * @typeParam Stores - Cumulative store shape.
 * @typeParam Validators - Cumulative per-slot request map.
 * @example
 * ```typescript
 * const fn: AnyRouteHandler = (context) =>
 *   new Success({ a: context.request.params.p1 });
 *
 * const a: AnyRouteHandler = new Success({ a: "v1" }); // static form
 * ```
 */
export type RouteHandler<
	Path extends `/${string}`,
	Return extends MaybePromise<AnyError | AnySuccess> | RouteFnReturnGenerator,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> =
	| RouteFn<Path, Return, Stores, Validators>
	| Extract<Awaited<Return>, AnyError | AnySuccess>;

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
 * @typeParam _ValidatorOptions - Route-scoped validator options, used to
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
	_ValidatorOptions extends ValidatorOptions<Partial<ValidatorRequest>>,
> {
	jit?: boolean;
	validator?: _ValidatorOptions;
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
