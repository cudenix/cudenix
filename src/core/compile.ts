import type { App, Chain, Endpoint } from "@/core/app";
import { compileEndpointFetch } from "@/core/jit";
import { memoizeRequest } from "@/core/memoize";
import { type AnyModule, Module } from "@/core/module";
import { Empty } from "@/utils/objects/empty";
import { pathToRegexp } from "@/utils/regexps/path-to-regexp";

const LINK_USE_BITS_CACHE = new WeakMap<object, number>();

export const USE_BODY = 1;
export const USE_COOKIES = 2;
export const USE_HEADERS = 4;
export const USE_PARAMS = 8;
export const USE_QUERY = 16;

const USE_ALL = USE_BODY | USE_COOKIES | USE_HEADERS | USE_PARAMS | USE_QUERY;

const USE_KEYWORDS = [
	[USE_BODY, "body"],
	[USE_COOKIES, "cookies"],
	[USE_HEADERS, "headers"],
	[USE_PARAMS, "params"],
	[USE_QUERY, "query"],
] as const satisfies [number, string][];

const KEY_TO_BIT = {
	body: USE_BODY,
	cookies: USE_COOKIES,
	headers: USE_HEADERS,
	params: USE_PARAMS,
	query: USE_QUERY,
} as const satisfies Record<string, number>;

interface PreviousStep {
	bits: number;
	chain: Chain;
	path: string;
}

const needsCudenixRouter = (path: string) => {
	return path.indexOf("?") !== -1 || path.indexOf("...") !== -1;
};

const extractRestKeys = (path: string) => {
	let keys: string[] | undefined;

	const length = path.length;

	let i = 0;

	while (i < length) {
		if (path.charCodeAt(i) === 47) {
			i++;

			continue;
		}

		let segEnd = i;

		while (segEnd < length && path.charCodeAt(segEnd) !== 47) {
			segEnd++;
		}

		if (
			path.charCodeAt(i) === 46 &&
			path.charCodeAt(i + 1) === 46 &&
			path.charCodeAt(i + 2) === 46
		) {
			const name = path.substring(
				i + 3,
				path.charCodeAt(segEnd - 1) === 63 ? segEnd - 1 : segEnd,
			);

			if (!keys) {
				keys = [];
			}

			keys.push(name);
		}

		i = segEnd;
	}

	return keys;
};

const getLinkUseBits = (link: Chain[number]) => {
	let bits = LINK_USE_BITS_CACHE.get(link);

	if (bits !== undefined) {
		return bits;
	}

	bits = 0;

	if (link.type === "VALIDATOR") {
		for (let i = 0; i < link.keys.length; i++) {
			if (bits === USE_ALL) {
				break;
			}

			bits |= KEY_TO_BIT[link.keys[i]!];
		}
	} else {
		const text =
			link[link.type.toLowerCase() as keyof typeof link].toString();

		for (let i = 0; i < USE_KEYWORDS.length; i++) {
			if (bits === USE_ALL) {
				break;
			}

			const keyword = USE_KEYWORDS[i];

			if (!keyword || text.indexOf(keyword[1]) === -1) {
				continue;
			}

			bits |= keyword[0];
		}

		if (bits !== USE_ALL && link.type === "ROUTE" && link.validator) {
			for (let i = 0; i < link.validator.keys.length; i++) {
				if (bits === USE_ALL) {
					break;
				}

				bits |= KEY_TO_BIT[link.validator.keys[i]!];
			}
		}
	}

	LINK_USE_BITS_CACHE.set(link, bits);

	return bits;
};

