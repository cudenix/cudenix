import { Context } from "@/core/context";
import type { Chain, Cudenix, Endpoint } from "@/core/cudenix";
import { jitDispatch, staticDispatch, walkDispatch } from "@/core/dispatch";
import { type AnyModule, Module } from "@/core/module";
import { response } from "@/core/response";
import { cloneAppend } from "@/utils/arrays/clone-append";
import { pushAll } from "@/utils/arrays/push-all";
import { Empty } from "@/utils/objects/empty";
import { pathToRegexp } from "@/utils/regexps/path-to-regexp";
import type { HttpMethod } from "@/utils/types/http-method";

/**
 * Inherited {@link Chain} and path prefix.
 */
interface FlattenInherited {
	chain: Chain;
	path: string;
}

/**
 * Flatten a module subtree into `endpoints`, keyed by HTTP method.
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
			dispatch: walkDispatch,
			matchOffset: 0,
			paramKeys: [],
			path:
				`${inherited.path}${path === "/" ? "" : path}${link.path === "/" ? "" : link.path}` ||
				"/",
			restKeys: [],
			route: link,
		});
	}

	return { chain, path };
};

/**
 * Compile a {@link Cudenix} app's module tree into its runtime routing
 * tables on `app.methods` and `app.routes`.
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

			const isStatic =
				methodEndpoint.route.static &&
				methodEndpoint.chain.length === 0;

			methodEndpoint.matchOffset = matchOffset;
			methodEndpoint.paramKeys = paramKeys;
			methodEndpoint.restKeys = restKeys;

			if (isStatic) {
				methodEndpoint.response = response(
					methodEndpoint.route.handler(undefined as any),
				);

				methodEndpoint.dispatch = staticDispatch;
			} else {
				methodEndpoint.dispatch =
					(methodEndpoint.route.jit ?? app.jit)
						? jitDispatch
						: walkDispatch;
			}

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
					if (isStatic) {
						pathRoutes[method] = methodEndpoint.response!;

						continue;
					}

					pathRoutes[method] = (request: Request) =>
						methodEndpoint.dispatch(
							methodEndpoint,
							new Context(app, methodEndpoint, request),
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
