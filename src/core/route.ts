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
 * Route descriptor — handler signatures, options bag, and the nested-object
 * representation used to derive type-level route maps.
 */

/**
 * Distribute a slash-separated path into a chain of nested record types
 * whose leaf carries `Value`.
 *
 * Splits the path on the first `/` and recurses through
 * `${infer First}/${infer Rest}`, wrapping each segment as a
 * `Record<Segment, ...>` whose value is the recursive result. The base
 * case — a path with no remaining separator — produces
 * `Record<Path, Value>`. The resulting shape mirrors how the runtime
 * stores routes in a tree keyed by path segment, so consumers can index
 * the map segment-by-segment instead of re-parsing the full pattern.
 *
 * @typeParam Path - Slash-separated path to distribute. Must be a string
 *   literal type for the splitter to make progress.
 * @typeParam Value - Type placed at the deepest record.
 * @example
 * ```typescript
 * type A = PathToObject<"users", true>;
 * // { users: true }
 *
 * type B = PathToObject<"users/:id", true>;
 * // { users: { ":id": true } }
 *
 * type C = PathToObject<"a/b/c", { hit: 1 }>;
 * // { a: { b: { c: { hit: 1 } } } }
 * ```
 */
export type PathToObject<
	Path extends string,
	Value,
> = Path extends `${infer First}/${infer Rest}`
	? Record<First, PathToObject<Rest, Value>>
	: Record<Path, Value>;

/**
 * Build the canonical nested representation of a single route declaration.
 *
 * Strips the leading `/` from `Path` before distributing it via
 * {@link PathToObject}, and maps the root path `"/"` to the synthetic
 * `"index"` key so the route tree always uses non-empty string segments
 * as keys. The leaf carries a record keyed by the lower-cased method
 * name and valued with the route's runtime metadata — original-case
 * `method`, full `path`, plus the inferred `request` and `response`
 * envelopes — so consumers can index `tree[...][lowercase]` to retrieve
 * a single handler descriptor.
 *
 * @typeParam Method - HTTP method literal. Used both as the discriminant
 *   key (lower-cased) and as the value of `method` (upper-cased).
 * @typeParam Path - Route pattern starting with `/`.
 * @typeParam Request - Inferred request envelope flowing into the handler.
 * @typeParam Response - Inferred response envelope flowing out of the
 *   handler.
 * @example
 * ```typescript
 * type A = ParseRoute<"GET", "/", { q: string }, { ok: true }>;
 * // { index: { get: { method: "GET"; path: "/"; request: { q: string }; response: { ok: true } } } }
 *
 * type B = ParseRoute<"POST", "/users/:id", unknown, unknown>;
 * // { users: { ":id": { post: { method: "POST"; path: "/users/:id"; ... } } } }
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
 * Alias for the Bun WebSocket handler shape parameterized by the route's
 * developer context.
 *
 * Routes registered with `"WS"` as their method must return a value of
 * this type. The `Context` generic carries the framework's per-connection
 * {@link DeveloperContext} — stores and validators — already trimmed of
 * the `response` slot since WebSocket handlers communicate exclusively
 * through the socket lifecycle callbacks rather than committing a single
 * response envelope.
 *
 * @typeParam Context - Developer context exposed to each socket callback.
 * @example
 * ```typescript
 * type A = RouteFnReturnWS<{ session: string }>;
 * // Bun.WebSocketHandler<{ session: string }>
 *
 * type B = keyof NonNullable<RouteFnReturnWS<{}>["message"]>;
 * // (the parameter list of the inbound-message lifecycle callback)
 * ```
 */
export type RouteFnReturnWS<Context> = Bun.WebSocketHandler<Context>;

/**
 * Union of synchronous and asynchronous generators that yield server-sent
 * event frames and terminate with an error or success envelope.
 *
 * Each yielded value is a {@link GeneratorSSE} payload carrying an
 * `AnyError` or `AnySuccess` envelope, so the streaming protocol preserves
 * the same discriminant as non-streaming routes. The generator's return
 * type — the value produced when iteration finishes — is the final
 * envelope to commit, or `undefined` when the stream ended without one.
 * @example
 * ```typescript
 * type A = RouteFnReturnGenerator;
 * // Generator<GeneratorSSE<AnyError | AnySuccess, string>, AnyError | AnySuccess | undefined>
 * //   | AsyncGenerator<GeneratorSSE<AnyError | AnySuccess, string>, AnyError | AnySuccess | undefined>
 *
 * type B = ReturnType<() => RouteFnReturnGenerator> extends RouteFnReturnGenerator
 * 	? true
 * 	: false;
 * // true — covers both sync and async generators in one slot
 * ```
 */
export type RouteFnReturnGenerator =
	| Generator<
			GeneratorSSE<AnyError | AnySuccess, string>,
			AnyError | AnySuccess | undefined
	  >
	| AsyncGenerator<
			GeneratorSSE<AnyError | AnySuccess, string>,
			AnyError | AnySuccess | undefined
	  >;

