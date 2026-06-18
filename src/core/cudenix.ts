import { compile } from "@/core/compile";
import { Context } from "@/core/context";
import type { Dispatch } from "@/core/dispatch";
import type { AnyMiddleware } from "@/core/middleware";
import type { AnyModule } from "@/core/module";
import type { AnyRoute } from "@/core/route";
import type { AnyStore } from "@/core/store";
import type { AnyValidator } from "@/core/validator";
import { pushAll } from "@/utils/arrays/push-all";
import { Empty, FrozenEmpty } from "@/utils/objects/empty";
import type { HttpMethod } from "@/utils/types/http-method";
import type { MaybePromise } from "@/utils/types/maybe-promise";

const NOT_FOUND = new Response(undefined, { status: 404 });

/**
 * Flattened list of middlewares, stores, and validators for a single {@link Endpoint}.
 *
 * @example
 * ```typescript
 * const a: Chain = [];
 * ```
 */
export type Chain = (AnyMiddleware | AnyRoute | AnyStore | AnyValidator)[];

/**
 * Compiled endpoint descriptor — one fully-resolved {@link AnyRoute} plus
 * everything needed to match a URL against it and run it.
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
 *     handler: () => ok("v1"),
 *     sse: false,
 *     static: false,
 *     type: "ROUTE",
 *   },
 *   router: "bun",
 *   sse: false,
 * };
 * ```
 */
export interface Endpoint {
	chain: Chain;
	dispatch: Dispatch;
	matchOffset: number;
	paramKeys: string[];
	path: string;
	response?: Response;
	restKeys: string[];
	route: AnyRoute;
	router: "bun" | "cudenix";
}

/**
 * Per-method routing table: the {@link Endpoint}s for one HTTP method and the
 * merged `regexp` matched against the request URL.
 *
 * @example
 * ```typescript
 * const a: MethodData = {
 *   endpoints: [],
 *   regexp: /^(https?:\/\/)[^\s\/]+(()\/\x61)(?![^?#])/,
 * };
 * ```
 */
export interface MethodData {
	endpoints: Endpoint[];
	regexp: RegExp;
}

/**
 * Setup hook registered through `.plugins()`, run once during `.compile()`
 * with `this` bound to the {@link Cudenix} app.
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
 * Options accepted by the {@link Cudenix} constructor.
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
 * Public shape of a Cudenix application instance.
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
 * Constructor signature of {@link Cudenix}.
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
 * Construct a {@link Cudenix} app around a root {@link AnyModule}.
 *
 * @example
 * ```typescript
 * const a = new Cudenix(new Module().route("GET", "/a", () => ok("v1")));
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
 * Compile the app so it can serve requests.
 *
 * @example
 * ```typescript
 * const a = new Cudenix(new Module().route("GET", "/a", () => ok("v1")));
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
 * Resolve a request to a `Response`.
 *
 * @example
 * ```typescript
 * const a = new Cudenix(new Module().route("GET", "/a", () => ok("v1")));
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

	return endpoint.dispatch(
		endpoint,
		new Context(this, endpoint, request, match),
	);
};

/**
 * Compile the app and start serving it through `Bun.serve`.
 *
 * @example
 * ```typescript
 * const a = new Cudenix(new Module().route("GET", "/a", () => ok("v1")));
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
 * Register {@link Plugin} setup hooks to run during the next `.compile()`.
 *
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
