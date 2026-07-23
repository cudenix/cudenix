import type {
	Cudenix,
	Endpoint,
	EndpointChain,
	MethodData,
} from "@/core/cudenix";
import { jit } from "@/core/jit";
import { type AnyModule, Module } from "@/core/module";
import type { CompiledMount } from "@/core/mount";
import { response } from "@/core/response";
import { cloneAppend } from "@/utils/arrays/clone-append";
import { Empty } from "@/utils/objects/empty";
import { pathToRegexp } from "@/utils/regexps/path-to-regexp";
import type { HttpMethod } from "@/utils/types/http-method";
import type { MaybePromise } from "@/utils/types/maybe-promise";

const EMPTY_PARAM_KEYS = Object.freeze([]) as unknown as string[];
const EMPTY_PARAM_FLAGS = Object.freeze([]) as unknown as number[];

const BUN_ROUTE_METHODS = new Set([
	"DELETE",
	"GET",
	"HEAD",
	"OPTIONS",
	"PATCH",
	"POST",
	"PUT",
]);

/**
 * Stores fallback route resolver factories by their capture layout.
 */
const methodDispatchFactories = new Map<string, MethodDispatchFactory>();

/**
 * Maps compiled method data to its fallback resolver.
 */
export const methodDispatchers = new WeakMap<MethodData, MethodDispatch>();

/**
 * Describes a compiled route used for request matching and dispatch.
 */
type MethodDispatch = (
	request: Request,
	match: RegExpExecArray,
) => MaybePromise<Response>;

/**
 * Describes a factory for building a compiled route resolver.
 */
type MethodDispatchFactory = (table: Endpoint[]) => MethodDispatch;

/**
 * Describes an endpoint prepared for route ordering.
 */
interface AnalyzedEndpoint {
	endpoint: Endpoint;
	native: boolean;
	order: number;
	pattern: string;
	ranks: number[];
}

/**
 * Builds an unrolled resolver for the endpoint capture groups after the first.
 */
const compileMethodDispatch = (endpoints: Endpoint[], table: Endpoint[]) => {
	let dispatchCode = "";
	let key = "";

	for (let i = 1; i < endpoints.length; i++) {
		const offset = endpoints[i]!.matchOffset;

		key += `${offset},`;
		dispatchCode += `if (match[${offset}] !== undefined) return table[${offset}].dispatch(request, match);\n`;
	}

	let factory = methodDispatchFactories.get(key);

	if (!factory) {
		factory = new Function(
			"table",
			`return function (request, match) {\n${dispatchCode}};`,
		) as MethodDispatchFactory;

		methodDispatchFactories.set(key, factory);
	}

	return factory(table);
};

/**
 * Checks whether a path is compatible with Bun's native route semantics.
 */
const isBunNativeRoute = (path: string, paramKeys: string[]) => {
	if (path === "/") {
		return true;
	}

	const length = path.length;

	// require a leading "/" (47) without a trailing separator
	if (
		length < 2 ||
		path.charCodeAt(0) !== 47 ||
		path.charCodeAt(length - 1) === 47
	) {
		return false;
	}

	let segmentStart = 1;

	for (let i = 1; i < length; i++) {
		const charCode = path.charCodeAt(i);

		// reject non-ASCII code units (> 127) and "?" (63)
		if (charCode > 127 || charCode === 63) {
			return false;
		}

		// "/" (47) closes the current segment
		if (charCode === 47) {
			// reject empty or "*" (42)-prefixed non-terminal segments
			if (i === segmentStart || path.charCodeAt(segmentStart) === 42) {
				return false;
			}

			segmentStart = i + 1;
		} else if (
			// "..." (46) sequences require the fallback router
			charCode === 46 &&
			path.charCodeAt(i + 1) === 46 &&
			path.charCodeAt(i + 2) === 46
		) {
			return false;
		}
	}

	// only a lone terminal "*" (42) is native
	if (path.charCodeAt(segmentStart) === 42 && length - segmentStart !== 1) {
		return false;
	}

	const paramCount = paramKeys.length;

	if (paramCount === 0) {
		return true;
	}

	const firstParamKey = paramKeys[0];

	if (!firstParamKey) {
		return false;
	}

	if (paramCount === 1) {
		return true;
	}

	const uniqueParamKeys = new Set<string>([firstParamKey]);

	for (let i = 1; i < paramCount; i++) {
		const paramKey = paramKeys[i];

		if (!paramKey || uniqueParamKeys.has(paramKey)) {
			return false;
		}

		uniqueParamKeys.add(paramKey);
	}

	return true;
};

