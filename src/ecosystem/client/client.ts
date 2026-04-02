import type { AnyError } from "@/core/error";
import type { AnyModule } from "@/core/module";
import type { AnySuccess } from "@/core/success";
import type { SSE } from "@/ecosystem/client/sse";
import type { WS } from "@/ecosystem/client/ws";
import type { ConditionallyOptional } from "@/types/conditionally-optional";
import type { AnyGeneratorSSE } from "@/types/generator-sse";
import type { MaybeFunction } from "@/types/maybe-function";
import type { Merge } from "@/types/merge";
import { Empty, FreezeEmpty } from "@/utils/objects/empty";

const PARAM_REGEX_REPLACE = /\/:(\w+\??)/g;
const SPREAD_REGEX_REPLACE = /\/\.{3}(\w+\??)/g;

type RequestOptions<Request> = Merge<
	Omit<RequestInit, "method"> & {
		headers?: Record<string, string | readonly string[]>;
	},
	Request extends Record<PropertyKey, unknown>
		? ConditionallyOptional<Request, undefined>
		: NonNullable<unknown>
>;

type ParseResponse<Method, Request, Response> = Method extends "WS"
	? WS<Request, Response>
	: Response extends Generator<infer Yield> | AsyncGenerator<infer Yield>
		? SSE<Yield extends AnyGeneratorSSE ? Yield : never>
		: Response extends AnyError | AnySuccess
			? Response["transform"] extends true
				? Response
				: Response["content"]
			: Response;

type RouteHandler<Method, Request, Response> = (
	options?: RequestOptions<Request>,
) => Promise<ParseResponse<Method, Request, Response>>;

type ClientChain<Routes extends Record<PropertyKey, unknown>> = {
	[Key in keyof Routes]: Routes[Key] extends Record<PropertyKey, unknown>
		? Routes[Key] extends {
				request: infer Request;
				response: infer Response;
			}
			? RouteHandler<
					Key extends string ? Uppercase<Key> : never,
					Request,
					Response
				>
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
	{
		url: string;
	} & Omit<RequestInit, "method">
>;

const createProxy = (globalOptions: ClientOptions, paths: string[] = []) => {
	return new Proxy(() => {}, {
		async apply(target, thisArg, [requestOptions = FreezeEmpty]) {
			const options = {
				...(typeof globalOptions === "function"
					? await globalOptions()
					: globalOptions),
				...requestOptions,
			};

			const end = paths.length - 1;

			let path: string;

			if (end <= 0) {
				path = "";
			} else if (end === 1) {
				path = paths[0]!;
			} else {
				path = paths[0]!;

				for (let i = 1; i < end; i++) {
					path = `${path}/${paths[i]}`;
				}
			}

			let url = `${options.url}/${path}`;

			delete options.url;

			if (options.body) {
				const keys = Object.keys(options.body);

				let hasFile = false;

				for (let i = 0; i < keys.length; i++) {
					const key = keys[i];

					if (!key) {
						continue;
					}

					const value = options.body[key];

					if (
						value instanceof File ||
						value instanceof Blob ||
						(Array.isArray(value) &&
							value.length > 0 &&
							(value[0] instanceof File ||
								value[0] instanceof Blob))
					) {
						hasFile = true;

						break;
					}
				}

				if (hasFile) {
					const formData = new FormData();

					for (let i = 0; i < keys.length; i++) {
						const key = keys[i];

						if (!key) {
							continue;
						}

						const value = options.body[key];

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
					options.body = JSON.stringify(options.body);

					options.headers["content-type"] = "application/json";
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

			options.method = paths[end];

			if (options.method === "ws") {
				url = url.startsWith("https://")
					? url.replace("https://", "wss://")
					: url.replace("http://", "ws://");

				return (await import("@/ecosystem/client/ws")).ws(url);
			}

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

				for (const [key, value] of formData) {
					result[key] = value;
				}

				return result;
			}

			if (contentType.indexOf("text/event-stream") !== -1) {
				return (await import("@/ecosystem/client/sse")).sse(
					response.url,
					{
						withCredentials: true,
					},
				);
			}

			return response.text();
		},
		get(target, path: string) {
			return createProxy(
				globalOptions,
				path === "index" ? paths : paths.concat(path),
			);
		},
	});
};

export const client = <const App extends AnyModule>(options: ClientOptions) => {
	return createProxy(options) as unknown as ClientChain<App["routes"]>;
};
