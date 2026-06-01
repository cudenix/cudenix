import { compile } from "@/core/compile";
import { Context } from "@/core/context";
import { dispatch } from "@/core/dispatch";
import type { AnyMiddleware } from "@/core/middleware";
import type { AnyModule } from "@/core/module";
import type { AnyRoute } from "@/core/route";
import type { AnyStore } from "@/core/store";
import type { AnyValidator } from "@/core/validator";
import { pushAll } from "@/utils/arrays/push-all";
import { Empty, FrozenEmpty } from "@/utils/objects/empty";
import type { HttpMethod } from "@/utils/types/http-method";
import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * @module
 * Central app object — compiles a root {@link AnyModule} into per-method
 * endpoint tables, answers requests through `.fetch()`, and boots a Bun
 * server through `.listen()`. The single entry point an application
 * constructs with `new Cudenix(module)`.
 */

const NOT_FOUND = new Response(undefined, { status: 404 });

/**
 * Flattened run-time link list a single endpoint walks per request — the
 * middlewares, stores, and validators inherited from every enclosing module,
 * with the route's own validator appended last. Built by the compiler from
 * the module tree and stored on each {@link Endpoint}.
 *
 * @example
 * ```typescript
 * const a: Chain = [];
 * ```
 */
export type Chain = (AnyMiddleware | AnyRoute | AnyStore | AnyValidator)[];

/**
 * Compiled endpoint descriptor — one fully-resolved route plus everything the
 * dispatcher needs to match a URL against it and run it. Produced by the
 * compiler while flattening the module tree and grouped under its HTTP method
 * in {@link MethodData}.
 *
 * Fields:
 *
 * - `chain` — the {@link Chain} of inherited links walked before the route
 *   handler runs.
 * - `jit` — resolved JIT flag, the route's own override or the app default.
 * - `matchOffset` — index of this endpoint's capture group inside the shared
 *   per-method regexp, so a single match can report which endpoint hit.
 * - `paramKeys` — names of every `:name` and `...name` segment, in order.
 * - `path` — the absolute pattern, prefixes merged in from enclosing modules.
 * - `restKeys` — names of the rest (`...name`) parameters only.
 * - `route` — the compiled {@link AnyRoute} whose handler produces the
 *   response.
 * - `router` — `"bun"` when the path is static enough to register directly on
 *   Bun's route table, `"cudenix"` when it falls back to regexp matching.
 * - `sse` — `true` when the handler streams Server-Sent Events.
 *
 * @example
 * ```typescript
 * const a: Endpoint = {
 *   chain: [],
 *   jit: true,
 *   matchOffset: 3,
 *   paramKeys: ["p1"],
 *   path: "/a/:p1",
 *   restKeys: [],
 *   route: {
 *     method: "GET",
 *     path: "/a/:p1",
 *     handler: () => new Success("v1"),
 *     sse: false,
 *     static: false,
 *     type: "ROUTE",
 *   },
 *   router: "cudenix",
 *   sse: false,
 * };
 * ```
 */
export interface Endpoint {
	chain: Chain;
	jit: boolean;
	matchOffset: number;
	paramKeys: string[];
	path: string;
	restKeys: string[];
	route: AnyRoute;
	router: "bun" | "cudenix";
	sse: boolean;
}

/**
 * Per-method routing table built by the compiler and read by `.fetch()`. All
 * {@link Endpoint}s sharing one HTTP method are folded into a single combined
 * `regexp`, then the matched capture group is mapped back to the specific
 * endpoint via its `matchOffset`.
 *
 * Fields:
 *
 * - `endpoints` — every endpoint registered under the method, in match order.
 * - `regexp` — the merged pattern matched against the request URL; a hit
 *   means one of the endpoints applies.
 *
 * @example
 * ```typescript
 * const a: MethodData = {
 *   endpoints: [],
 *   regexp: /^(https?:\/\/)[^\s\/]+(\/a)(?![^?#])/,
 * };
 * ```
 */
export interface MethodData {
	endpoints: Endpoint[];
	regexp: RegExp;
}

/**
 * Setup hook registered through `.plugins()`. Each plugin runs once during
 * `.compile()`, after the module tree is flattened, with `this` bound to the
 * {@link Cudenix} app so it can read or seed `memory`. Reach for it to wire
 * cross-cutting concerns — a validator backend, shared services — into the
 * app before it starts serving.
 *
 * @example
 * ```typescript
 * const a: Plugin = function () {
 *   this.memory.validator = someValidator;
 * };
 * ```
 */
export type Plugin = (...options: any[]) => void;