/**
 * Orders analyzed endpoints using Bun's route specificity rules.
 */
const compareAnalyzedEndpoints = (a: AnalyzedEndpoint, b: AnalyzedEndpoint) => {
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
 * Collects routes and mounts from a module tree for compilation.
 */
const flattenModuleTree = (
	endpoints: Record<HttpMethod, Endpoint[]>,
	mounts: CompiledMount[],
	module: AnyModule,
	inheritedChain: EndpointChain,
	inheritedPath: string,
	shareInheritedChain = false,
) => {
	const activeChain = shareInheritedChain
		? inheritedChain
		: inheritedChain.slice();
	const moduleChain = module.chain;
	const modulePrefix: "" | `/${string}` =
		module.prefix === "/" ? "" : module.prefix;

	let propagatedPrefix = module.prefix;
	let activePrefix = modulePrefix;
	let cachedChain: EndpointChain | undefined;

	for (let i = 0; i < moduleChain.length; i++) {
		const link = moduleChain[i];

		if (!link) {
			continue;
		}

		const type = link.type;

		if (type === "GROUP") {
			// Groups isolate changes to their chain and prefix.
			const groupModule = new Module({
				prefix: `${inheritedPath}${activePrefix}${link.prefix === "/" ? "" : link.prefix}` as `/${string}`,
			});

			groupModule.chain = activeChain.slice();

			flattenModuleTree(
				endpoints,
				mounts,
				link.handler(groupModule),
				[],
				"",
			);

			continue;
		}

		if (type === "MIDDLEWARE" || type === "STORE" || type === "VALIDATOR") {
			activeChain.push(link);

			cachedChain = undefined;

			continue;
		}

		if (type === "MODULE") {
			// Nested modules propagate changes to later links.
			const beforeLength = activeChain.length;
			const nestedPrefix = flattenModuleTree(
				endpoints,
				mounts,
				link,
				activeChain,
				`${inheritedPath}${activePrefix}`,
				true,
			);

			if (activeChain.length !== beforeLength) {
				cachedChain = undefined;
			}

			if (nestedPrefix !== "/") {
				propagatedPrefix = `${activePrefix}${nestedPrefix}`;
				activePrefix = propagatedPrefix === "/" ? "" : propagatedPrefix;
			}

			continue;
		}

		if (type === "MOUNT") {
			// Mounts ignore prefixes propagated by sibling modules.
			mounts.push({
				fetch: link.fetch,
				path:
					`${inheritedPath}${modulePrefix}${link.path === "/" ? "" : link.path}` ||
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
			chain = cloneAppend(activeChain, link.validator);
		} else if (cachedChain) {
			chain = cachedChain;
		} else {
			chain = activeChain.slice();

			cachedChain = chain;
		}

		methodEndpoints.push({
			chain,
			dispatch: () => {
				throw new Error("Endpoint dispatch not compiled");
			},
			matchOffset: 0,
			paramFlags: EMPTY_PARAM_FLAGS,
			paramKeys: EMPTY_PARAM_KEYS,
			path:
				`${inheritedPath}${activePrefix}${link.path === "/" ? "" : link.path}` ||
				"/",
			restKeys: EMPTY_PARAM_KEYS,
			route: link,
		});
	}

	return propagatedPrefix;
};

/**
 * Compiles routing data for one HTTP method.
 */
const compileMethod = (
	app: Cudenix,
	routes: Cudenix["routes"],
	method: HttpMethod,
	methodEndpoints: Endpoint[],
) => {
	const isBunMethod = BUN_ROUTE_METHODS.has(method);

	const analyzedEndpoints: AnalyzedEndpoint[] = [];

	for (let i = 0; i < methodEndpoints.length; i++) {
		const endpoint = methodEndpoints[i];

		if (!endpoint) {
			continue;
		}

		const path = endpoint.path;
		const { paramFlags, paramKeys, pattern, ranks, restKeys } =
			pathToRegexp(path);
		const native = isBunMethod && isBunNativeRoute(path, paramKeys);

		endpoint.paramFlags = paramFlags;
		endpoint.paramKeys = paramKeys;
		endpoint.restKeys = restKeys;

		analyzedEndpoints.push({ endpoint, native, order: i, pattern, ranks });
	}

	if (analyzedEndpoints.length === 0) {
		return;
	}

	analyzedEndpoints.sort(compareAnalyzedEndpoints);

	const fallbackEndpoints: Endpoint[] = [];
	const fallbackPatterns: string[] = [];
	const fallbackTable: Endpoint[] = [];
	const nativePatterns = new Set<string>();

	let matchOffset = 1;

	for (let i = 0; i < analyzedEndpoints.length; i++) {
		const analyzedEndpoint = analyzedEndpoints[i];

		if (!analyzedEndpoint) {
			continue;
		}

		const endpoint = analyzedEndpoint.endpoint;
		const isStatic = endpoint.route.static && endpoint.chain.length === 0;
		const path = endpoint.path;

		endpoint.matchOffset = matchOffset;

		if (isStatic) {
			endpoint.response = response(
				endpoint.route.handler(undefined as any),
			);

			// Give each request a fresh response body.
			endpoint.dispatch = () => endpoint.response!.clone();
		} else {
			endpoint.dispatch = jit(app, endpoint);
		}

		fallbackEndpoints.push(endpoint);
		fallbackPatterns.push(analyzedEndpoint.pattern);

		fallbackTable[matchOffset] = endpoint;

		// Account for the marker and parameter captures.
		matchOffset += 1 + endpoint.paramKeys.length;

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
					pathRoutes[method] = endpoint.response!;

					continue;
				}

				pathRoutes[method] = endpoint.dispatch as (
					request: Request,
				) => MaybePromise<Response>;
			}
		}
	}

	const methodData: MethodData = {
		endpoints: fallbackEndpoints,
		regexp: new RegExp(
			`^(?:https?:\\/\\/)[^\\s\\/]+(?:${fallbackPatterns.join("|")})(?![^?#])`,
		),
		table: fallbackTable,
	};

	methodDispatchers.set(
		methodData,
		compileMethodDispatch(fallbackEndpoints, fallbackTable),
	);

	app.methods[method] = methodData;
};

/**
 * Stores root and prefixed mounts on the application.
 */
const compileMounts = (app: Cudenix, mounts: CompiledMount[]) => {
	if (mounts.length === 0) {
		return;
	}

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
};

/**
 * Builds a {@link Cudenix} application's routing data from its module tree.
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
	const routes = app.routes;

	const endpoints = new Empty() as Record<HttpMethod, Endpoint[]>;
	const mounts: CompiledMount[] = [];

	flattenModuleTree(
		endpoints,
		mounts,
		app.memory.module as AnyModule,
		[],
		"",
	);

	for (const method in endpoints) {
		const methodEndpoints = endpoints[method];

		if (!methodEndpoints || methodEndpoints.length === 0) {
			continue;
		}

		compileMethod(app, routes, method, methodEndpoints);
	}

	compileMounts(app, mounts);
};
