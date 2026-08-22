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
import { peek, peekStatus } from "@/utils/promises/peek";
import { pathToRegexp } from "@/utils/regexps/path-to-regexp";
import type { HttpMethod } from "@/utils/types/http-method";
import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * Placeholder endpoint dispatch replaced while compiling a method.
 */
const UNCOMPILED_DISPATCH = (): never => {
	throw new Error("Endpoint dispatch not compiled");
};

/**
 * Shared empty arrays reused by endpoints without parameters.
 */
const EMPTY_PARAM_FLAGS = Object.freeze([]) as unknown as number[];
const EMPTY_PARAM_KEYS = Object.freeze([]) as unknown as string[];

/**
 * Methods Bun's native router accepts.
 */
const BUN_ROUTE_METHODS = new Set([
	"CONNECT",
	"DELETE",
	"GET",
	"HEAD",
	"OPTIONS",
	"PATCH",
	"POST",
	"PUT",
	"TRACE",
]);

/**
 * Stores fallback route resolver factories by their capture layout.
 */
const methodDispatchFactories = new Map<string, MethodDispatchFactory>();

/**
 * Resolves a matched request to the dispatch of its capture group.
 */
export type MethodDispatch = (
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
			// groups get their own chain and prefix snapshot
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
				// the literal is not aliased, so the callee can own it
				true,
			);

			continue;
		}

		if (type === "MIDDLEWARE" || type === "STORE" || type === "VALIDATOR") {
			activeChain.push(link);

			cachedChain = undefined;

			continue;
		}

		if (type === "MODULE") {
			// nested modules propagate chain and prefix changes to later links
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
			// mounts use the module prefix, not the propagated one
			mounts.push({
				fetch: link.fetch,
				path:
					`${inheritedPath}${modulePrefix}${link.path === "/" ? "" : link.path}` ||
					"/",
			});

			continue;
		}

		// every remaining link is a route
		let methodEndpoints = endpoints[link.method];

		if (!methodEndpoints) {
			methodEndpoints = [];

			endpoints[link.method] = methodEndpoints;
		}

		let chain: EndpointChain;

		// routes without a validator share the last chain snapshot
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
			dispatch: UNCOMPILED_DISPATCH,
			markerOffset: 0,
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

	// reject duplicated parameter names
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
 * Resolves the parameters of every endpoint of a method and orders them.
 */
const analyzeMethodEndpoints = (
	methodEndpoints: Endpoint[],
	isBunMethod: boolean,
) => {
	const analyzedEndpoints: AnalyzedEndpoint[] = [];

	for (let i = 0; i < methodEndpoints.length; i++) {
		const endpoint = methodEndpoints[i];

		if (!endpoint) {
			continue;
		}

		const path = endpoint.path;
		const { paramFlags, paramKeys, pattern, ranks, restKeys } =
			pathToRegexp(path);

		endpoint.paramFlags = paramFlags;
		endpoint.paramKeys = paramKeys;
		endpoint.restKeys = restKeys;

		analyzedEndpoints.push({
			endpoint,
			native: isBunMethod && isBunNativeRoute(path, paramKeys),
			order: i,
			pattern,
			ranks,
		});
	}

	analyzedEndpoints.sort(compareAnalyzedEndpoints);

	return analyzedEndpoints;
};

/**
 * Builds an unrolled resolver for the endpoint capture groups after the first.
 */
const compileMethodDispatch = (endpoints: Endpoint[], table: Endpoint[]) => {
	let dispatchCode = "";
	let key = "";

	for (let i = 1; i < endpoints.length; i++) {
		const offset = endpoints[i]!.markerOffset;

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
 * Registers an endpoint on Bun's native route table.
 */
const registerNativeRoute = (
	routes: Cudenix["routes"],
	method: HttpMethod,
	endpoint: Endpoint,
	isStatic: boolean,
) => {
	const path = endpoint.path;

	let pathRoutes = routes[path];

	if (!pathRoutes) {
		pathRoutes = new Empty() as (typeof routes)[string];

		routes[path] = pathRoutes;
	}

	// the first endpoint registered for a method wins
	if (!(method in pathRoutes)) {
		pathRoutes[method] = isStatic
			? endpoint.response!
			: (endpoint.dispatch as (
					request: Request,
				) => MaybePromise<Response>);
	}
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
	const analyzedEndpoints = analyzeMethodEndpoints(
		methodEndpoints,
		BUN_ROUTE_METHODS.has(method),
	);

	if (analyzedEndpoints.length === 0) {
		return;
	}

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
		const markerOffset = matchOffset + endpoint.paramKeys.length;

		endpoint.markerOffset = markerOffset;
		endpoint.matchOffset = matchOffset;

		if (isStatic) {
			endpoint.response = response(
				endpoint.route.handler(undefined as any),
			);

			// clone the static response per request
			endpoint.dispatch = () => endpoint.response!.clone();
		} else {
			endpoint.dispatch = jit(app, endpoint);
		}

		fallbackEndpoints.push(endpoint);
		fallbackPatterns.push(analyzedEndpoint.pattern);

		fallbackTable[markerOffset] = endpoint;

		// skip past this endpoint's parameter captures and its marker
		matchOffset = markerOffset + 1;

		// only the first endpoint of each pattern reaches Bun's router
		if (
			analyzedEndpoint.native &&
			!nativePatterns.has(analyzedEndpoint.pattern)
		) {
			nativePatterns.add(analyzedEndpoint.pattern);

			registerNativeRoute(routes, method, endpoint, isStatic);
		}
	}

	const firstEndpoint = fallbackEndpoints[0];

	if (!firstEndpoint) {
		return;
	}

	const methodData: MethodData = {
		// a single endpoint always matches through its own marker
		dispatch:
			fallbackEndpoints.length > 1
				? compileMethodDispatch(fallbackEndpoints, fallbackTable)
				: undefined,
		endpoints: fallbackEndpoints,
		firstMarker: firstEndpoint.markerOffset,
		regexp: new RegExp(
			`^(?:https?:\\/\\/)[^\\s\\/]+(?:${fallbackPatterns.join("|")})(?![^?#])`,
		),
		table: fallbackTable,
	};

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
		// longest prefixes match first
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
		// the literal is not aliased, so the callee can own it
		true,
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
