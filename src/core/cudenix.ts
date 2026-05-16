import { compile } from "@/core/compile";
import { Context } from "@/core/context";
import type { AnyMiddleware } from "@/core/middleware";
import type { AnyModule } from "@/core/module";
import type { AnyRoute } from "@/core/route";
import { stepAndRespond } from "@/core/step";
import type { AnyStore } from "@/core/store";
import type { AnyValidator } from "@/core/validator";
import type { MaybePromise } from "@/types/maybe-promise";
import { pushAll } from "@/utils/arrays/push-all";
import { Empty, FreezeEmpty } from "@/utils/objects/empty";

/**
 * @module
 * Application core: routing dispatcher and Bun server wiring.
 */

/**
 * Shared `404 Not Found` response reused for every miss in
 * {@link Cudenix.fetch}.
 *
 * Built once at module load with no body and the canonical status code so
 * the hot path returns the same instance instead of allocating a fresh
 * `Response` per unmatched request.
 */
const NOT_FOUND = new Response(undefined, {
	status: 404,
});

/**
 * Flat list of executable units attached to one endpoint, in declaration
 * order and terminated by the route handler.
 */
export type Chain = (AnyMiddleware | AnyRoute | AnyStore | AnyValidator)[];

/**
 * Compiled descriptor for a single route, produced by
 * {@link Cudenix.compile} and consumed by the runtime on every request.
 */
export interface Endpoint {
	chain: Chain;
	jit: boolean;
	matchOffset?: number;
	paramKeys?: string[];
	path: string;
	restKeys?: string[];
	route: AnyRoute;
	use: number;
}

/**
 * Routing data shared by every endpoint registered under the same HTTP
 * method: the merged lookup regex and the ordered list of candidates.
 */
interface MethodData {
	endpoints: Endpoint[];
	regexp: RegExp;
}

/**
 * Function registered through {@link Cudenix.plugins}, invoked with the
 * instance bound as `this` once {@link Cudenix.compile} has finished.
 */
type Plugin = (...options: any[]) => void;

/**
 * Options accepted by the {@link Cudenix} constructor.
 *
 * `jit` defaults to `true`; set to `false` for benchmarks or to simplify
 * stack traces while debugging.
 */
interface CudenixOptions {
	jit?: boolean;
}

/**
 * Public surface of a compiled application instance, returned by
 * `new Cudenix(module, options)`.
 */
export interface Cudenix {
	compile(): void;
	endpoint(
		endpoint: Endpoint,
		path: string,
		request: Request,
		match?: RegExpExecArray,
	): Promise<Response>;
	fetch(request: Request): MaybePromise<Response>;
	jit: boolean;
	listen(
		options?: Omit<
			Extract<
				Bun.Serve.Options<unknown>,
				{
					websocket?: never;
				}
			>,
			"fetch" | "unix"
		>,
	): Omit<Cudenix, "listen">;
	memory: Record<string, unknown>;
	methods: Record<string, MethodData>;
	plugins(plugins: Plugin[]): Cudenix;
	routes: Record<string, Bun.Serve.Routes<unknown, string>>;
	server?: Bun.Server<unknown>;
}

/**
 * Constructor signature of {@link Cudenix}, declared separately so the
 * value can be defined with a plain `function` and cast to a constructable
 * type.
 */
interface CudenixConstructor {
	new (module: AnyModule, options?: CudenixOptions): Cudenix;
}

/**
 * Create a new application instance from a root {@link AnyModule}.
 *
 * The constructor only does bookkeeping — it allocates the prototype-less
 * dictionaries that will be populated by {@link Cudenix.compile} and
 * stashes the source module under `memory.module` so it stays reachable
 * until compilation finishes and the slot is freed:
 *
 * - `memory` is the runtime scratch space, used both for transient
 *   compile-time state (the source module, the plugin queue) and for any
 *   long-lived data plugins decide to attach.
 * - `methods` is keyed by HTTP verb and holds the per-method
 *   {@link MethodData} produced by `compile`.
 * - `routes` mirrors the shape `Bun.serve` expects for its static-route
 *   table, populated alongside `methods`.
 *
 * Routes are not observable on the instance until either
 * {@link Cudenix.compile} or {@link Cudenix.listen} has run.
 *
 * @param module - Root module describing the application tree.
 * @param options - Optional behavior switches; see {@link CudenixOptions}.
 * @example
 * ```typescript
 * const app = new Cudenix(
 *   new Module().route("GET", "/", () => new Success("hello")),
 * );
 *
 * app.listen({ port: 3000 });
 * ```
 */
