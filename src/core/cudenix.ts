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

const NOT_FOUND = new Response(undefined, { status: 404 });

/**
 * Groups the processing components applied to an {@link Endpoint}.
 *
 * @example
 * ```typescript
 * const a: EndpointChain = [];
 * ```
 */
export type EndpointChain = (AnyMiddleware | AnyStore | AnyValidator)[];

/**
 * Describes a compiled route used for request matching and dispatch.
 *
 * @example
 * ```typescript
 * const a: Endpoint = {
 *   chain: [],
 *   dispatch,
 *   matchOffset: 1,
 *   paramKeys: [],
 *   path: "/a",
 *   restKeys: [],
 *   route,
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
 * Stores compiled routing data for an HTTP method.
 *
 * @example
 * ```typescript
 * const a: MethodData = { endpoints: [endpoint], regexp, table };
 * ```
 */
export interface MethodData {
	endpoints: Endpoint[];
	regexp: RegExp;
	table: Endpoint[];
}

/**
 * Defines a setup hook that runs while compiling an app.
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
 * Defines the options accepted when starting the application server.
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
 * Defines the public API of a Cudenix application.
 *
 * @example
 * ```typescript
 * const a: Cudenix = new Cudenix(new Module());
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
 * Defines the constructor for creating a {@link Cudenix} application.
 *
 * @example
 * ```typescript
 * const Ctor: CudenixConstructor = Cudenix;
 *
 * const a = new Ctor(new Module());
 * ```
 */
export interface CudenixConstructor {
	new (module: AnyModule): Cudenix;
}

/**
 * Creates a {@link Cudenix} application from a root {@link AnyModule}.
 *
 * @example
 * ```typescript
 * const a = new Cudenix(new Module().route("GET", "/a", () => ok("v1")));
 * ```
 */
export const Cudenix = function (this: Cudenix, module: AnyModule) {
	this.memory = new Empty();
	this.methods = new Empty() as Cudenix["methods"];
	this.routes = new Empty() as Cudenix["routes"];

	this.memory.module = module;
} as unknown as CudenixConstructor;

/**
 * Compiles the application for request handling.
 *
 * @example
 * ```typescript
 * const a = new Cudenix(new Module().route("GET", "/a", () => ok("v1")));
 *
 * a.compile();
 * ```
 */
Cudenix.prototype.compile = function (this: Cudenix) {
	if (!("module" in this.memory)) {
		return;
	}

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
 * Routes an incoming request through the application.
 *
 * @example
 * ```typescript
 * const a = new Cudenix(new Module().route("GET", "/a", () => ok("v1")));
 *
 * a.compile();
 *
 * (await a.fetch(new Request("http://localhost/a"))).status; // 200
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
 * Compiles and starts the application server.
 *
 * @example
 * ```typescript
 * const a = new Cudenix(new Module().route("GET", "/a", () => ok("v1")));
 *
 * a.listen({ port: 3000 }); // a.server?.port is now 3000
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
 * Registers {@link Plugin} setup hooks for application compilation.
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
 * ```
 */
Cudenix.prototype.plugins = function (this: Cudenix, plugins: Plugin[]) {
	if (!("plugins" in this.memory)) {
		this.memory.plugins = [];
	}

	pushAll(this.memory.plugins as Plugin[], plugins);

	return this;
};
