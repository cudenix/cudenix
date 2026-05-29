import type { Chain, Cudenix, Endpoint } from "@/core/cudenix";
import { type AnyModule, Module } from "@/core/module";
import type { HttpMethod } from "@/types/http-method";
import { cloneAppend } from "@/utils/arrays/clone-append";
import { pushAll } from "@/utils/arrays/push-all";
import { Empty } from "@/utils/objects/empty";
import { pathToRegexp } from "@/utils/regexps/path-to-regexp";

interface PreviousStep {
	chain: Chain;
	path: `/${string}`;
}

export const step = (
	endpoints: Record<HttpMethod, Endpoint[]>,
	module: AnyModule,
	previous: PreviousStep,
) => {
	const chain: Chain = [];
	const merged = previous.chain.slice();

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

			step(endpoints, link.group(module), { chain: [], path: "/" });

			continue;
		}

		if (
			link.type === "MIDDLEWARE" ||
			link.type === "STORE" ||
			link.type === "VALIDATOR"
		) {
			chain.push(link);

			merged.push(link);

			continue;
		}

		if (link.type === "MODULE") {
			const compiled = step(endpoints, link, {
				chain: merged,
				path: `${previous.path}${path === "/" ? "" : path}`,
			});

			pushAll(chain, compiled.chain);

			if (compiled.path !== "/") {
				path = `${path === "/" ? "" : path}${compiled.path}`;
			}

			continue;
		}

		let methodEndpoints = endpoints[link.method];

		if (!methodEndpoints) {
			methodEndpoints = [];

			endpoints[link.method] = methodEndpoints;
		}

		const finalPath =
			`${previous.path}${path === "/" ? "" : path}${link.path === "/" ? "" : link.path}` ||
			"/";

		methodEndpoints.push({
			chain: link.validator
				? cloneAppend(merged, link.validator)
				: merged.slice(),
			jit: link.jit ?? true,
			matchOffset: 0,
			paramKeys: [],
			path: finalPath,
			restKeys: [],
			route: link,
			sse: link.sse,
		});
	}

	return { chain, path };
};

export const compile = (app: Cudenix) => {
	const endpoints = new Empty() as Record<HttpMethod, Endpoint[]>;
	const jit = app.jit;
	const routes = app.routes;

	step(endpoints, app.memory.module as AnyModule, { chain: [], path: "/" });

	for (const method in endpoints) {
		const methodEndpoints = endpoints[method];

		if (!methodEndpoints || methodEndpoints.length === 0) {
			continue;
		}

		const methodRegexps: string[] = [];
		const regexpEndpoints: Endpoint[] = [];

		let matchOffset = 3;

		for (let i = 0; i < methodEndpoints.length; i++) {
			const methodEndpoint = methodEndpoints[i];

			if (!methodEndpoint) {
				continue;
			}

			const { restKeys, paramKeys, pattern } = pathToRegexp(
				methodEndpoint.path,
			);

			methodEndpoint.jit = methodEndpoint.route.jit ?? jit;
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
				if (!(methodEndpoint.path in routes)) {
					routes[methodEndpoint.path] =
						new Empty() as (typeof routes)[string];
				}

				routes[methodEndpoint.path]![method] = (request: Request) =>
					app.endpoint(methodEndpoint, methodEndpoint.path, request);
			}
		}

		if (regexpEndpoints.length === 0) {
			continue;
		}

		app.methods[method] = {
			endpoints: regexpEndpoints,
			regexp: new RegExp(
				`^(https?:\\/\\/)[^\\s\\/]+(${methodRegexps.join("|")})(?![^?#])`,
			),
		};
	}
};
