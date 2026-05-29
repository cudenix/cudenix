import type { Chain, Cudenix, Endpoint } from "@/core/cudenix";
import { compileEndpointFetch } from "@/core/jit";
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
	endpoints: Record<string, Endpoint[]>,
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

			step(endpoints, link.group(module), { bits, chain: [], path: "" });

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

		const method = link.method;

		let methodEndpoints = endpoints[method];

		if (!methodEndpoints) {
			methodEndpoints = [];

			endpoints[method] = methodEndpoints;
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

	return { chain, path };
};

const getDispatcher = (app: Cudenix, endpoint: Endpoint) => {
	let dispatcher = (request: Request, match?: RegExpExecArray) =>
		app.endpoint(endpoint, match?.[2] ?? endpoint.path, request, match);

	const safeStatic =
		endpoint.route.static &&
		endpoint.use === 0 &&
		endpoint.chain.length === 0;

	if (endpoint.jit && !safeStatic) {
		dispatcher = compileEndpointFetch(endpoint, app);
	}

	if (safeStatic) {
		return {
			constant: dispatcher(undefined as any) as Response,
			dispatcher,
		};
	}

	return { dispatcher };
};

export const compile = (app: Cudenix) => {
	const endpoints = new Empty() as Record<string, Endpoint[]>;

	step(endpoints, app.memory.module as AnyModule, {
		bits: 0,
		chain: [],
		path: "",
	});

	for (const method in endpoints) {
		const methodEndpoints = endpoints[method];

		if (!methodEndpoints || methodEndpoints.length === 0) {
			continue;
		}

		const routes = app.routes;

		const methodRegexps = [] as string[];
		const regexpEndpoints = [] as Endpoint[];

		let matchOffset = 3;

		for (let i = 0; i < methodEndpoints.length; i++) {
			const methodEndpoint = methodEndpoints[i];

			if (!methodEndpoint) {
				continue;
			}

			const { restKeys, paramKeys, pattern } = pathToRegexp(
				methodEndpoint.path,
			);

			methodEndpoint.jit = methodEndpoint.route.jit ?? app.jit;
			methodEndpoint.matchOffset = matchOffset;
			methodEndpoint.paramKeys = paramKeys;
			methodEndpoint.restKeys = restKeys;

			matchOffset += 1 + paramKeys.length;

			methodRegexps.push(pattern);
			regexpEndpoints.push(methodEndpoint);

			if (
				methodEndpoint.path.indexOf("?") === -1 &&
				methodEndpoint.path.indexOf("...") === -1
			) {
				const { constant, dispatcher } = getDispatcher(
					app,
					methodEndpoint,
				);

				if (!(methodEndpoint.path in routes)) {
					routes[methodEndpoint.path] =
						new Empty() as (typeof routes)[string];
				}

				routes[methodEndpoint.path]![method] =
					constant ??
					(dispatcher as Bun.Serve.Handler<any, any, any>);
			}
		}

		if (regexpEndpoints.length === 0) {
			continue;
		}

		app.methods.method = {
			endpoints: regexpEndpoints,
			regexp: new RegExp(
				`^(https?:\\/\\/)[^\\s\\/]+(${methodRegexps.join("|")})(?![^?#])`,
			),
		};
	}
};