const step = (
	endpoints: Map<string, Endpoint[]>,
	module: AnyModule,
	previous: PreviousStep,
) => {
	const chain = [] as Chain;
	const merged = [...previous.chain];

	let bits = previous.bits;
	let path = module.prefix;

	for (let i = 0; i < module.chain.length; i++) {
		const link = module.chain[i];

		if (!link) {
			continue;
		}

		if (link.type === "GROUP") {
			const module = new Module({
				prefix: `${previous.path}${path === "/" ? "" : path}${link.prefix === "/" ? "" : link.prefix}`,
			});

			module.chain = [...merged];

			step(endpoints, link.group(module), {
				bits,
				chain: [],
				path: "",
			});

			continue;
		}

		if (
			link.type === "MIDDLEWARE" ||
			link.type === "STORE" ||
			link.type === "VALIDATOR"
		) {
			chain.push(link);

			merged.push(link);

			bits |= getLinkUseBits(link);

			continue;
		}

		if (link.type === "MODULE") {
			const compiled = step(endpoints, link, {
				bits,
				chain: [...merged],
				path: `${previous.path}${path === "/" ? "" : path}`,
			});

			for (let j = 0; j < compiled.chain.length; j++) {
				chain.push(compiled.chain[j]!);
			}

			if (compiled.path !== "/") {
				path = `${path === "/" ? "" : path}${compiled.path}`;
			}

			continue;
		}

		const method = link.method === "WS" ? "GET" : link.method;

		let methodEndpoints = endpoints.get(method);

		if (!methodEndpoints) {
			methodEndpoints = [];

			endpoints.set(method, methodEndpoints);
		}

		const finalPath =
			`${previous.path}${path === "/" ? "" : path}${link.path === "/" ? "" : link.path}` ||
			"/";

		const cudenix = needsCudenixRouter(finalPath);

		methodEndpoints.push({
			chain: link.validator ? [...merged, link.validator] : [...merged],
			generator: link.generator,
			jit: link.jit,
			path: finalPath,
			restKeys: cudenix ? extractRestKeys(finalPath) : undefined,
			route: link,
			router: cudenix ? "cudenix" : "bun",
			use: bits === USE_ALL ? USE_ALL : bits | getLinkUseBits(link),
		});
	}

	return {
		chain,
		path,
	};
};

const getDispatcher = (app: App, endpoint: Endpoint) => {
	const safeStatic =
		endpoint.route.static &&
		endpoint.chain.length === 0 &&
		endpoint.use === 0;

	const fallback = (request: Request, match?: RegExpExecArray) => {
		return app.endpoint(
			endpoint,
			match?.[2] ?? endpoint.path,
			request,
			match,
		);
	};

	let dispatcher = fallback;

	if (endpoint.jit && !safeStatic) {
		dispatcher = compileEndpointFetch(endpoint, app);

		endpoint.compiled = dispatcher;
	}

	if (safeStatic && endpoint.route.literal) {
		return {
			constant: dispatcher(undefined as any) as Response,
			dispatcher,
		};
	}

	if (safeStatic) {
		dispatcher = memoizeRequest(dispatcher);
	}

	return {
		dispatcher,
	};
};

export const compile = (app: App) => {
	const endpoints = new Map<string, Endpoint[]>();

	step(endpoints, app.memory.get("module") as AnyModule, {
		bits: 0,
		chain: [],
		path: "",
	});

	app.memory.set("endpoints", endpoints);

	for (const [method, methodEndpoints] of endpoints) {
		if (methodEndpoints.length === 0) {
			continue;
		}

		const routes = app.routes;

		const dynamicEndpoints = [] as Endpoint[];
		const methodRegexps = [] as string[];

		let groupOffset = 3;

		for (let i = 0; i < methodEndpoints.length; i++) {
			const methodEndpoint = methodEndpoints[i];

			if (!methodEndpoint) {
				continue;
			}

			const { constant, dispatcher } = getDispatcher(app, methodEndpoint);

			methodEndpoint.jit = methodEndpoint.route.jit ?? app.jit;

			if (needsCudenixRouter(methodEndpoint.path)) {
				const { pattern, paramKeys } = pathToRegexp(
					methodEndpoint.path,
					{
						capture: true,
					},
				);

				methodEndpoint.markerIndex = groupOffset;
				methodEndpoint.paramKeys = paramKeys;

				groupOffset += 1 + paramKeys.length;

				methodRegexps.push(pattern);
				dynamicEndpoints.push(methodEndpoint);

				methodEndpoint.compiled = constant
					? () => {
							return constant.clone();
						}
					: dispatcher;

				continue;
			}

			routes[methodEndpoint.path] ??=
				new Empty() as (typeof routes)[string];

			routes[methodEndpoint.path]![method] =
				constant ?? (dispatcher as Bun.Serve.Handler<any, any, any>);
		}

		if (dynamicEndpoints.length === 0) {
			continue;
		}

		app.methods.set(method, {
			endpoints: dynamicEndpoints,
			regexp: new RegExp(
				`^(https?:\\/\\/)[^\\s\\/]+(${methodRegexps.join("|")})(?![^?#])`,
			),
		});
	}
};
