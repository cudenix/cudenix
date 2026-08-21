import type { AnyModule } from "@/core/module";
import type { AnyFail, AnyOk } from "@/core/reply";
import type { SSE } from "@/ecosystem/client/sse";
import { Empty, FrozenEmpty } from "@/utils/objects/empty";
import type { ConditionallyOptional } from "@/utils/types/conditionally-optional";
import type { AnyGeneratorSSE } from "@/utils/types/generator-sse";
import type { MaybeFunction } from "@/utils/types/maybe-function";
import type { Merge } from "@/utils/types/merge";

const PARAM_REGEX_REPLACE = /\/:(\w+\??)/g;
const SPREAD_REGEX_REPLACE = /\/\.{3}(\w+\??)/g;

/**
 * Assigns one form entry onto the dictionary passed as `this`.
 */
function assignEntry(
	this: Record<PropertyKey, unknown>,
	value: FormDataEntryValue,
	key: string,
) {
	this[key] = value;
}

type RequestOptions<Request> = Merge<
	Omit<RequestInit, "method"> & {
		headers?: Record<string, string | readonly string[]>;
	},
	Request extends Record<PropertyKey, unknown>
		? ConditionallyOptional<Request, undefined>
		: NonNullable<unknown>
>;

type ParseResponse<Response> = Response extends
	| Generator<infer Yield>
	| AsyncGenerator<infer Yield>
	? SSE<Yield extends AnyGeneratorSSE ? Yield : never>
	: Response extends AnyFail | AnyOk
		? Response["content"]
		: Response;

type RouteHandler<Request, Response> = (
	options?: RequestOptions<Request>,
) => Promise<ParseResponse<Response>>;

type ClientChain<Routes extends Record<PropertyKey, unknown>> = {
	[Key in keyof Routes]: Routes[Key] extends Record<PropertyKey, unknown>
		? Routes[Key] extends {
				request: infer Request;
				response: infer Response;
			}
			? RouteHandler<Request, Response>
			: ClientChain<Routes[Key]>
		: never;
};

export type InferRouteOptions<Route> = Route extends (...options: any[]) => any
	? NonNullable<Parameters<Route>[0]>
	: never;

export type InferRouteResponse<Route> = Route extends (...options: any[]) => any
	? Awaited<ReturnType<Route>>
	: never;

type ClientOptions = MaybeFunction<
	{ url: string } & Omit<RequestInit, "method">
>;

const proxyHandler: ProxyHandler<any> = {
	async apply(target, _thisArg, [requestOptions = FrozenEmpty]) {
		const globalOptions = target._options;
		const path = target._path;
		const method = target._method;

		const resolved =
			typeof globalOptions === "function"
				? await globalOptions()
				: globalOptions;

		const options = { ...resolved, ...requestOptions };

		let url = `${resolved.url}/${path}`;

		if (options.body) {
			// holds the original body so the multipart pass survives the reassignment
			const body = options.body;

			let hasFile = false;

			for (const key in body) {
				if (!key) {
					continue;
				}

				const value = body[key];

				if (
					value instanceof File ||
					value instanceof Blob ||
					(Array.isArray(value) &&
						value.length > 0 &&
						(value[0] instanceof File || value[0] instanceof Blob))
				) {
					hasFile = true;

					break;
				}
			}

			if (hasFile) {
				const formData = new FormData();

				for (const key in body) {
					if (!key) {
						continue;
					}

					const value = body[key];

					if (Array.isArray(value)) {
						for (let j = 0; j < value.length; j++) {
							formData.append(key, value[j]);
						}

						continue;
					}

					formData.append(key, value);
				}

				options.body = formData;
			} else {
				options.body = JSON.stringify(body);

				// copy rather than mutate: the spread on line 79 is shallow, so
				// writing here would poison a headers object shared with the
				// client's own options and with every later call
				options.headers = {
					...options.headers,
					"content-type": "application/json",
				};
			}
		}

		if (options.query) {
			const keys = Object.keys(options.query);

			let query = "";

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i];

				if (!key) {
					continue;
				}

				const value = options.query[key];

				if (query.length > 0) {
					query += "&";
				}

				if (typeof value === "object" && value) {
					query +=
						encodeURIComponent(key) +
						"=" +
						encodeURIComponent(JSON.stringify(value));
				} else {
					query +=
						encodeURIComponent(key) +
						"=" +
						encodeURIComponent(String(value));
				}
			}

			if (query.length > 0) {
				url = `${url}?${query}`;
			}
		}

		if (url.indexOf("/:") !== -1) {
			url = url.replaceAll(PARAM_REGEX_REPLACE, (_, key: string) => {
				const param = options.params?.[
					key.endsWith("?") ? key.slice(0, -1) : key
				] as string | undefined;

				return param ? `/${param}` : "";
			});
		}

		if (url.indexOf("/...") !== -1) {
			url = url.replaceAll(SPREAD_REGEX_REPLACE, (_, key: string) => {
				const params = options.params?.[
					key.endsWith("?") ? key.slice(0, -1) : key
				] as string[] | undefined;

				return params ? `/${params.join("/")}` : "";
			});
		}

		options.method = method;

		const response = await fetch(url, options);

		const contentType = response.headers.get("content-type");

		if (!contentType) {
			return response.text();
		}

		if (contentType.indexOf("application/json") !== -1) {
			return response.json();
		}

		if (contentType.indexOf("application/octet-stream") !== -1) {
			return response.arrayBuffer();
		}

		if (contentType.indexOf("multipart/form-data") !== -1) {
			const formData = await response.formData();

			const result = new Empty();

			formData.forEach(assignEntry, result);

			return result;
		}

		if (contentType.indexOf("text/event-stream") !== -1) {
			return (await import("@/ecosystem/client/sse")).sse(response.url, {
				withCredentials: true,
			});
		}

		return response.text();
	},
	get(target, prop: string) {
		let children = target._children;

		if (!children) {
			children = new Empty();

			target._children = children;
		}

		const cached = children[prop];

		if (cached) {
			return cached;
		}

		const method = target._method;

		// "index" keeps the current path and method
		const child =
			prop === "index"
				? createProxy(target._options, target._path, target._method)
				: createProxy(
						target._options,
						method
							? target._path
								? `${target._path}/${method}`
								: method
							: target._path,
						prop,
					);

		children[prop] = child;

		return child;
	},
};

const createProxy = (globalOptions: ClientOptions, path = "", method = "") => {
	const target = (() => {}) as any;

	target._options = globalOptions;
	target._path = path;
	target._method = method;
	// caches one child proxy per property so each chain node is built once
	target._children = undefined;

	return new Proxy(target, proxyHandler);
};

export const client = <const App extends AnyModule>(options: ClientOptions) =>
	createProxy(options) as unknown as ClientChain<App["routes"]>;
