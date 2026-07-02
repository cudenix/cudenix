import { compile } from "@/core/compile";
import type { Dispatch } from "@/core/dispatch";
import type { AnyMiddleware } from "@/core/middleware";
import type { AnyModule } from "@/core/module";
import type { CompiledMount } from "@/core/mount";
import type { AnyRoute } from "@/core/route";
import type { AnyStore } from "@/core/store";
import type { AnyValidator } from "@/core/validator";
import { pushAll } from "@/utils/arrays/push-all";
import { Empty } from "@/utils/objects/empty";
import type { HttpMethod } from "@/utils/types/http-method";
import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * Shared 404 returned by reference on every miss — never cloned.
 */
const NOT_FOUND = new Response(undefined, { status: 404 });

/**
 * Flattened list of middlewares, stores, and validators for a single {@link Endpoint}.
 *
 * @example
 * ```typescript
 * const a: EndpointChain = [];
 * ```
 */
export type EndpointChain = (AnyMiddleware | AnyStore | AnyValidator)[];

/**
 * Compiled endpoint descriptor — one fully-resolved {@link AnyRoute} plus
 * everything needed to match a URL against it and run it.
 *
 * @example
 * ```typescript
 * const a: Endpoint = {
 *   chain: [],
 *   dispatch: staticDispatch,
 *   matchOffset: 1,
 *   paramKeys: [],
 *   path: "/a",
 *   response: new Response("v1"),
 *   restKeys: [],
 *   route: {
 *     method: "GET",
 *     path: "/a",
 *     handler: () => ok("v1"),
 *     sse: false,
 *     static: true,
 *     type: "ROUTE",
 *   },
 * };
 * ```
 */
export interface Endpoint {
	chain: EndpointChain;
	dispatch: Dispatch;
	matchOffset: number;
	paramKeys: string[];
	path: string;
	response?: Response;
	restKeys: string[];
	route: AnyRoute;
}

/**
 * Per-method routing table: the {@link Endpoint}s for one HTTP method, the
 * merged `regexp` matched against the request URL, and a sparse `table`
 * mapping each endpoint's marker-group offset in a match result back to its
 * endpoint.
 *
 * @example
 * ```typescript
 * const table: Endpoint[] = [];
 *
 * table[1] = endpoint;
 *
 * const a: MethodData = {
 *   endpoints: [endpoint],
 *   regexp: /^(?:https?:\/\/)[^\s\/]+(?:()\/\x61)(?![^?#])/,
 *   table,
 * };
 * ```
 */
export interface MethodData {
	endpoints: Endpoint[];
	regexp: RegExp;
	table: Endpoint[];
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
export type Plugin = (this: Cudenix, ...options: any[]) => void;

/**
 * Options accepted by `.listen()` — every `Bun.serve` option except the ones
 * the app itself provides (`fetch`, `routes`) or does not support (`unix`,
 * `websocket`).
 *
 * @example
 * ```typescript
 * const a: ListenOptions = { port: 3000 };
 * ```
 */
export type ListenOptions = Omit<
	Extract<Bun.Serve.Options<unknown>, { websocket?: never }>,
	"fetch" | "routes" | "unix"
>;

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
	listen(options?: ListenOptions): Omit<Cudenix, "listen">;
	memory: Record<PropertyKey, unknown>;
	methods: Record<HttpMethod, MethodData>;
	mounts?: CompiledMount[];
	plugins(plugins: Plugin[]): Cudenix;
	rootMount?: CompiledMount;
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
 * const a = new Ctor(new Module());
 *
 * a.compile();
 * ```
 */
export interface CudenixConstructor {
	new (module: AnyModule): Cudenix;
}

/**
 * Construct a {@link Cudenix} app around a root {@link AnyModule}.
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
export const Cudenix = function (this: Cudenix, module: AnyModule) {
	this.memory = new Empty();
	this.methods = new Empty() as Cudenix["methods"];
	this.routes = new Empty() as Cudenix["routes"];

	this.memory.module = module;
} as unknown as CudenixConstructor;

/**
 * Compile the app so it can serve requests. Compiling consumes
 * `memory.module` and `memory.plugins`, so only the first call does any
 * work — later calls (including the one `listen` always makes) are no-ops.
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
	if ("plugins" in this.memory) {
		const plugins = this.memory.plugins as Plugin[];

		for (let i = 0; i < plugins.length; i++) {
			plugins[i]!.call(this);
		}
	}

	compile(this);

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
	const methodData = this.methods[request.method as HttpMethod];

	if (methodData) {
		const match = methodData.regexp.exec(request.url);

		if (match) {
			const table = methodData.table;

			for (let offset = 1; offset < match.length; offset++) {
				if (match[offset] !== undefined) {
					return table[offset]!.dispatch(request, match);
				}
			}
		}
	}

	const mounts = this.mounts;

	if (mounts) {
		const url = request.url;
		const pathStart = url.indexOf("/", 8);

		for (let i = 0; i < mounts.length; i++) {
			const mount = mounts[i]!;
			const prefix = mount.path;

			if (url.startsWith(prefix, pathStart)) {
				const afterPrefix = pathStart + prefix.length;

				if (afterPrefix === url.length) {
					return mount.fetch(
						new Request(`${url.slice(0, pathStart)}/`, request),
					);
				}

				const charCode = url.charCodeAt(afterPrefix);

				if (charCode === 47) {
					return mount.fetch(
						new Request(
							url.slice(0, pathStart) + url.slice(afterPrefix),
							request,
						),
					);
				}

				if (charCode === 63 || charCode === 35) {
					return mount.fetch(
						new Request(
							`${url.slice(0, pathStart)}/${url.slice(afterPrefix)}`,
							request,
						),
					);
				}
			}
		}
	}

	return this.rootMount?.fetch(request) ?? NOT_FOUND;
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
Cudenix.prototype.listen = function (this: Cudenix, options?: ListenOptions) {
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
