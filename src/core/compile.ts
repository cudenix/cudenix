import type { Cudenix, Endpoint, EndpointChain } from "@/core/cudenix";
import { staticDispatch } from "@/core/dispatch";
import { jit } from "@/core/jit";
import { type AnyModule, Module } from "@/core/module";
import type { CompiledMount } from "@/core/mount";
import { response } from "@/core/response";
import { cloneAppend } from "@/utils/arrays/clone-append";
import { pushAllFrom } from "@/utils/arrays/push-all-from";
import { Empty } from "@/utils/objects/empty";
import { pathToRegexp } from "@/utils/regexps/path-to-regexp";
import type { HttpMethod } from "@/utils/types/http-method";

/**
 * Inherited {@link EndpointChain} and path prefix.
 */
interface FlattenInherited {
	chain: EndpointChain;
	path: string;
}

/**
 * Flatten a module subtree into `endpoints`, keyed by HTTP method.
 */
const flatten = (
	endpoints: Record<HttpMethod, Endpoint[]>,
	mounts: CompiledMount[],
	module: AnyModule,
	inherited: FlattenInherited,
) => {
	const inheritedChain = inherited.chain;
	const inheritedLength = inheritedChain.length;
	const inheritedPath = inherited.path;
	const merged = inheritedChain.slice();
	const moduleChain = module.chain;

	let path = module.prefix;
	let pathSegment: "" | `/${string}` = path === "/" ? "" : path;
	let snapshot: EndpointChain | undefined;

	for (let i = 0; i < moduleChain.length; i++) {
		const link = moduleChain[i];

		if (!link) {
			continue;
		}

		const type = link.type;

		if (type === "GROUP") {
			const module = new Module({
				prefix: `${inheritedPath}${pathSegment}${link.prefix === "/" ? "" : link.prefix}` as `/${string}`,
			});

			module.chain = merged.slice();

			flatten(endpoints, mounts, link.handler(module), {
				chain: [],
				path: "",
			});

			continue;
		}

		if (type === "MIDDLEWARE" || type === "STORE" || type === "VALIDATOR") {
			merged.push(link);

			snapshot = undefined;

			continue;
		}

		if (type === "MODULE") {
			const compiled = flatten(endpoints, mounts, link, {
				chain: merged,
				path: `${inheritedPath}${pathSegment}`,
			});

			pushAllFrom(merged, compiled.chain, compiled.start);

			snapshot = undefined;

			if (compiled.path !== "/") {
				path = `${pathSegment}${compiled.path}`;
				pathSegment = path === "/" ? "" : path;
			}

			continue;
		}

		if (type === "MOUNT") {
			mounts.push({
				fetch: link.fetch,
				path:
					`${inheritedPath}${module.prefix === "/" ? "" : module.prefix}${link.path === "/" ? "" : link.path}` ||
					"/",
			});

			continue;
		}

		let methodEndpoints = endpoints[link.method];

		if (!methodEndpoints) {
			methodEndpoints = [];

			endpoints[link.method] = methodEndpoints;
		}

		let chain: EndpointChain;

		if (link.validator) {
			chain = cloneAppend(merged, link.validator);
		} else if (snapshot) {
			chain = snapshot;
		} else {
			chain = merged.slice();

			snapshot = chain;
		}

		methodEndpoints.push({
			chain,
			dispatch: staticDispatch,
			matchOffset: 0,
			paramKeys: [],
			path:
				`${inheritedPath}${pathSegment}${link.path === "/" ? "" : link.path}` ||
				"/",
			restKeys: [],
			route: link,
		});
	}

	return { chain: merged, path, start: inheritedLength };
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
	const mounts: CompiledMount[] = [];
	const routes = app.routes;

	flatten(endpoints, mounts, app.memory.module as AnyModule, {
		chain: [],
		path: "",
	});

	for (const method in endpoints) {
		const methodEndpoints = endpoints[method];

		if (!methodEndpoints || methodEndpoints.length === 0) {
			continue;
		}

		const methodRegexps: string[] = [];
		const regexpEndpoints: Endpoint[] = [];
		const regexpOffsets: number[] = [];

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
				methodEndpoint.dispatch = jit(app, methodEndpoint);
			}

			matchOffset += 1 + paramKeys.length;

			methodRegexps.push(pattern);
			regexpEndpoints.push(methodEndpoint);
			regexpOffsets.push(methodEndpoint.matchOffset);

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
						methodEndpoint.dispatch(request);
				}
			}
		}

		if (regexpEndpoints.length === 0) {
			continue;
		}

		app.methods[method] = {
			endpoints: regexpEndpoints,
			offsets: regexpOffsets,
			regexp: new RegExp(
				`^(https?:\\/\\/)[^\\s\\/]+(${methodRegexps.join("|")})(?![^?#])`,
			),
		};
	}

	if (mounts.length > 0) {
		mounts.sort((a, b) => b.path.length - a.path.length);

		app.mounts = mounts;
	}
};
