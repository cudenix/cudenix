import { compile } from "@/core/compile";
import { Context } from "@/core/context";
import type { AnyMiddleware } from "@/core/middleware";
import type { AnyModule } from "@/core/module";
import type { AnyRoute } from "@/core/route";
import { stepAndRespond } from "@/core/step";
import type { AnyStore } from "@/core/store";
import type { AnyValidator } from "@/core/validator";
import type { MaybePromise } from "@/types/maybe-promise";
import type { WSData } from "@/types/ws";

const NOT_FOUND = new Response(undefined, {
	status: 404,
});

export type Chain = (AnyMiddleware | AnyRoute | AnyStore | AnyValidator)[];

export type Router = "bun" | "cudenix";

export interface Endpoint {
	chain: Chain;
	generator: boolean;
	markerIndex?: number;
	paramKeys?: string[];
	path: string;
	restKeys?: string[];
	route: AnyRoute;
	router: Router;
	use: number;
}

interface MethodData {
	endpoints: Endpoint[];
	regexp: RegExp;
}

type Plugin = (...options: any[]) => void;

export interface App {
	compile(): void;
	endpoint(
		endpoint: Endpoint,
		path: string,
		request: Request,
		match?: RegExpExecArray,
	): MaybePromise<Response>;
	fetch(request: Request): MaybePromise<Response>;
	listen(options?: Omit<Bun.Serve.Options<unknown>, "fetch" | "unix">): App;
	memory: Map<string, unknown>;
	methods: Map<string, MethodData>;
	plugins(plugins: Plugin[]): App;
	routes?: Record<string, Bun.Serve.Routes<unknown, string>>;
	server?: Bun.Server<unknown>;
}

type Constructor = new (module: AnyModule) => App;

export const App = function (this: App, module: AnyModule) {
	this.memory = new Map();
	this.methods = new Map();

	this.memory.set("module", module);
} as unknown as Constructor;

App.prototype.compile = function (this: App) {
	compile(this, this.memory.get("module") as AnyModule);

	if (this.memory.has("plugins")) {
		const plugins = this.memory.get("plugins") as Plugin[];

		for (let i = 0; i < plugins.length; i++) {
			plugins[i]!.call(this);
		}
	}

	this.memory.delete("module");

	this.memory.delete("plugins");
};

App.prototype.endpoint = function (
	this: App,
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

	const returned = context.loadRequest();

	if (returned instanceof Promise) {
		return returned.then(() => {
			return stepAndRespond(this, context, endpoint, request);
		});
	}

	return stepAndRespond(this, context, endpoint, request);
};

App.prototype.fetch = function fetch(this: App, request: Request) {
	const data = this.methods.get(request.method);

	if (!data) {
		return NOT_FOUND.clone();
	}

	const match = data.regexp.exec(request.url);

	if (!match) {
		return NOT_FOUND.clone();
	}

	const path = match[2];

	if (!path) {
		return NOT_FOUND.clone();
	}

	const endpoints = data.endpoints;

	let endpoint: Endpoint | undefined;

	for (let i = 0; i < endpoints.length; i++) {
		const candidate = endpoints[i]!;

		if (match[candidate.markerIndex!] !== undefined) {
			endpoint = candidate;

			break;
		}
	}

	if (!endpoint) {
		return NOT_FOUND.clone();
	}

	return this.endpoint(endpoint, path, request, match);
};

App.prototype.listen = function listen(
	this: App,
	options?: Omit<Bun.Serve.Options<unknown>, "fetch" | "unix">,
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
		websocket: {
			close: (ws, code, reason) => {
				(ws.data as WSData)?.close?.(ws, code, reason);
			},
			drain: (ws) => {
				(ws.data as WSData)?.drain?.(ws);
			},
			message: (ws, message) => {
				(ws.data as WSData)?.message?.(ws, message);
			},
			open: (ws) => {
				(ws.data as WSData)?.open?.(ws);
			},
			perMessageDeflate: true,
		},
	});

	process.once("beforeExit", () => {
		this.server?.stop(true);

		this.server = undefined;
	});

	Bun.gc();

	return this;
};

App.prototype.plugins = function (this: App, plugins: Plugin[]) {
	if (!this.memory.has("plugins")) {
		this.memory.set("plugins", []);
	}

	const memoryPlugins = this.memory.get("plugins") as Plugin[];

	for (let i = 0; i < plugins.length; i++) {
		memoryPlugins.push(plugins[i]!);
	}

	return this;
};

export const app = (module: AnyModule) => {
	return new App(module) as App;
};
