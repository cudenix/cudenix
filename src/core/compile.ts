import { Context } from "@/core/context";
import type { Chain, Cudenix, Endpoint } from "@/core/cudenix";
import { dispatch } from "@/core/dispatch";
import { type AnyModule, Module } from "@/core/module";
import type { HttpMethod } from "@/types/http-method";
import { cloneAppend } from "@/utils/arrays/clone-append";
import { pushAll } from "@/utils/arrays/push-all";
import { Empty } from "@/utils/objects/empty";
import { pathToRegexp } from "@/utils/regexps/path-to-regexp";

/**
 * @module
 * Compile a Cudenix app's module tree into the runtime routing tables —
 * flatten the nested chain into per-method endpoints, build the matching
 * regular expressions, and register the static fast paths on the Bun router.
 */

/**
 * Recursion state `flatten` threads down the module tree — the
 * middleware/store/validator {@link Chain} inherited from enclosing modules and
 * the path prefix built up from their merged prefixes.
 */
interface FlattenInherited {
	chain: Chain;
	path: `/${string}`;
}

/**
 * Recursively flatten a module subtree into `endpoints`, keyed by HTTP method.
 * Walks `module.chain` in order, accumulating middleware/store/validator links
 * and the path prefix as it descends, and for every route link emits an
 * {@link Endpoint} carrying the chain that leads up to it. Mounted sub-modules
 * (`MODULE`) are flattened with the chain so far and bubble their own chain and
 * path back up; a group (`GROUP`) seeds a fresh inner module with that chain but
 * does not fold the group's own links back, keeping them scoped to the group.
 *
 * Mutates `endpoints` in place; the returned `{ chain, path }` is what a parent
 * `MODULE` link folds back into its own accumulation.
 *
 * @param endpoints - Per-method endpoint accumulator, populated in place.
 * @param module - Module whose `chain` is flattened.
 * @param inherited - Chain and path prefix carried down from enclosing modules.
 * @returns The chain and path accumulated from this subtree.
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
				prefix: `${inherited.path}${path === "/" ? "" : path}${link.prefix === "/" ? "" : link.prefix}`,
			});

			module.chain = merged.slice();

			flatten(endpoints, link.handler(module), { chain: [], path: "/" });

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
 * Compile an app's module tree into the runtime routing tables. Flattens the
 * nested {@link Cudenix} module — descending into groups and mounted
 * sub-modules — into a flat list of {@link Endpoint}s per HTTP method, each
 * carrying the cumulative middleware/store/validator chain that leads up to
 * its route. Backs `app.compile()`, so it runs once before the server starts
 * serving requests.
 *
 * Populates `app.methods` with one per-method table — its endpoints folded
 * under a single merged matching regexp. Every fully-static endpoint — no
 * optional (`?`) or rest (`...`) segment — is also registered on `app.routes`
 * as a direct Bun handler tagged `router: "bun"`, so Bun matches those ahead of
 * the regexp fallback. Mutates `app` in place; `app.jit` seeds the per-route
 * JIT default when a route does not override it.
 *
 * @param app - App whose `memory.module` chain is compiled. Its `methods` and
 *   `routes` are populated in place.
 * @example
 * ```typescript
 * const a = new Cudenix(
 *   new Module().route("GET", "/a", () => new Success("v1")),
 * );
 *
 * compile(a);
 *
 * a.methods.GET; // { endpoints: [...], regexp: /.../ }
 * a.routes["/a"]; // { GET: (request) => ... }
 * ```
 */
export const compile = (app: Cudenix) => {
	const endpoints = new Empty() as Record<HttpMethod, Endpoint[]>;
	const jit = app.jit;
	const routes = app.routes;

	flatten(endpoints, app.memory.module as AnyModule, {
		chain: [],
		path: "/",
	});

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
					dispatch(
						methodEndpoint,
						request,
						new Context(app, methodEndpoint, request),
						methodEndpoint.chain,
						0,
					);

				methodEndpoint.router = "bun";
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
