import { compile } from "@/core/compile";
import { Context } from "@/core/context";
import type { AnyMiddleware } from "@/core/middleware";
import type { AnyModule } from "@/core/module";
import type { AnyRoute } from "@/core/route";
import { stepAndRespond } from "@/core/step";
import type { AnyStore } from "@/core/store";
import type { AnyValidator } from "@/core/validator";
import type { HttpMethod } from "@/types/http-method";
import type { MaybePromise } from "@/types/maybe-promise";
import { pushAll } from "@/utils/arrays/push-all";
import { Empty, FrozenEmpty } from "@/utils/objects/empty";

const NOT_FOUND = new Response(undefined, { status: 404 });

export type Chain = (AnyMiddleware | AnyRoute | AnyStore | AnyValidator)[];

export interface Endpoint {
	chain: Chain;
	jit: boolean;
	matchOffset: number;
	paramKeys: string[];
	path: string;
	restKeys: string[];
	route: AnyRoute;
	sse: boolean;
}

export interface MethodData {
	endpoints: Endpoint[];
	regexp: RegExp;
}

export type Plugin = (...options: any[]) => void;

export interface CudenixOptions {
	jit?: boolean;
}

export interface Cudenix {
	compile(): void;
	endpoint(
		endpoint: Endpoint,
		request: Request,
		match?: RegExpExecArray,
	): Promise<Response>;
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

export interface CudenixConstructor {
	new (module: AnyModule, options?: CudenixOptions): Cudenix;
}

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

Cudenix.prototype.endpoint = async function (
	this: Cudenix,
	endpoint: Endpoint,
	request: Request,
	match?: RegExpExecArray,
) {
	const context = new Context(
		endpoint,
		this.memory,
		request,
		this.server!,
		match,
	);

	await context.loadRequest();

	return stepAndRespond(this, context, endpoint, request);
};

Cudenix.prototype.fetch = function fetch(this: Cudenix, request: Request) {
	const data = this.methods[request.method as HttpMethod];

	if (!data) {
		return NOT_FOUND.clone();
	}

	const match = data.regexp.exec(request.url);

	if (!match) {
		return NOT_FOUND.clone();
	}

	if (!match[2]) {
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

	return this.endpoint(endpoint, request, match);
};

Cudenix.prototype.listen = function listen(
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

Cudenix.prototype.plugins = function (this: Cudenix, plugins: Plugin[]) {
	if (!("plugins" in this.memory)) {
		this.memory.plugins = [];
	}

	pushAll(this.memory.plugins as Plugin[], plugins);

	return this;
};
