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

const NOT_FOUND_INIT = {
	status: 404,
} as const satisfies ResponseInit;

export type Chain = (AnyMiddleware | AnyRoute | AnyStore | AnyValidator)[];

export interface Endpoint {
	chain: Chain;
	generator: boolean;
	paramsRegexp?: RegExp;
	path: string;
	route: AnyRoute;
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
	if (this.memory.has("plugins")) {
		const plugins = this.memory.get("plugins") as Plugin[];

		for (let i = 0; i < plugins.length; i++) {
			const plugin = plugins[i];

			if (!plugin) {
				continue;
			}

			plugin.call(this);
		}
	}

	compile(this, this.memory.get("module") as AnyModule);

	this.memory.delete("module");

	this.memory.delete("plugins");
};

App.prototype.endpoint = function (
	this: App,
	endpoint: Endpoint,
	path: string,
	request: Request,
) {
	const context = new Context(
		endpoint,
		this.memory,
		path,
		request,
		this.server!,
	);

	const result = context.loadRequest();

	if (result instanceof Promise) {
		return result.then(() => {
			return stepAndRespond(this, context, endpoint, request);
		});
	}

	return stepAndRespond(this, context, endpoint, request);
};

App.prototype.fetch = function (this: App, request: Request) {
	const data = this.methods.get(request.method);

	if (!data) {
		return new Response(undefined, NOT_FOUND_INIT);
	}

	const match = data.regexp.exec(request.url);

	if (!match) {
		return new Response(undefined, NOT_FOUND_INIT);
	}

	const path = match[2];

	if (!path) {
		return new Response(undefined, NOT_FOUND_INIT);
	}

	let index = -1;

	for (let i = 3; i < match.length; i++) {
		if (match[i] === undefined) {
			continue;
		}

		index = i - 3;

		break;
	}

	if (index === -1) {
		return new Response(undefined, NOT_FOUND_INIT);
	}

	const endpoint = data.endpoints[index];

	if (!endpoint) {
		return new Response(undefined, NOT_FOUND_INIT);
	}

	return this.endpoint(endpoint, path, request);
};

App.prototype.listen = function (
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

	(this.memory.get("plugins") as Plugin[])?.push(...plugins);

	return this;
};

export const app = (module: AnyModule) => {
	return new App(module) as App;
};
