import type {
	Cudenix,
	Endpoint,
	EndpointChain,
	MethodData,
} from "@/core/cudenix";
import { type Dispatch, staticDispatch } from "@/core/dispatch";
import { jit } from "@/core/jit";
import { type AnyModule, Module } from "@/core/module";
import type { CompiledMount } from "@/core/mount";
import { response } from "@/core/response";
import { cloneAppend } from "@/utils/arrays/clone-append";
import { Empty } from "@/utils/objects/empty";
import { pathToRegexp } from "@/utils/regexps/path-to-regexp";
import type { HttpMethod } from "@/utils/types/http-method";

const EMPTY_KEYS = Object.freeze([]) as unknown as string[];
const EMPTY_FLAGS = Object.freeze([]) as unknown as number[];

const BUN_METHODS = new Set([
	"DELETE",
	"GET",
	"HEAD",
	"OPTIONS",
	"PATCH",
	"POST",
	"PUT",
]);

type MethodDispatch = (
	request: Request,
	match: RegExpExecArray,
) => ReturnType<Dispatch>;

type MethodDispatchFactory = (table: Endpoint[]) => MethodDispatch;

/**
 * Stores fallback route resolver factories by their capture layout.
 */
const methodDispatchFactories = new Map<string, MethodDispatchFactory>();

/**
 * Maps compiled method data to its fallback resolver.
 */
export const methodDispatchers = new WeakMap<MethodData, MethodDispatch>();

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

		if (charCode > 127 || charCode === 63) {
			return false;
		}

		if (charCode === 47) {
			if (i === segmentStart || path.charCodeAt(segmentStart) === 42) {
				return false;
			}

			segmentStart = i + 1;
		} else if (
			charCode === 46 &&
			path.charCodeAt(i + 1) === 46 &&
			path.charCodeAt(i + 2) === 46
		) {
			return false;
		}
	}

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
 * Describes a compiled endpoint prepared for route ordering.
 */
interface AnalyzedEndpoint {
	endpoint: Endpoint;
	native: boolean;
	order: number;
	pattern: string;
	ranks: number[];
}

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
const flatten = (
	endpoints: Record<HttpMethod, Endpoint[]>,
	mounts: CompiledMount[],
	module: AnyModule,
	inheritedChain: EndpointChain,
	inheritedPath: string,
	reuseChain = false,
) => {
	const accumulatedChain = reuseChain
		? inheritedChain
		: inheritedChain.slice();
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

			flatten(endpoints, mounts, link.handler(groupModule), [], "");

			continue;
		}

		if (type === "MIDDLEWARE" || type === "STORE" || type === "VALIDATOR") {
			accumulatedChain.push(link);

			cachedChain = undefined;

			continue;
		}

		if (type === "MODULE") {
			const beforeLength = accumulatedChain.length;
			const compiledPath = flatten(
				endpoints,
				mounts,
				link,
				accumulatedChain,
				`${inheritedPath}${pathPrefix}`,
				true,
			);

			if (accumulatedChain.length !== beforeLength) {
				cachedChain = undefined;
			}

			if (compiledPath !== "/") {
				composedPath = `${pathPrefix}${compiledPath}`;
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
			paramFlags: EMPTY_FLAGS,
			paramKeys: EMPTY_KEYS,
			path:
				`${inheritedPath}${pathPrefix}${link.path === "/" ? "" : link.path}` ||
				"/",
			restKeys: EMPTY_KEYS,
			route: link,
		});
	}

	return composedPath;
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

	flatten(endpoints, mounts, app.memory.module as AnyModule, [], "");

	for (const method in endpoints) {
		const methodEndpoints = endpoints[method];

		if (!methodEndpoints || methodEndpoints.length === 0) {
			continue;
		}

		const isBunMethod = BUN_METHODS.has(method);

		const analyzedEndpoints: AnalyzedEndpoint[] = [];

		for (let i = 0; i < methodEndpoints.length; i++) {
			const methodEndpoint = methodEndpoints[i];

			if (!methodEndpoint) {
				continue;
			}

			const path = methodEndpoint.path;
			const { paramFlags, paramKeys, pattern, ranks, restKeys } =
				pathToRegexp(path);
			const native = isBunMethod && isBunNativeRoute(path, paramKeys);

			methodEndpoint.paramFlags = paramFlags;
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
			const analyzedEndpoint = analyzedEndpoints[i];

			if (!analyzedEndpoint) {
				continue;
			}

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

		const methodData: MethodData = {
			endpoints: regexpEndpoints,
			regexp: new RegExp(
				`^(?:https?:\\/\\/)[^\\s\\/]+(?:${regexpPatterns.join("|")})(?![^?#])`,
			),
			table: regexpTable,
		};

		methodDispatchers.set(
			methodData,
			compileMethodDispatch(regexpEndpoints, regexpTable),
		);

		app.methods[method] = methodData;
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
