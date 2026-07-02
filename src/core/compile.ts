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
 * Shared frozen placeholder for an endpoint's `paramKeys`/`restKeys` until
 * {@link compile} swaps in the real keys.
 */
const EMPTY_KEYS = Object.freeze([]) as unknown as string[];

/**
 * The {@link EndpointChain} and path prefix inherited from a parent module.
 */
interface FlattenInherited {
	chain: EndpointChain;
	path: string;
}

/**
 * Walk a module subtree, collecting endpoints into `endpoints` (keyed by HTTP
 * method) and mounts into `mounts`, and return the subtree's outward-facing
 * `{ chain, path, start }`:
 *
 * - `chain` — the accumulated {@link EndpointChain}: the inherited links plus
 *   this module's own middlewares/stores/validators, plus any bubbled up from
 *   a `use`d MODULE.
 * - `path` — the module's fully composed prefix, forwarded so later siblings
 *   inherit a `use`d module's prefix.
 * - `start` — `inherited.chain.length`; the caller grafts on only
 *   `chain[start..]`, the links this subtree actually added.
 *
 * A MODULE link bubbles its new links and composed path back into the parent;
 * a GROUP link is isolated — its inherited prefix and chain snapshot are baked
 * into the module handed to the group handler, and the recursion starts from
 * empty inherited state, so nothing a group adds leaks to its siblings.
 *
 * @example
 * ```typescript
 * const endpoints = new Empty() as Record<HttpMethod, Endpoint[]>;
 *
 * const { path, start } = flatten(
 *   endpoints,
 *   [],
 *   new Module({ prefix: "/v1" }).route("GET", "/a", () => ok("v1")),
 *   { chain: [], path: "" },
 * );
 *
 * path; // "/v1"
 * start; // 0
 * endpoints.GET[0].path; // "/v1/a"
 * ```
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
	const accumulatedChain = inheritedChain.slice();
	const moduleChain = module.chain;

	// Path joins follow one rule everywhere below: a segment equal to "/"
	// contributes "" (so joins never produce a double slash), and a join that
	// reduces to "" re-expands to "/" via the `|| "/"` tails.
	const ownPrefix: "" | `/${string}` =
		module.prefix === "/" ? "" : module.prefix;

	let composedPath = module.prefix;
	let pathPrefix = ownPrefix;
	let cachedChain: EndpointChain | undefined;

	for (let i = 0; i < moduleChain.length; i++) {
		const link = moduleChain[i];

		if (!link) {
			continue;
		}

		const type = link.type;

		if (type === "GROUP") {
			const groupModule = new Module({
				prefix: `${inheritedPath}${pathPrefix}${link.prefix === "/" ? "" : link.prefix}` as `/${string}`,
			});

			groupModule.chain = accumulatedChain.slice();

			flatten(endpoints, mounts, link.handler(groupModule), {
				chain: [],
				path: "",
			});

			continue;
		}

		if (type === "MIDDLEWARE" || type === "STORE" || type === "VALIDATOR") {
			accumulatedChain.push(link);

			cachedChain = undefined;

			continue;
		}

		if (type === "MODULE") {
			const compiled = flatten(endpoints, mounts, link, {
				chain: accumulatedChain,
				path: `${inheritedPath}${pathPrefix}`,
			});

			const beforeLength = accumulatedChain.length;

			pushAllFrom(accumulatedChain, compiled.chain, compiled.start);

			if (accumulatedChain.length !== beforeLength) {
				cachedChain = undefined;
			}

			if (compiled.path !== "/") {
				composedPath = `${pathPrefix}${compiled.path}`;
				pathPrefix = composedPath === "/" ? "" : composedPath;
			}

			continue;
		}

		if (type === "MOUNT") {
			mounts.push({
				fetch: link.fetch,
				path:
					`${inheritedPath}${ownPrefix}${link.path === "/" ? "" : link.path}` ||
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
			chain = cloneAppend(accumulatedChain, link.validator);
		} else if (cachedChain) {
			chain = cachedChain;
		} else {
			chain = accumulatedChain.slice();

			cachedChain = chain;
		}

		methodEndpoints.push({
			chain,
			dispatch: staticDispatch,
			matchOffset: 0,
			paramKeys: EMPTY_KEYS,
			path:
				`${inheritedPath}${pathPrefix}${link.path === "/" ? "" : link.path}` ||
				"/",
			restKeys: EMPTY_KEYS,
			route: link,
		});
	}

	return {
		chain: accumulatedChain,
		path: composedPath,
		start: inheritedLength,
	};
};

/**
 * Compile a {@link Cudenix} app's module tree into its runtime routing tables:
 * `app.methods`, `app.routes`, `app.mounts` (prefixed mounts, longest prefix
 * first — only set when a non-`"/"` mount exists), and `app.rootMount` (the
 * first `"/"` mount, tried after every prefixed mount).
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
 * a.methods.GET; // { endpoints: [...], regexp: /.../, table: [...] }
 * a.routes["/a"]; // { GET: (request) => ... } — non-static: a dispatch closure
 * a.routes["/b"]; // { GET: Response } — static value: a pre-built Response
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

		const regexpEndpoints: Endpoint[] = [];
		const regexpPatterns: string[] = [];
		const regexpTable: Endpoint[] = [];

		let matchOffset = 1;

		for (let i = 0; i < methodEndpoints.length; i++) {
			const methodEndpoint = methodEndpoints[i];

			if (!methodEndpoint) {
				continue;
			}

			const isStatic =
				methodEndpoint.route.static &&
				methodEndpoint.chain.length === 0;
			const path = methodEndpoint.path;

			const { restKeys, paramKeys, pattern } = pathToRegexp(path);

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

			regexpEndpoints.push(methodEndpoint);
			regexpPatterns.push(pattern);

			regexpTable[matchOffset] = methodEndpoint;

			matchOffset += 1 + paramKeys.length;

			if (path.indexOf("?") === -1 && path.indexOf("...") === -1) {
				let pathRoutes = routes[path];

				if (!pathRoutes) {
					pathRoutes = new Empty() as (typeof routes)[string];

					routes[path] = pathRoutes;
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
			regexp: new RegExp(
				`^(?:https?:\\/\\/)[^\\s\\/]+(?:${regexpPatterns.join("|")})(?![^?#])`,
			),
			table: regexpTable,
		};
	}

	if (mounts.length > 0) {
		const prefixed: CompiledMount[] = [];

		for (let i = 0; i < mounts.length; i++) {
			const mount = mounts[i]!;

			if (mount.path === "/") {
				app.rootMount ??= mount;

				continue;
			}

			prefixed.push(mount);
		}

		if (prefixed.length > 0) {
			prefixed.sort((a, b) => b.path.length - a.path.length);

			app.mounts = prefixed;
		}
	}
};
