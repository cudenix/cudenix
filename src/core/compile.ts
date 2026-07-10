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

const EMPTY_KEYS = Object.freeze([]) as unknown as string[];

const BUN_METHODS = new Set([
	"DELETE",
	"GET",
	"HEAD",
	"OPTIONS",
	"PATCH",
	"POST",
	"PUT",
]);

/**
 * Whether Bun and {@link pathToRegexp} assign the same meaning to `path`.
 * Anything outside this shared grammar stays exclusively on the regexp
 * fallback, preventing Bun from widening, rejecting, or re-normalizing it.
 */
const isBunNativeRoute = (
	method: HttpMethod,
	path: string,
	paramKeys: string[],
): boolean => {
	if (!BUN_METHODS.has(method)) {
		return false;
	}

	if (path === "/") {
		return true;
	}

	if (
		path.length < 2 ||
		path.charCodeAt(0) !== 47 ||
		path.charCodeAt(path.length - 1) === 47 ||
		path.indexOf("//") !== -1 ||
		path.indexOf("?") !== -1 ||
		path.indexOf("...") !== -1
	) {
		return false;
	}

	for (let i = 0; i < path.length; i++) {
		if (path.charCodeAt(i) > 127) {
			return false;
		}
	}

	const uniqueParamKeys = new Set<string>();

	for (let i = 0; i < paramKeys.length; i++) {
		const paramKey = paramKeys[i];

		if (!paramKey || uniqueParamKeys.has(paramKey)) {
			return false;
		}

		uniqueParamKeys.add(paramKey);
	}

	let segmentStart = 1;

	while (segmentStart < path.length) {
		let segmentEnd = path.indexOf("/", segmentStart);

		if (segmentEnd === -1) {
			segmentEnd = path.length;
		}

		if (path.charCodeAt(segmentStart) === 42) {
			return (
				segmentEnd - segmentStart === 1 && segmentEnd === path.length
			);
		}

		segmentStart = segmentEnd + 1;
	}

	return true;
};

/**
 * One endpoint's compiled pattern pieces, staged for the precedence sort.
 */
interface AnalyzedEndpoint {
	endpoint: Endpoint;
	native: boolean;
	order: number;
	pattern: string;
	ranks: number[];
}

/** Bun's specificity ordering, with registration order as the final tie-break. */
const compareAnalyzedEndpoints = (
	a: AnalyzedEndpoint,
	b: AnalyzedEndpoint,
): number => {
	if (a.native !== b.native) {
		return a.native ? -1 : 1;
	}

	if (!a.native) {
		return a.order - b.order;
	}

	const length = Math.min(a.ranks.length, b.ranks.length);

	for (let i = 0; i < length; i++) {
		const difference = (a.ranks[i] ?? 0) - (b.ranks[i] ?? 0);

		if (difference !== 0) {
			return difference;
		}
	}

	return a.ranks.length - b.ranks.length || a.order - b.order;
};

/**
 * The {@link EndpointChain} and path prefix inherited from a parent module.
 */
interface FlattenInherited {
	chain: EndpointChain;
	path: string;
}

/**
 * Walk a module subtree, collecting endpoints (keyed by HTTP method) and
 * mounts, and return its outward-facing `{ chain, path, start }` — the caller
 * grafts on only `chain[start..]`, the links this subtree actually added.
 *
 * @example
 * ```typescript
 * const endpoints = new Empty() as Record<HttpMethod, Endpoint[]>;
 *
 * flatten(
 *   endpoints,
 *   [],
 *   new Module({ prefix: "/v1" }).route("GET", "/a", () => ok("v1")),
 *   { chain: [], path: "" },
 * );
 *
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
 * `app.methods`, `app.routes`, `app.mounts`, and `app.rootMount`.
 *
 * @example
 * ```typescript
 * const a = new Cudenix(new Module().route("GET", "/a", () => ok("v1")));
 *
 * compile(a);
 *
 * a.routes["/a"]; // { GET: (request) => ... }
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

		const analyzedEndpoints: AnalyzedEndpoint[] = [];

		for (let i = 0; i < methodEndpoints.length; i++) {
			const methodEndpoint = methodEndpoints[i];

			if (!methodEndpoint) {
				continue;
			}

			const path = methodEndpoint.path;
			const { paramKeys, pattern, ranks, restKeys } = pathToRegexp(path);
			const native = isBunNativeRoute(method, path, paramKeys);

			methodEndpoint.paramKeys = paramKeys;
			methodEndpoint.restKeys = restKeys;

			analyzedEndpoints.push({
				endpoint: methodEndpoint,
				native,
				order: i,
				pattern,
				ranks,
			});
		}

		if (analyzedEndpoints.length === 0) {
			continue;
		}

		analyzedEndpoints.sort(compareAnalyzedEndpoints);

		const regexpEndpoints: Endpoint[] = [];
		const regexpPatterns: string[] = [];
		const regexpTable: Endpoint[] = [];
		const nativePatterns = new Set<string>();

		let matchOffset = 1;

		for (let i = 0; i < analyzedEndpoints.length; i++) {
			const analyzedEndpoint = analyzedEndpoints[i]!;
			const methodEndpoint = analyzedEndpoint.endpoint;

			const isStatic =
				methodEndpoint.route.static &&
				methodEndpoint.chain.length === 0;
			const path = methodEndpoint.path;

			methodEndpoint.matchOffset = matchOffset;

			if (isStatic) {
				methodEndpoint.response = response(
					methodEndpoint.route.handler(undefined as any),
				);

				methodEndpoint.dispatch = staticDispatch;
			} else {
				methodEndpoint.dispatch = jit(app, methodEndpoint);
			}

			regexpEndpoints.push(methodEndpoint);
			regexpPatterns.push(analyzedEndpoint.pattern);

			regexpTable[matchOffset] = methodEndpoint;

			matchOffset += 1 + methodEndpoint.paramKeys.length;

			if (
				analyzedEndpoint.native &&
				!nativePatterns.has(analyzedEndpoint.pattern)
			) {
				nativePatterns.add(analyzedEndpoint.pattern);

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
