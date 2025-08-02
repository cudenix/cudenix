import type {
	BunRequest,
	RouterTypes,
	ServeFunctionOptions,
	Server,
	ServerWebSocket,
	TLSServeOptions,
} from "bun";

import { Context } from "@/context";
import { Error } from "@/error";
import type { AnyMiddleware } from "@/middleware";
import { type AnyModule, Module } from "@/module";
import type {
	AnyRoute,
	RouteFnReturnGenerator,
	RouteFnReturnWS,
} from "@/route";
import { asyncLocalStorage } from "@/storage";
import type { AnyStore } from "@/store";
import type { WSData } from "@/types";
import { merge } from "@/utils/merge";
import {
	getUrlPathnameRegexp,
	pathToRegexp,
	useContextBodyRegexp,
	useContextCookiesRegexp,
	useContextHeadersRegexp,
	useContextParamsRegexp,
	useContextQueryRegexp,
} from "@/utils/regexp";
import { validateStandardSchema } from "@/utils/standard-schema";
import type {
	AnyValidator,
	ValidatorAddon,
	ValidatorRequest,
} from "@/validator";

type Addon = (...options: any[]) => string | Promise<string>;

interface AddonOptions {
	compile?: "AFTER" | "BEFORE" | false;
}

interface MemoryAddon {
	addon: Addon;
	options?: AddonOptions | undefined;
}

type Chain = (AnyMiddleware | AnyRoute | AnyStore | AnyValidator)[];

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
	compile(module: AnyModule): Promise<void>;
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
	response(context: Context): Promise<Response>;
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

App.prototype.compile = async function (this: App, module: AnyModule) {
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

	if (!this.memory.has("validator")) {
		this.memory.set("validator", validateStandardSchema);
	}

	const stack = [{ module, parentChain: [] as Chain, parentPath: "" }];

	const useRegexps = [
		["body", useContextBodyRegexp],
		["cookies", useContextCookiesRegexp],
		["headers", useContextHeadersRegexp],
		["params", useContextParamsRegexp],
		["query", useContextQueryRegexp],
	] as const;

	const step = (
		module: AnyModule,
		parentChain: Chain,
		parentPath: string,
	) => {
		const chain = [] as Chain;

		let path = module.prefix;

		for (let i = 0; i < module.chain.length; i++) {
			const link = module.chain[i];

			if (!link) {
				continue;
			}

			if (link.type === "GROUP") {
				const _module = new Module({
					prefix: `${parentPath}${path === "/" ? "" : path}${link.prefix === "/" ? "" : link.prefix}`,
				});

				_module.chain = [...parentChain, ...chain];

				stack.push({
					module: link.group(_module),
					parentChain: [],
					parentPath: "",
				});

				continue;
			}

			if (
				link.type === "MIDDLEWARE" ||
				link.type === "STORE" ||
				link.type === "VALIDATOR"
			) {
				chain.push(link);

				continue;
			}

			if (link.type === "MODULE") {
				const compiled = step(
					link,
					[...parentChain, ...chain],
					`${parentPath}${path === "/" ? "" : path}`,
				);

				chain.push(...compiled.chain);

				if (compiled.path !== "/") {
					path = `${path}${compiled.path}`;
				}

				continue;
			}

			const _chain = [...parentChain, ...chain];
			const use = new Set<string>() as Endpoint["use"];

			for (let j = 0; j < _chain.length; j++) {
				if (use.size === 5) {
					break;
				}

				const link = _chain[j];

				if (!link) {
					continue;
				}

				const text =
					link.type === "MIDDLEWARE"
						? link.middleware.toString()
						: link.type === "ROUTE"
							? link.route.toString()
							: link.type === "STORE"
								? link.store.toString()
								: "";

				if (!text) {
					continue;
				}

				for (let i = 0; i < useRegexps.length; i++) {
					const regexp = useRegexps[i];

					if (!regexp) {
						continue;
					}

					if (!regexp[1].test(text)) {
						continue;
					}

					use.add(regexp[0]);
				}
			}

			if (use.size !== useRegexps.length) {
				const text = link.route.toString();

				for (let i = 0; i < useRegexps.length; i++) {
					const regexp = useRegexps[i];

					if (!regexp) {
						continue;
					}

					if (!regexp[1].test(text)) {
						continue;
					}

					use.add(regexp[0]);
				}
			}

			const method = link.method === "WS" ? "GET" : link.method;

			if (!this.endpoints.has(method)) {
				this.endpoints.set(method, []);
			}

			const finalPath =
				`${parentPath}${path}${link.path === "/" ? "" : link.path}` ||
				"/";

			this.endpoints.get(method)?.push({
				chain: link.validator ? [..._chain, link.validator] : _chain,
				generator:
					link.route.constructor.name.indexOf("GeneratorFunction") !==
					-1,
				paramsRegexp: new RegExp(`^${pathToRegexp(finalPath, true)}$`),
				path: finalPath,
				route: link,
				use,
			});
		}

		return {
			chain,
			path,
		};
	};

	while (stack.length > 0) {
		const { module, parentChain, parentPath } = stack.pop()!;

		step(module, parentChain, parentPath);
	}

	const methods = Array.from(this.endpoints.keys());

	for (let i = 0; i < methods.length; i++) {
		const method = methods[i];

		if (!method) {
			continue;
		}

		const endpoints = this.endpoints.get(method)!.reverse();

		const regexps = [] as string[];

		for (let j = 0; j < endpoints.length; j++) {
			const endpoint = endpoints[j];

			if (!endpoint) {
				continue;
			}

			regexps.push(pathToRegexp(endpoint.path));

			if (
				endpoint.path.indexOf("?") !== -1 ||
				endpoint.path.indexOf("...") !== -1
			) {
				continue;
			}

			this.routes ??= {};
			this.routes[endpoint.path] ??= {};

			this.routes[endpoint.path]![
				endpoint.route.method as keyof (typeof this.routes)[string]
			] = async (request: BunRequest) => {
				return await this.endpoint(
					request,
					endpoint,
					getUrlPathnameRegexp.exec(request.url)?.[1] || request.url,
				);
			};
		}

		this.regexps.set(
			method,
			new RegExp(
				`^(https?:\\/\\/)[^\\s\\/]+(${regexps.join("|")})(?![^?#])`,
			),
		);
	}

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

	if (this.options?.globalContext) {
		await asyncLocalStorage.run(context, async () => {
			await step(endpoint.chain, 0);
		});
	} else {
		await step(endpoint.chain, 0);
	}

	return await this.response(context);
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
	await this.compile(this.memory.get("module") as AnyModule);

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

App.prototype.response = async function (
	this: App,
	{ response: { content: response, headers } }: Context,
) {
	if (response instanceof ReadableStream) {
		return new Response(response, {
			headers: {
				...(headers.toJSON() as Record<string, string>),
				"cache-control": "no-cache",
				connection: "keep-alive",
				"content-type": "text/event-stream",
			},
		});
	}

	if (typeof response?.content === "function") {
		response.content = (response.content as (...options: any[]) => any)();
	}

	if (response?.content instanceof Promise) {
		response.content = await response.content;
	}

	if (response?.transform) {
		return Response.json(
			{
				...response,
				transform: undefined,
			},
			{
				headers,
				status: response.status,
			},
		);
	}

	if (response?.content instanceof Response) {
		return response.content;
	}

	return new Response(response?.content, {
		headers,
		status: response?.status,
	});
};

export const app = (module: AnyModule, options?: AppOptions) => {
	return new App(module, options) as App;
};