/**
 * Augment a validators record with a `params` slot derived from `Path`,
 * skipping the augmentation when the path has no URL parameters.
 *
 * Calls {@link ExtractUrlParams} on `Path` and inspects the result with a
 * pair of `[NonNullable<unknown>]` probes — a known trick to detect an
 * empty object type without distributing over its members. When the
 * extracted record is non-empty the result intersects `Validators` with
 * `{ params: Params }`; when it is empty the validators record passes
 * through unchanged, so routes without URL parameters do not pay a
 * `params` slot they would never populate.
 *
 * @typeParam Path - Route pattern; supplies the `params` shape via
 *   {@link ExtractUrlParams}.
 * @typeParam Validators - Caller-provided validators record (`body`,
 *   `query`, etc.) that may also receive a `params` augmentation.
 * @example
 * ```typescript
 * type A = ValidatorsWithParams<"/users", { query: { q: string } }>;
 * // { query: { q: string } }
 *
 * type B = ValidatorsWithParams<"/users/:id", { query: { q: string } }>;
 * // { query: { q: string } } & { params: { id: string } }
 * ```
 */
export type ValidatorsWithParams<
	Path extends string,
	Validators extends Record<PropertyKey, unknown>,
> =
	ExtractUrlParams<Path> extends infer Params
		? [Params] extends [NonNullable<unknown>]
			? [NonNullable<unknown>] extends [Params]
				? Validators
				: Validators & { params: Params }
			: Validators & { params: Params }
		: never;

/**
 * Function signature accepted as a route handler.
 *
 * The handler receives a {@link DeveloperContext} parameterized with the
 * route's `Stores` and the {@link ValidatorsWithParams}-augmented
 * `Validators`. The `Return` parameter is constrained by `Method`:
 *
 * - `"WS"` — must return {@link RouteFnReturnWS} over the same context
 *   with `response` omitted, since WebSocket routes do not commit a
 *   single response envelope.
 * - Any other method — must return `MaybePromise<AnyError | AnySuccess>`
 *   for unary routes, or a {@link RouteFnReturnGenerator} for streaming
 *   ones.
 *
 * The `Return` constraint references `Stores` and `Validators` before
 * they are declared positionally; TypeScript resolves the constraint
 * lazily, so the order is intentional rather than a typo.
 *
 * @typeParam Method - HTTP method (or `"WS"`) the handler serves.
 * @typeParam Path - Route pattern, used to derive the `params` validator.
 * @typeParam Return - Concrete return type, constrained by `Method`.
 * @typeParam Stores - Store dictionary surfaced through the context.
 * @typeParam Validators - Validator shape carried alongside the context.
 * @example
 * ```typescript
 * type A = RouteFn<
 * 	"GET",
 * 	"/users/:id",
 * 	Promise<AnySuccess>,
 * 	{},
 * 	{}
 * >;
 * // (context: DeveloperContext<{}, { params: { id: string } }>) => Promise<AnySuccess>
 *
 * type B = RouteFn<"GET", "/", Promise<AnySuccess>, {}, {}>;
 * // (context: DeveloperContext<{}, {}>) => Promise<AnySuccess>  (no `params` slot)
 *
 * type C = RouteFn<
 * 	"WS",
 * 	"/chat",
 * 	RouteFnReturnWS<Omit<DeveloperContext<{}, {}>, "response">>,
 * 	{},
 * 	{}
 * >;
 * // (context: …) => Bun.WebSocketHandler<…>
 * ```
 */
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

/**
 * Convenience alias matching any {@link RouteFn} regardless of generics.
 *
 * Reach for it in container or registry types where the concrete
 * parameters are irrelevant — for example, when storing handlers in a
 * collection that mixes methods, paths, and validator shapes.
 */
export type AnyRouteFn = RouteFn<any, any, any, any, any>;