/**
 * Options accepted by the {@link Cudenix} constructor. The `jit` flag sets the
 * app-wide default for per-route JIT compilation, applied whenever a route does
 * not set its own override. Defaults to `true` when omitted.
 *
 * @example
 * ```typescript
 * const a: CudenixOptions = { jit: false };
 * ```
 */
export interface CudenixOptions {
	jit?: boolean;
}

/**
 * Public shape of a Cudenix application instance — the methods that compile,
 * serve, and extend the app plus the run-time state the dispatcher reads. An
 * application builds one with `new Cudenix(module)`, then either drives it
 * through `.fetch()` directly or hands control to Bun via `.listen()`.
 *
 * Methods:
 *
 * - `compile` — flatten the root module into the `methods` and `routes` tables
 *   and run every registered {@link Plugin}; `.listen()` calls it for you.
 * - `fetch` — resolve a `Request` to a `Response`, matching it against the
 *   compiled tables and dispatching the endpoint's chain.
 * - `listen` — compile, then start serving through `Bun.serve`.
 * - `plugins` — register {@link Plugin} hooks to run during the next
 *   `.compile()`.
 *
 * Fields:
 *
 * - `jit` — app-wide JIT default applied to routes without their own
 *   override.
 * - `memory` — scratch dictionary shared with every {@link Context}; holds the
 *   root module and registered plugins until `.compile()` consumes them, plus
 *   anything plugins stash for handlers to read.
 * - `methods` — per-method {@link MethodData} routing tables produced by
 *   `.compile()`.
 * - `routes` — Bun route table for the statically-matchable endpoints, passed
 *   straight to `Bun.serve`.
 * - `server` — the running `Bun.Server`, present only after `.listen()`.
 *
 * @example
 * ```typescript
 * const a: Cudenix = new Cudenix(new Module());
 *
 * a.compile();
 *
 * a.fetch(new Request("http://localhost/a"));
 * ```
 */
export interface Cudenix {
	compile(): void;
	fetch(request: Request): MaybePromise<Response>;
	jit: boolean;
	listen(
		options?: Omit<
			Extract<Bun.Serve.Options<unknown>, { websocket?: never }>,
			"fetch" | "unix"
		>,
	): Omit<Cudenix, "listen">;
	memory: Record<PropertyKey, unknown>;
	methods: Record<HttpMethod, MethodData>;
	plugins(plugins: Plugin[]): Cudenix;
	routes: Record<string, Bun.Serve.Routes<unknown, string>>;
	server?: Bun.Server<unknown>;
}

/**
 * Constructor signature of {@link Cudenix}, declared separately so the
 * runtime value can be defined with a plain `function` and cast to a
 * constructable type.
 *
 * @example
 * ```typescript
 * const Ctor: CudenixConstructor = Cudenix;
 *
 * const a = new Ctor(new Module(), { jit: false });
 *
 * a.jit; // false
 * ```
 */
export interface CudenixConstructor {
	new (module: AnyModule, options?: CudenixOptions): Cudenix;
}

/**
 * Construct a {@link Cudenix} app around a root {@link AnyModule}. Must be
 * invoked with `new`; the instance starts uncompiled, with empty `methods`
 * and `routes` tables and the module parked in `memory` until `.compile()`
 * (or `.listen()`) flattens it.
 *
 * `jit` defaults to `true` when `options` is omitted; {@link FrozenEmpty} is
 * the default options object, so the no-argument path skips a fresh `{}`
 * allocation. `memory`, `methods`, and `routes` are prototype-less
 * {@link Empty} dictionaries to keep lookups free of inherited keys.
 *
 * @param module - Root module whose tree is compiled into the app's routes.
 * @param options - Optional behavior switches; see {@link CudenixOptions}.
 * @example
 * ```typescript
 * const a = new Cudenix(new Module().route("GET", "/a", () => new Success("v1")));
 *
 * a.jit; // true
 *
 * const b = new Cudenix(new Module(), { jit: false });
 *
 * b.jit; // false
 * ```
 */
export const Cudenix = function (
	this: Cudenix,
	module: AnyModule,
	{ jit = true }: CudenixOptions = FrozenEmpty,
) {
	this.jit = jit;
	this.memory = new Empty();
	this.methods = new Empty() as Cudenix["methods"];
	this.routes = new Empty() as Cudenix["routes"];

	this.memory.module = module;
} as unknown as CudenixConstructor;

/**
 * Compile the app — flatten the root module tree into the per-method
 * {@link MethodData} tables and the Bun `routes` table, then run every
 * registered {@link Plugin} once with `this` bound to the app. Call it before
 * the first `.fetch()`; `.listen()` calls it automatically.
 *
 * The root module and the pending plugin list are dropped from `memory` once
 * consumed, so compiling is a one-shot operation.
 *
 * @example
 * ```typescript
 * const a = new Cudenix(new Module().route("GET", "/a", () => new Success("v1")));
 *
 * a.compile();
 *
 * a.fetch(new Request("http://localhost/a"));
 * ```
 */
