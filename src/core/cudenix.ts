import { compile, methodDispatchers } from "@/core/compile";
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
 *   paramFlags: [],
 *   paramKeys: [],
 *   path: "/a",
 *   restKeys: [],
 *   route,
 * };
 * ```
 */
export interface Endpoint {
	chain: EndpointChain;
	dispatch: (
		request: Request,
		match?: RegExpExecArray,
	) => MaybePromise<Response>;
	matchOffset: number;
	paramFlags?: number[];
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
 */
type ListenOptions = Omit<
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
 */
interface CudenixConstructor {
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

	// Removing the module makes compilation idempotent.
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
			const endpointTable = methodData.table;

			if (match[1] !== undefined) {
				return endpointTable[1]!.dispatch(request, match);
			}

			const compiledDispatch = methodDispatchers.get(methodData);

			if (compiledDispatch) {
				return compiledDispatch(request, match);
			}

			for (let offset = 2; offset < match.length; offset++) {
				if (match[offset] !== undefined) {
					return endpointTable[offset]!.dispatch(request, match);
				}
			}
		}
	}

	const mounts = this.mounts;

	if (mounts) {
		const url = request.url;
		const pathnameStart = url.indexOf("/", 8); // Skip scheme and authority.

		for (let i = 0; i < mounts.length; i++) {
			const mount = mounts[i]!;
			const mountPath = mount.path;

			if (!url.startsWith(mountPath, pathnameStart)) {
				continue;
			}

			const prefixEnd = pathnameStart + mountPath.length;

			if (prefixEnd === url.length) {
				return mount.fetch(
					new Request(`${url.slice(0, pathnameStart)}/`, request),
				);
			}

			const boundaryCode = url.charCodeAt(prefixEnd);

			// "/" (47) continues the mounted path
			if (boundaryCode === 47) {
				return mount.fetch(
					new Request(
						url.slice(0, pathnameStart) + url.slice(prefixEnd),
						request,
					),
				);
			}

			// "?" (63) or "#" (35) follows the mount root
			if (boundaryCode === 63 || boundaryCode === 35) {
				return mount.fetch(
					new Request(
						`${url.slice(0, pathnameStart)}/${url.slice(prefixEnd)}`,
						request,
					),
				);
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
