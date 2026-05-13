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
import { pushAll } from "@/utils/arrays/push-all";
import { Empty, FreezeEmpty } from "@/utils/objects/empty";

const NOT_FOUND = new Response(undefined, {
	status: 404,
});

export type Chain = (AnyMiddleware | AnyRoute | AnyStore | AnyValidator)[];

export interface Endpoint {
	chain: Chain;
	matchOffset?: number;
	paramKeys?: string[];
	path: string;
	restKeys?: string[];
	route: AnyRoute;
	use: number;
}

interface MethodData {
	endpoints: Endpoint[];
	regexp: RegExp;
}

type Plugin = (...options: any[]) => void;

interface CudenixOptions {
	jit?: boolean;
}

export interface Cudenix {
	compile(): void;
	endpoint(
		endpoint: Endpoint,
		path: string,
		request: Request,
		match?: RegExpExecArray,
	): MaybePromise<Response>;
	fetch(request: Request): MaybePromise<Response>;
	jit: boolean;
	listen(
		options?: Omit<Bun.Serve.Options<unknown>, "fetch" | "unix">,
	): Omit<Cudenix, "listen">;
	memory: Record<string, unknown>;
	methods: Record<string, MethodData>;
	plugins(plugins: Plugin[]): Cudenix;
	routes: Record<string, Bun.Serve.Routes<unknown, string>>;
	server?: Bun.Server<unknown>;
}

type Constructor = new (module: AnyModule, options?: CudenixOptions) => Cudenix;

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
} as unknown as Constructor;

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

Cudenix.prototype.endpoint = function (
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

	const returned = context.loadRequest();

	if (returned instanceof Promise) {
		return returned.then(() => {
			return stepAndRespond(this, context, endpoint, request);
		});
	}

	return stepAndRespond(this, context, endpoint, request);
};

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

Cudenix.prototype.listen = function listen(
	this: Cudenix,
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
			perMessageDeflate: true,
			...options?.websocket,
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

Cudenix.prototype.plugins = function (this: Cudenix, plugins: Plugin[]) {
	if (!("plugins" in this.memory)) {
		this.memory.plugins = [];
	}

	pushAll(this.memory.plugins as Plugin[], plugins);

	return this;
};