export const Cudenix = function (
	this: Cudenix,
	module: AnyModule,
	{ jit = true }: CudenixOptions = FreezeEmpty,
) {
	this.jit = jit;
	this.memory = new Empty();
	this.methods = new Empty() as Cudenix["methods"];
	this.routes = new Empty() as NonNullable<Cudenix["routes"]>;

	this.memory.module = module;
} as unknown as CudenixConstructor;

/**
 * Walk the source module tree and materialize the runtime routing tables.
 *
 * Three phases run in order:
 *
 * 1. {@link compile} flattens modules and groups into one {@link Endpoint}
 *    per `(method, path)` pair, writing the results into `methods` and
 *    `routes` and stamping each endpoint's `use` bitmask.
 * 2. Every plugin queued through {@link Cudenix.plugins} is invoked with
 *    the instance bound as `this`, giving it access to the freshly
 *    compiled tables for OpenAPI generation, metrics wiring, or any other
 *    introspection.
 * 3. The transient slots `memory.module` and `memory.plugins` are deleted
 *    so the original module tree and the plugin list can be reclaimed by
 *    the garbage collector before the server starts handling traffic.
 *
 * Called automatically by {@link Cudenix.listen}; call it manually only
 * when starting the server through a custom transport. It is not safe to
 * invoke twice on the same instance because `memory.module` has been
 * cleared after the first run.
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
 * Build a {@link Context} for `endpoint` and execute its chain.
 *
 * Wraps the request in a fresh context, primes whichever request fields
 * the chain marked as required through `endpoint.use`
 * (`Context.loadRequest` consults the same bitmask to skip parsers
 * nothing depends on), then hands the context off to `stepAndRespond` to
 * walk each unit and serialize the final response.
 *
 * Exposed on the prototype so plugins and tests can replay an endpoint
 * without going through the regex match in {@link Cudenix.fetch} — useful
 * when the caller has already resolved the endpoint through some other
 * mechanism, such as an external router or a replay harness.
 *
 * @param endpoint - Compiled endpoint descriptor to run.
 * @param path - Concrete request path; passed straight through to the
 *   context so downstream parsers do not have to recompute it.
 * @param request - Original `Request` driving the call.
 * @param match - Regex execution result that selected `endpoint`. Required
 *   when the path declares parameters so the context can decode them on
 *   demand; omit it for parameterless paths.
 * @returns The HTTP response produced by the chain, once every unit has
 *   resolved.
 */
Cudenix.prototype.endpoint = async function (
	this: Cudenix,
	endpoint: Endpoint,
	path: string,
	request: Request,
	match?: RegExpExecArray,
) {
	const context = new Context(
		endpoint,
		this.memory,
		path,
		request,
		this.server!,
		match,
	);

	await context.loadRequest();

	return stepAndRespond(this, context, endpoint, request);
};

/**
 * Resolve `request` to an {@link Endpoint} and dispatch it.
 *
 * Installed as the `fetch` handler passed to `Bun.serve` by
 * {@link Cudenix.listen}. Lookup proceeds in four short-circuiting steps,
 * each falling back to {@link NOT_FOUND}:
 *
 * 1. The HTTP method must have at least one registered endpoint — the
 *    `methods` table is consulted directly without a hash dance.
 * 2. The merged regex for that method must match the request URL.
 * 3. The path slot of the regex (`match[2]`) must be populated — guards
 *    against the few patterns whose only match is the prefix.
 * 4. One endpoint's seed capture group must be defined in the regex
 *    match. The slot indexed by `matchOffset` is unique per endpoint, so
 *    the first non-`undefined` entry identifies the winning candidate in
 *    a single linear pass.
 *
 * When a match is found the call is forwarded to {@link Cudenix.endpoint}
 * with the regex result so path parameters can be decoded lazily.
 *
 * @param request - Incoming HTTP request.
 * @returns Either the shared 404 sentinel for misses or the response
 *   produced by the endpoint chain. The return type is
 *   {@link MaybePromise} because the chain only `await`s asynchronous
 *   work when an endpoint actually requires it.
 */
