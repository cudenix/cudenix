import { compile } from "@/core/compile";
import type { AnyMiddleware } from "@/core/middleware";
import type { AnyModule } from "@/core/module";
import { NOT_FOUND } from "@/core/response";
import type { AnyRoute } from "@/core/route";
import type { AnyStore } from "@/core/store";
import type { AnyValidator } from "@/core/validator";
import { pushAll } from "@/utils/arrays/push-all";
import type { HttpMethod } from "@/utils/types/http-method";
import type { MaybePromise } from "@/utils/types/maybe-promise";

export interface CompiledCudenix extends CudenixState {
	fetch(request: Request): MaybePromise<Response>;
	listen(options?: ListenOptions): ListeningCudenix;
}

export interface Cudenix extends CudenixState {
	compile(): CompiledCudenix;
	listen(options?: ListenOptions): ListeningCudenix;
	plugins(plugins: Plugin[]): Cudenix;
}

export interface CudenixState {
	memory: Record<PropertyKey, unknown>;
	methods: Record<HttpMethod, MethodData>;
	routes: Record<string, Bun.Serve.Routes<unknown, string>>;
	server?: Bun.Server<unknown>;
}

export interface Endpoint {
	chain: EndpointChain;
	dispatch(request: Request, match?: RegExpExecArray): MaybePromise<Response>;
	markerOffset: number;
	matchOffset: number;
	paramFlags: number[];
	paramKeys: string[];
	path: string;
	response?: Response;
	route: AnyRoute;
}

export type EndpointChain = (AnyMiddleware | AnyStore | AnyValidator)[];

export interface ListeningCudenix extends CudenixState {
	server: Bun.Server<unknown>;
}

export interface MethodData {
	endpoints: Endpoint[];
	regexp: RegExp;
}

export type Plugin = (this: CudenixState) => (() => void) | void;

interface CudenixConstructor {
	new (module: AnyModule): Cudenix;
	prototype: CudenixInstance;
}

type CudenixInstance = CompiledCudenix & Cudenix;

type ListenOptions = Omit<
	Extract<Bun.Serve.Options<unknown>, { websocket?: never }>,
	"fetch" | "routes" | "unix"
>;

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- We are asserting the function as CudenixConstructor which is safe in this context
export const Cudenix = function (this: Cudenix, module: AnyModule) {
	this.memory = { module };
	this.methods = {} as Cudenix["methods"];
	this.routes = {};
} as unknown as CudenixConstructor;

Cudenix.prototype.compile = function (this: CudenixInstance): CompiledCudenix {
	if (this.memory.module === undefined) {
		throw new Error("Cudenix is already compiled");
	}

	const plugins = this.memory.plugins as Plugin[] | undefined;
	const deferredPlugins: (() => void)[] = [];

	if (plugins) {
		for (let i = 0; i < plugins.length; i++) {
			const returned = plugins[i]!.call(this);

			if (typeof returned === "function") {
				deferredPlugins.push(returned);
			}
		}
	}

	compile(this);

	for (let i = 0; i < deferredPlugins.length; i++) {
		deferredPlugins[i]!();
	}

	this.memory.module = undefined;
	this.memory.plugins = undefined;

	return this;
};

Cudenix.prototype.fetch = function (
	this: CudenixInstance,
	request: Request,
): MaybePromise<Response> {
	const methodData = this.methods[request.method as HttpMethod];

	if (methodData) {
		const match = methodData.regexp.exec(request.url);

		if (match) {
			const { endpoints } = methodData;

			for (let i = 0; i < endpoints.length; i++) {
				const endpoint = endpoints[i]!;

				if (match[endpoint.markerOffset] !== undefined) {
					return endpoint.dispatch(request, match);
				}
			}
		}
	}

	return NOT_FOUND;
};

Cudenix.prototype.listen = function (
	this: CudenixInstance,
	options?: ListenOptions,
): ListeningCudenix {
	if (this.server !== undefined && this.server.port !== 0) {
		throw new Error("Cudenix is already listening");
	}

	this.compile();

	this.server = Bun.serve<unknown, string>({
		development: false,
		...options,
		// oxlint-disable-next-line typescript/promise-function-async -- fetch is not async but returns a MaybePromise<Response>
		fetch: (request) => this.fetch(request),
		routes: this.routes,
	});

	Bun.gc();

	return this as ListeningCudenix;
};

Cudenix.prototype.plugins = function (
	this: CudenixInstance,
	plugins: Plugin[],
): Cudenix {
	if (this.memory.module === undefined) {
		throw new Error("Cudenix is already compiled");
	}

	this.memory.plugins ??= [];

	pushAll(this.memory.plugins as Plugin[], plugins);

	return this;
};
