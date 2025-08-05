import type {
	RouterTypes,
	ServeFunctionOptions,
	Server,
	ServerWebSocket,
	TLSServeOptions,
} from "bun";

import type { Addon, AddonOptions } from "@/addon";
import { compile } from "@/compile";
import { Context } from "@/context";
import { Error } from "@/error";
import type { AnyMiddleware } from "@/middleware";
import type { AnyModule } from "@/module";
import { processResponse } from "@/response";
import type {
	AnyRoute,
	RouteFnReturnGenerator,
	RouteFnReturnWS,
} from "@/route";
import { asyncLocalStorage } from "@/storage";
import type { AnyStore } from "@/store";
import type { WSData } from "@/types";
import { merge } from "@/utils/merge";
import type {
	AnyValidator,
	ValidatorAddon,
	ValidatorRequest,
} from "@/validator";

export interface MemoryAddon {
	addon: Addon;
	options?: AddonOptions | undefined;
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

interface AppOptions {
	globalContext?: boolean;
}

export interface App {
	addon(addon: Addon | Addon[], options?: AddonOptions): App;
	compile(): Promise<void>;
	endpoint(
		request: Request,
		endpoint: Endpoint,
		path: string,
	): Promise<Response>;
	endpoints: Map<string, Endpoint[]>;
	fetch(request: Request): Promise<Response>;
	listen(options?: Omit<TLSServeOptions, "fetch">): Promise<App>;
	memory: Map<string, unknown>;
	options?: AppOptions | undefined;
	regexps: Map<string, RegExp>;
	routes?: Record<string, RouterTypes.RouteHandlerObject<string>>;
	server?: Server | undefined;
}

type Constructor = new (module: AnyModule, options?: AppOptions) => App;

const App = function (this: App, module: AnyModule, options?: AppOptions) {
	this.endpoints = new Map();
	this.memory = new Map();
	this.options = options;
	this.regexps = new Map();

	this.memory.set("module", module);
} as unknown as Constructor;

App.prototype.addon = function (
	this: App,
	addons: Addon | Addon[],
	options?: AddonOptions,
) {
	if (!this.memory.has("addons")) {
		this.memory.set("addons", []);
	}

	if (typeof addons === "function") {
		(this.memory.get("addons") as MemoryAddon[]).push({
			addon: addons,
			options,
		});

		return this;
	}

	for (let i = 0; i < addons.length; i++) {
		const addon = addons[i];

		if (!addon) {
			continue;
		}

		(this.memory.get("addons") as MemoryAddon[]).push({
			addon,
			options,
		});
	}

	return this;
};

App.prototype.compile = async function (this: App) {
	const addonsAfterCompile = [] as Addon[];

	if (this.memory.has("addons")) {
		const addons = this.memory.get("addons") as MemoryAddon[];

		for (let i = 0; i < addons.length; i++) {
			const addon = addons[i];

			if (!addon) {
				continue;
			}

			if (addon.options?.compile === false) {
				continue;
			}

			if (addon.options?.compile === "AFTER") {
				addonsAfterCompile.push(addon.addon);

				continue;
			}

			await addon.addon.call(this);
		}
	}

	await compile(this, this.memory.get("module") as AnyModule);

	for (let i = 0; i < addonsAfterCompile.length; i++) {
		await addonsAfterCompile[i]?.call(this);
	}

	this.memory.delete("module");
	this.memory.delete("addons");
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

			const validatorAddon = this.memory.get(
				"validator",
			) as ValidatorAddon;

			const errors = new Map<
				keyof ValidatorRequest,
				{ details: unknown[]; type: keyof ValidatorRequest }
			>();

			for (let i = 0; i < link.keys.length; i++) {
				const key = link.keys[i] as keyof ValidatorRequest;
				const schema = link.request[key];

				const validated = await validatorAddon(
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
					422,
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

					request.signal.addEventListener("abort", () => {
						closed = true;

						try {
							controller.close();
						} catch {}
					});

					for await (const chunk of endpoint.route.route(
						context,
					) as RouteFnReturnGenerator) {
						if (closed) {
							break;
						}

						if (chunk.id) {
							controller.enqueue(`id: ${chunk.id}\n`);
						}

						if (chunk.event) {
							controller.enqueue(`event: ${chunk.event}\n`);
						}

						if (chunk.retry) {
							controller.enqueue(
								`retry: ${chunk.retry.toString()}\n`,
							);
						}

						controller.enqueue(
							`data: ${JSON.stringify(chunk.data)}\n\n`,
						);
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
						ws: ServerWebSocket<unknown>,
						code: number,
						reason: string,
					) => {
						await (
							returned as RouteFnReturnWS<unknown> | undefined
						)?.close?.(ws, code, reason);
					},
					drain: async (ws: ServerWebSocket<unknown>) => {
						await (
							returned as RouteFnReturnWS<unknown> | undefined
						)?.drain?.(ws);
					},
					message: async (
						ws: ServerWebSocket<unknown>,
						message: string,
					) => {
						await (
							returned as RouteFnReturnWS<unknown> | undefined
						)?.message(ws, message);
					},
					open: async (ws: ServerWebSocket<unknown>) => {
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

	this.options?.globalContext
		? await asyncLocalStorage.run(context, async () => {
				await step(endpoint.chain, 0);
			})
		: await step(endpoint.chain, 0);

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
	options?: Omit<
		ServeFunctionOptions<undefined, NonNullable<unknown>>,
		"fetch"
	>,
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

	process.on("SIGINT", () => {
		this.server?.stop(true);
		this.server = undefined;

		process.exit(0);
	});

	Bun.gc(false);

	return this;
};

export const app = (module: AnyModule, options?: AppOptions) => {
	return new App(module, options) as App;
};
