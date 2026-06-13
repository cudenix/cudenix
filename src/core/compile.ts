import { Context } from "@/core/context";
import type { Chain, Cudenix, Endpoint } from "@/core/cudenix";
import { dispatch } from "@/core/dispatch";
import { type AnyModule, Module } from "@/core/module";
import { response } from "@/core/response";
import { cloneAppend } from "@/utils/arrays/clone-append";
import { pushAll } from "@/utils/arrays/push-all";
import { Empty } from "@/utils/objects/empty";
import { pathToRegexp } from "@/utils/regexps/path-to-regexp";
import type { HttpMethod } from "@/utils/types/http-method";

/**
 * @module
 * Compile a Cudenix app's module tree into its runtime routing tables.
 */

/**
 * State `flatten` threads down the module tree: the {@link Chain} inherited
 * from enclosing modules and the path prefix built up from their prefixes.
 */
interface FlattenInherited {
	chain: Chain;
	path: string;
}

/**
 * Flatten a module subtree into `endpoints`, keyed by HTTP method. Returns
 * the chain and path this subtree folds back into its parent.
 */
const flatten = (
	endpoints: Record<HttpMethod, Endpoint[]>,
	module: AnyModule,
	inherited: FlattenInherited,
) => {
	const chain: Chain = [];
	const merged = inherited.chain.slice();

	let path = module.prefix;

	for (let i = 0; i < module.chain.length; i++) {
		const link = module.chain[i];

		if (!link) {
			continue;
		}

		if (link.type === "GROUP") {
			const module = new Module({
				prefix: `${inherited.path}${path === "/" ? "" : path}${link.prefix === "/" ? "" : link.prefix}` as `/${string}`,
			});

			module.chain = merged.slice();

			flatten(endpoints, link.handler(module), { chain: [], path: "" });

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
			const compiled = flatten(endpoints, link, {
				chain: merged,
				path: `${inherited.path}${path === "/" ? "" : path}`,
			});

			pushAll(chain, compiled.chain);
			pushAll(merged, compiled.chain);

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

		methodEndpoints.push({
			chain: link.validator
				? cloneAppend(merged, link.validator)
				: merged.slice(),
			jit: link.jit ?? true,
			matchOffset: 0,
			paramKeys: [],
			path:
				`${inherited.path}${path === "/" ? "" : path}${link.path === "/" ? "" : link.path}` ||
				"/",
			restKeys: [],
			route: link,
			router: "cudenix",
			sse: link.sse,
		});
	}

	return { chain, path };
};

/**
 * Compile a {@link Cudenix} app's module tree into its runtime routing
 * tables on `app.methods` and `app.routes`. Backs `app.compile()`.
 *
 * @example
 * ```typescript
 * const a = new Cudenix(
 *   new Module()
 *     .route("GET", "/a", () => ok("v1"))
 *     .route("GET", "/b", ok("v2")),
 * );
 *
 * compile(a);
 *
 * a.methods.GET; // { endpoints: [...], regexp: /.../ }
 * a.routes["/a"]; // { GET: (request) => ... } — dispatch handler
 * a.routes["/b"]; // { GET: Response } — pre-built static response
 * ```
 */
export const compile = (app: Cudenix) => {
	const endpoints = new Empty() as Record<HttpMethod, Endpoint[]>;
	const jit = app.jit;
	const routes = app.routes;

	flatten(endpoints, app.memory.module as AnyModule, { chain: [], path: "" });

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
				let pathRoutes = routes[methodEndpoint.path];

				if (!pathRoutes) {
					pathRoutes = new Empty() as (typeof routes)[string];

					routes[methodEndpoint.path] = pathRoutes;
				}

				if (!(method in pathRoutes)) {
					methodEndpoint.router = "bun";

					if (
						methodEndpoint.route.static &&
						methodEndpoint.chain.length === 0
					) {
						pathRoutes[method] = response(
							methodEndpoint.route.handler(undefined as any),
						);

						continue;
					}

					pathRoutes[method] = (request: Request) =>
						dispatch(
							methodEndpoint,
							request,
							new Context(app, methodEndpoint, request),
							methodEndpoint.chain,
							0,
						);
				}
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