Cudenix.prototype.fetch = function fetch(this: Cudenix, request: Request) {
	const data = this.methods[request.method];

	if (!data) {
		return NOT_FOUND;
	}

	const match = data.regexp.exec(request.url);

	if (!match) {
		return NOT_FOUND;
	}

	const path = match[2];

	if (!path) {
		return NOT_FOUND;
	}

	const endpoints = data.endpoints;

	let endpoint: Endpoint | undefined;

	for (let i = 0; i < endpoints.length; i++) {
		const candidate = endpoints[i]!;

		if (match[candidate.matchOffset!] !== undefined) {
			endpoint = candidate;

			break;
		}
	}

	if (!endpoint) {
		return NOT_FOUND;
	}

	return this.endpoint(endpoint, path, request, match);
};

/**
 * Compile the application and start a Bun HTTP server.
 *
 * The steps, in order:
 *
 * 1. {@link Cudenix.compile} runs and populates `methods` and `routes`,
 *    draining the plugin queue along the way. Subsequent edits to the
 *    source module are no longer observed.
 * 2. `Bun.serve` is started with defaults `development: false` and
 *    `reusePort: true` to match production-shaped behavior. Caller-supplied
 *    options override the defaults except for `fetch` and `routes`, which
 *    are always wired to {@link Cudenix.fetch} and the compiled `routes`
 *    table — overriding them would bypass the runtime entirely.
 * 3. A `beforeExit` listener stops the server on process shutdown so
 *    sockets are released cleanly without callers having to wire up a
 *    custom shutdown hook.
 * 4. `Bun.gc()` is invoked once to reclaim the transient compilation
 *    state freed in step 1 before the first request lands.
 *
 * @param options - Bun server options. WebSockets are configured through
 *   the route definitions rather than on the server, so the `websocket`
 *   field is excluded from the type. `fetch` and `unix` are excluded
 *   because the runtime owns them.
 * @returns The same instance, narrowed to hide `listen` itself so it
 *   cannot be invoked twice.
 * @example
 * ```typescript
 * new Cudenix(module).listen({ port: 3000 });
 * ```
 */
Cudenix.prototype.listen = function listen(
	this: Cudenix,
	options?: Omit<
		Extract<
			Bun.Serve.Options<unknown>,
			{
				websocket?: never;
			}
		>,
		"fetch" | "unix"
	>,
) {
	this.compile();

	this.server = Bun.serve({
		development: false,
		reusePort: true,
		...options,
		fetch: (request) => {
			return this.fetch(request);
		},
		routes: this.routes,
	});

	process.once("beforeExit", () => {
		this.server?.stop();
	});

	Bun.gc();

	return this;
};

/**
 * Queue plugins to run during {@link Cudenix.compile}.
 *
 * Plugins are stashed in `memory.plugins` and invoked once compilation
 * has produced the routing tables, so they observe the finished app
 * rather than the raw module tree. The list is created lazily on the
 * first call and extended through {@link pushAll} on subsequent calls,
 * which lets the method be chained or split across files without earlier
 * registrations being overwritten.
 *
 * @param plugins - Plugins appended to the queue, executed in the order
 *   they were registered.
 * @returns The same instance, for chaining.
 * @example
 * ```typescript
 * new Cudenix(module)
 *   .plugins([openapi(), metrics()])
 *   .listen({ port: 3000 });
 * ```
 */
Cudenix.prototype.plugins = function (this: Cudenix, plugins: Plugin[]) {
	if (!("plugins" in this.memory)) {
		this.memory.plugins = [];
	}

	pushAll(this.memory.plugins as Plugin[], plugins);

	return this;
};