/**
 * Descriptor produced when a module registers a single route on its
 * chain.
 *
 * Bundles the handler with the runtime metadata needed to dispatch
 * requests:
 *
 * - `generator` — set from `isGenerator` at registration time; `true`
 *   when the handler is a `function*` or `async function*` and the
 *   runtime must drive it through the streaming dispatch path.
 * - `jit` — opt-in flag for lazy compilation. When `undefined` the
 *   module-level policy applies; the compile step normalizes it to a
 *   boolean.
 * - `method`, `path` — routing keys, mirroring the parameters that
 *   produced the descriptor.
 * - `route` — the {@link RouteFn} itself, with `Validators` already
 *   merged with the inferred output of `_ValidatorOptions["request"]`.
 *   When the caller registers a bare envelope instead of a function the
 *   registration code wraps it in a thunk, so this slot always holds a
 *   `RouteFn`.
 * - `static` — `true` only for non-WS routes registered with a bare
 *   envelope (no function, no per-request work). The compile step uses
 *   it to short-circuit JIT compilation when the response is
 *   precomputed.
 * - `type` — literal `"ROUTE"` discriminant that distinguishes route
 *   entries from other module-chain node kinds.
 * - `validator` — compiled validator instance, or `undefined` when none
 *   was supplied.
 *
 * @typeParam Method - HTTP method (or `"WS"`) the route serves.
 * @typeParam Path - Route pattern starting with `/`.
 * @typeParam Return - Concrete return type, constrained by `Method` and
 *   propagated through the embedded {@link RouteFn}.
 * @typeParam Stores - Store dictionary surfaced through the context.
 * @typeParam _ValidatorOptions - Validator options bag whose `request`
 *   slot is inferred and merged into the validator types reaching the
 *   handler. Leading underscore signals an inference-only parameter —
 *   callers do not supply it explicitly.
 * @typeParam Validators - Caller-provided validators record. Merged with
 *   the inferred `_ValidatorOptions["request"]` output before reaching
 *   the handler.
 * @example
 * ```typescript
 * type A = Route<
 * 	"GET",
 * 	"/users/:id",
 * 	Promise<AnySuccess>,
 * 	{},
 * 	ValidatorOptions<{}>,
 * 	{}
 * >;
 * // {
 * //   generator: boolean;
 * //   jit?: boolean | undefined;
 * //   method: "GET";
 * //   path: "/users/:id";
 * //   route: RouteFn<"GET", "/users/:id", Promise<AnySuccess>, {}, { params: { id: string } }>;
 * //   static: boolean;
 * //   type: "ROUTE";
 * //   validator?: AnyValidator | undefined;
 * // }
 *
 * type B = A["type"];   // "ROUTE"
 * type C = A["method"]; // "GET"
 * ```
 */
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
	jit?: boolean | undefined;
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

/**
 * Convenience alias matching any {@link Route} regardless of generics.
 *
 * Useful inside the runtime where route descriptors are stored in
 * heterogeneous collections keyed by path or method.
 */
export type AnyRoute = Route<any, any, any, any, any, any>;

/**
 * Union accepted at the registration site: either a {@link RouteFn} or
 * the bare envelope it would have returned.
 *
 * Routes that always commit the same value can be registered with the
 * envelope directly, bypassing the boilerplate of writing a handler
 * whose body is just `return success(...)`. The bare-envelope branch
 * extracts the `AnyError | AnySuccess` portion of `Awaited<Return>`, so
 * generator- and WebSocket-returning shapes are not silently accepted as
 * inert values.
 *
 * @typeParam Method - HTTP method (or `"WS"`) the route serves.
 * @typeParam Path - Route pattern; supplies the `params` validator shape.
 * @typeParam Return - Concrete return type, constrained by `Method`. Used
 *   to derive both the function variant and the bare-envelope variant.
 * @typeParam Stores - Store dictionary surfaced through the context.
 * @typeParam Validators - Validator shape carried alongside the context.
 * @example
 * ```typescript
 * type A = RouteHandler<"GET", "/", Promise<AnySuccess>, {}, {}>;
 * // RouteFn<"GET", "/", Promise<AnySuccess>, {}, {}> | AnySuccess
 *
 * type B = AnySuccess extends RouteHandler<"GET", "/", Promise<AnySuccess>, {}, {}>
 * 	? true
 * 	: false;
 * // true — bare envelopes are accepted alongside function handlers
 *
 * type C = AnyError extends RouteHandler<"GET", "/", Promise<AnySuccess>, {}, {}>
 * 	? true
 * 	: false;
 * // false — only the awaited member of `Return` flows into the bare branch
 * ```
 */
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

/**
 * Convenience alias matching any {@link RouteHandler} regardless of
 * generics.
 */
export type AnyRouteHandler = RouteHandler<any, any, any, any, any>;

/**
 * Options bag accepted alongside a route handler at registration time.
 *
 * - `jit` — opt the route into lazy compilation. When omitted the
 *   module-level policy applies, normalized by the compile step.
 * - `validator` — validator options whose `request` slot is inferred and
 *   merged into the handler's validators record by {@link Route}.
 *
 * @typeParam _ValidatorOptions - Validator options shape. The leading
 *   underscore marks it as an inference-only parameter — callers do not
 *   supply it explicitly; the type is inferred from the `validator`
 *   property.
 * @example
 * ```typescript
 * type A = RouteOptions<ValidatorOptions<{ body: never }>>;
 * // { jit?: boolean; validator?: ValidatorOptions<{ body: never }> }
 *
 * type B = RouteOptions<ValidatorOptions<{}>>["jit"];
 * // boolean | undefined
 *
 * type C = RouteOptions<ValidatorOptions<{}>>["validator"];
 * // ValidatorOptions<{}> | undefined
 * ```
 */
export interface RouteOptions<
	_ValidatorOptions extends ValidatorOptions<Partial<ValidatorRequest>>,
> {
	jit?: boolean;
	validator?: _ValidatorOptions;
}

/**
 * Convenience alias matching any {@link RouteOptions} regardless of
 * generics.
 */
export type AnyRouteOptions = RouteOptions<any>;
