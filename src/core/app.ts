import { compile } from "@/core/compile";
import { Context } from "@/core/context";
import { Error } from "@/core/error";
import type { AnyMiddleware } from "@/core/middleware";
import type { AnyModule } from "@/core/module";
import { processResponse } from "@/core/response";
import type {
	AnyRoute,
	RouteFnReturnGenerator,
	RouteFnReturnWS,
} from "@/core/route";
import type { AnyStore } from "@/core/store";
import type {
	AnyValidator,
	ValidatorPlugin,
	ValidatorRequest,
} from "@/core/validator";
import type { WSData } from "@/types/ws";
import { merge } from "@/utils/objects/merge";

export type Plugin = (...options: any[]) => string | Promise<string>;

export interface PluginOptions {
	compile?: "AFTER" | "BEFORE" | false;
}

export interface MemoryPlugin {
	plugin: Plugin;
	options?: PluginOptions | undefined;
}

export type Chain = (AnyMiddleware | AnyRoute | AnyStore | AnyValidator)[];

export interface Endpoint {
	chain: Chain;
	generator: boolean;
	paramsRegexp: RegExp;
	path: string;
	route: AnyRoute;
	use: Set<"body" | "cookies" | "headers" | "params" | "query">;
}

export interface App {
	compile(): Promise<void>;
	endpoint(
		request: Request,
		endpoint: Endpoint,
		path: string,
	): Promise<Response>;
	endpoints: Map<string, Endpoint[]>;
	fetch(request: Request): Promise<Response>;
	listen(
		options?: Omit<Bun.Serve.Options<unknown>, "fetch" | "unix">,
	): Promise<App>;
	memory: Map<string, unknown>;
	plugin(plugin: Plugin | Plugin[], options?: PluginOptions): App;
	regexps: Map<string, RegExp>;
	routes?: Record<string, Bun.Serve.Routes<unknown, string>>;
	server?: Bun.Server<unknown> | undefined;
}

type Constructor = new (module: AnyModule) => App;

export const App = function (this: App, module: AnyModule) {
	this.endpoints = new Map();
	this.memory = new Map();
	this.regexps = new Map();

	this.memory.set("module", module);
} as unknown as Constructor;

App.prototype.compile = async function (this: App) {
	const pluginsAfterCompile = [] as Plugin[];

	this.endpoints.clear();
	this.regexps.clear();
	this.routes = {};

	if (this.memory.has("plugins")) {
		const plugins = this.memory.get("plugins") as MemoryPlugin[];

		for (let i = 0; i < plugins.length; i++) {
			const plugin = plugins[i];

			if (!plugin) {
				continue;
			}

			if (plugin.options?.compile === false) {
				continue;
			}

			if (plugin.options?.compile === "AFTER") {
				pluginsAfterCompile.push(plugin.plugin);

				continue;
			}

			await plugin.plugin.call(this);
		}
	}

	await compile(this, this.memory.get("module") as AnyModule);

	for (let i = 0; i < pluginsAfterCompile.length; i++) {
		await pluginsAfterCompile[i]?.call(this);
	}

	this.memory.delete("module");
	this.memory.delete("plugins");
};

