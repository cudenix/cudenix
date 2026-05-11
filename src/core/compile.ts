import { getLinkInfo, USE_ALL } from "@/core/analyzer";
import type { App, Chain, Endpoint } from "@/core/app";
import { compileEndpointFetch } from "@/core/jit";
import { memoizeRequest } from "@/core/memoize";
import { type AnyModule, Module } from "@/core/module";
import { cloneAppend } from "@/utils/arrays/clone-append";
import { pushAll } from "@/utils/arrays/push-all";
import { Empty } from "@/utils/objects/empty";
import { pathToRegexp } from "@/utils/regexps/path-to-regexp";

interface PreviousStep {
	bits: number;
	chain: Chain;
	path: string;
}

const step = (
	endpoints: Map<string, Endpoint[]>,
	module: AnyModule,
	previous: PreviousStep,
) => {
	const chain = [] as Chain;
	const merged = previous.chain.slice();

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

			module.chain = merged.slice();

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

			bits |= getLinkInfo(link).bits;

			continue;
		}

		if (link.type === "MODULE") {
			const compiled = step(endpoints, link, {
				bits,
				chain: merged,
				path: `${previous.path}${path === "/" ? "" : path}`,
			});

			pushAll(chain, compiled.chain);

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

		methodEndpoints.push({
			chain: link.validator
				? cloneAppend(merged, link.validator)
				: merged.slice(),
			generator: link.generator,
			jit: link.jit ?? true,
			path: finalPath,
			route: link,
			router:
				finalPath.indexOf("?") !== -1 || finalPath.indexOf("...") !== -1
					? "cudenix"
					: "bun",
			use: bits === USE_ALL ? USE_ALL : bits | getLinkInfo(link).bits,
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
		endpoint.use === 0 &&
		endpoint.chain.length === 0;

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

			if (
				methodEndpoint.path.indexOf("?") !== -1 ||
				methodEndpoint.path.indexOf("...") !== -1
			) {
				const { restKeys, paramKeys, pattern } = pathToRegexp(
					methodEndpoint.path,
					{
						capture: true,
					},
				);

				methodEndpoint.restKeys = restKeys;
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