Cudenix.prototype.compile = function (this: Cudenix) {
	compile(this);

	if ("plugins" in this.memory) {
		const plugins = this.memory.plugins as Plugin[];

		for (let i = 0; i < plugins.length; i++) {
			plugins[i]!.call(this);
		}
	}

	delete this.memory.module;
	delete this.memory.plugins;
};

/**
 * Resolve a request to a `Response`. Looks up the {@link MethodData} for the
 * request method, matches the URL against its merged regexp, then walks the
 * candidate {@link Endpoint}s to find the one whose capture group fired and
 * dispatches its chain. The compiled-but-direct Bun route table handles
 * static paths separately, so this path serves the dynamic and fallback
 * matches.
 *
 * Returns a clone of the shared `404` response whenever the method is
 * unknown, the URL matches nothing, or no endpoint claims the match.
 *
 * @param request - Incoming request to route and run.
 * @returns The handler's `Response`, or a `404` clone on any miss.
 * @example
 * ```typescript
 * const a = new Cudenix(new Module().route("GET", "/a", () => new Success("v1")));
 *
 * a.compile();
 *
 * const b = await a.fetch(new Request("http://localhost/a"));
 *
 * b.status; // 200
 * ```
 */
Cudenix.prototype.fetch = function (this: Cudenix, request: Request) {
	const data = this.methods[request.method as HttpMethod];

	if (!data) {
		return NOT_FOUND.clone();
	}

	const match = data.regexp.exec(request.url);

	if (!match?.[2]) {
		return NOT_FOUND.clone();
	}

	const endpoints = data.endpoints;

	let endpoint: Endpoint | undefined;

	for (let i = 0; i < endpoints.length; i++) {
		const candidate = endpoints[i]!;

		if (match[candidate.matchOffset] !== undefined) {
			endpoint = candidate;

			break;
		}
	}

	if (!endpoint) {
		return NOT_FOUND.clone();
	}

	return dispatch(
		endpoint,
		request,
		new Context(this, endpoint, request, match),
		endpoint.chain,
		0,
	);
};

/**
 * Compile the app and start serving it through `Bun.serve`. Wires the app's
 * own `.fetch()` and `routes` table into the server, defaulting to
 * `development: false` and `reusePort: true` — both overridable through
 * `options`. Registers a `beforeExit` hook that stops the server on shutdown,
 * then runs a one-off `Bun.gc()` pass now that startup is done.
 *
 * `fetch` and `unix` are excluded from `options` because the app supplies its
 * own request handler. The returned reference drops `.listen()` so it cannot
 * be started twice.
 *
 * @param options - Extra `Bun.serve` options merged over the defaults, minus
 *   `fetch` and `unix`.
 * @returns The same app, narrowed to omit `.listen()`.
 * @example
 * ```typescript
 * const a = new Cudenix(new Module().route("GET", "/a", () => new Success("v1")));
 *
 * a.listen({ port: 3000 });
 *
 * a.server?.port; // 3000
 * ```
 */
Cudenix.prototype.listen = function (
	this: Cudenix,
	options?: Omit<
		Extract<Bun.Serve.Options<unknown>, { websocket?: never }>,
		"fetch" | "unix"
	>,
) {
	this.compile();

	this.server = Bun.serve({
		development: false,
		reusePort: true,
		...options,
		fetch: (request) => this.fetch(request),
		routes: this.routes,
	});

	process.once("beforeExit", () => {
		this.server?.stop();
	});

	Bun.gc();

	return this;
};

/**
 * Register one or more {@link Plugin} setup hooks to run during the next
 * `.compile()`. Appends to the pending list — repeated calls accumulate
 * rather than replace — and the hooks fire in registration order once the
 * module tree has been flattened.
 *
 * @param plugins - Setup hooks appended to the app's pending plugin list.
 * @returns The same app, for chaining.
 * @example
 * ```typescript
 * const a = new Cudenix(new Module());
 *
 * a.plugins([
 *   function () {
 *     this.memory.validator = someValidator;
 *   },
 * ]);
 *
 * a.compile();
 * ```
 */
Cudenix.prototype.plugins = function (this: Cudenix, plugins: Plugin[]) {
	if (!("plugins" in this.memory)) {
		this.memory.plugins = [];
	}

	pushAll(this.memory.plugins as Plugin[], plugins);

	return this;
};