App.prototype.endpoint = async function (
	this: App,
	request: Request,
	endpoint: Endpoint,
	path: string,
) {
	const context = new Context(
		endpoint,
		this.memory,
		path,
		request,
		this.server!,
	);

	await context.loadRequest();

	const validatorPlugin = this.memory.get("validator") as ValidatorPlugin;

	const step = async (chain: Chain, index: number) => {
		for (let i = index; i < chain.length; i++) {
			if (context.response.content) {
				return;
			}

			const link = chain[i];

			if (!link) {
				continue;
			}

			if (link.type === "ROUTE") {
				continue;
			}

			if (link.type === "MIDDLEWARE") {
				const middleware = await link.middleware(context, () => {
					return step(chain, i + 1);
				});

				if (middleware) {
					context.response.content = middleware;
				}

				return;
			}

			if (link.type === "STORE") {
				const store = await link.store(context);

				if (store instanceof Error) {
					context.response.content = store;
				} else {
					merge(context.store, store);
				}

				continue;
			}

			if (!link.request) {
				continue;
			}

			const errors = new Map<
				keyof ValidatorRequest,
				{ details: unknown[]; type: keyof ValidatorRequest }
			>();

			for (let i = 0; i < link.keys.length; i++) {
				const key = link.keys[i] as keyof ValidatorRequest;
				const schema = link.request[key];

				const validated = await validatorPlugin(
					schema,
					context.request[key as keyof typeof context.request],
					key as any,
				);

				if (validated.success) {
					context.request[key as keyof typeof context.request] =
						validated.content as any;

					continue;
				}

				const content = (validated.content as any).pop
					? (validated.content as unknown[])
					: [validated.content];

				if (errors.has(key)) {
					errors.get(key)?.details.push(...content);

					continue;
				}

				errors.set(key, {
					details: content,
					type: key,
				});
			}

			if (errors.size > 0) {
				context.response.content = new Error(
					Array.from(errors.values()),
					{
						status: 422,
					},
				);
			}
		}

		if (context.response.content) {
			return;
		}

		if (endpoint.generator) {
			context.response.content = new ReadableStream({
				async start(controller) {
					let closed = false as boolean;

					const onAbort = () => {
						closed = true;

						try {
							controller.close();
						} catch {}
					};

					request.signal.addEventListener("abort", onAbort);

					try {
						for await (const chunk of endpoint.route.route(
							context,
						) as RouteFnReturnGenerator) {
							if (closed) {
								break;
							}

							if (chunk.data.transform) {
								if (chunk.id) {
									controller.enqueue(`id: ${chunk.id}\n`);
								}

								if (chunk.event) {
									controller.enqueue(
										`event: ${chunk.event}\n`,
									);
								}

								if (chunk.retry) {
									controller.enqueue(
										`retry: ${chunk.retry.toString()}\n`,
									);
								}

								controller.enqueue(
									`data: ${JSON.stringify(chunk.data)}\n\n`,
								);

								continue;
							}

							controller.enqueue(chunk.data.content);
						}
					} catch {
					} finally {
						request.signal.removeEventListener("abort", onAbort);

						onAbort();
					}
				},
			});

			return;
		}

		const returned = await endpoint.route.route(context);

		if (endpoint.route.method === "WS") {
			this.server?.upgrade(request, {
				data: {
					close: async (
						ws: Bun.ServerWebSocket<unknown>,
						code: number,
						reason: string,
					) => {
						await (
							returned as RouteFnReturnWS<unknown> | undefined
						)?.close?.(ws, code, reason);
					},
					drain: async (ws: Bun.ServerWebSocket<unknown>) => {
						await (
							returned as RouteFnReturnWS<unknown> | undefined
						)?.drain?.(ws);
					},
					message: async (
						ws: Bun.ServerWebSocket<unknown>,
						message: string,
					) => {
						await (
							returned as RouteFnReturnWS<unknown> | undefined
						)?.message(ws, message);
					},
					open: async (ws: Bun.ServerWebSocket<unknown>) => {
						await (
							returned as RouteFnReturnWS<unknown> | undefined
						)?.open?.(ws);
					},
				},
			});

			return;
		}

		context.response.content = returned;
	};

	await step(endpoint.chain, 0);

	return await processResponse(context.response);
};

App.prototype.fetch = async function (this: App, request: Request) {
	const match = this.regexps.get(request.method)?.exec(request.url);

	if (!match) {
		return new Response(undefined, {
			status: 404,
		});
	}

	let index = 0;

	for (let i = 3; i < match.length; i++) {
		if (match[i] === "") {
			index = i - 3;

			break;
		}
	}

	const endpoint = this.endpoints.get(request.method)?.[index];

	if (!endpoint || !match[2]) {
		return new Response(undefined, {
			status: 404,
		});
	}

	return await this.endpoint(request, endpoint, match[2]);
};

App.prototype.listen = async function (
	this: App,
	options?: Omit<Bun.Serve.Options<unknown>, "fetch" | "unix">,
) {
	await this.compile();

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

	process.once("SIGINT", () => {
		this.server?.stop(true);
		this.server = undefined;

		process.exit(0);
	});

	Bun.gc();

	return this;
};

App.prototype.plugin = function (
	this: App,
	plugins: Plugin | Plugin[],
	options?: PluginOptions,
) {
	if (!this.memory.has("plugins")) {
		this.memory.set("plugins", []);
	}

	if (typeof plugins === "function") {
		(this.memory.get("plugins") as MemoryPlugin[]).push({
			options,
			plugin: plugins,
		});

		return this;
	}

	for (let i = 0; i < plugins.length; i++) {
		const plugin = plugins[i];

		if (!plugin) {
			continue;
		}

		(this.memory.get("plugins") as MemoryPlugin[]).push({
			options,
			plugin,
		});
	}

	return this;
};

export const app = (module: AnyModule) => {
	return new App(module) as App;
};
