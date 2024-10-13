import type { SSE } from "@/ecosystem/client/sse";
import type { WS } from "@/ecosystem/client/ws";
import type { AnyModule } from "@/module";
import type { AnyGeneratorSSE, ConditionallyOptional, Merge } from "@/types";
import { Empty } from "@/utils/empty";
import { isFile } from "@/utils/file";

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
	: Response extends Generator<infer Yield>
		? SSE<Yield extends AnyGeneratorSSE ? Yield : never>
		: Response extends AsyncGenerator<infer Yield>
			? SSE<Yield extends AnyGeneratorSSE ? Yield : never>
			: Response;

type RouteHandler<Method, Request, Response> = (
	options?: RequestOptions<Request>,
) => Promise<ParseResponse<Method, Request, Response>>;

type Chain<Routes extends Record<PropertyKey, unknown>> = {
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
			: Chain<Routes[Key]>
		: never;
};

export type InferRouteOptions<Route> = Route extends (...options: any[]) => any
	? NonNullable<Parameters<Route>[0]>
	: never;

export type InferRouteResponse<Route> = Route extends (...options: any[]) => any
	? Awaited<ReturnType<Route>>
	: never;

const transform = (value: unknown) => {
	try {
		return JSON.parse(value as string) as Record<string, unknown>;
	} catch {}

	if (!Number.isNaN(Number(value))) {
		return Number(value);
	}

	if (value === "true") {
		return true;
	}

	if (value === "false") {
		return false;
	}

	const date = new Date(value as string);

	if (!Number.isNaN(date.getTime())) {
		return date;
	}

	return value;
};

const createProxy = (
	url: string,
	options: Omit<RequestInit, "method"> = new Empty(),
	paths: string[] = [],
): unknown => {
	return new Proxy(() => {}, {
		get(_target, path: string) {
			return createProxy(
				url,
				options,
				path === "index" ? paths : [...paths, path],
			);
		},
		apply(_target, _thisArg, [requestOptions = new Empty()]) {
			const mergedOptions = {
				...options,
				...requestOptions,
			};

			let _url = `${url}/${paths.slice(0, -1).join("/")}`;

			if (mergedOptions.body) {
				const keys = Object.keys(mergedOptions.body);

				let hasFile = false;

				for (let i = 0; i < keys.length; i++) {
					const key = keys[i];

					if (
						isFile(mergedOptions.body[key]) ||
						(mergedOptions.body[key]?.pop &&
							(mergedOptions.body[key] as Blob[]).some(isFile))
					) {
						hasFile = true;

						break;
					}
				}

				if (hasFile) {
					const formData = new FormData();

					for (let i = 0; i < keys.length; i++) {
						const key = keys[i];

						if (mergedOptions.body[key].pop) {
							for (
								let j = 0;
								j <
								(mergedOptions.body[key] as unknown[]).length;
								j++
							) {
								formData.append(
									key,
									(mergedOptions.body[key] as unknown[])[j],
								);
							}

							continue;
						}

						formData.append(key, mergedOptions.body[key]);
					}

					mergedOptions.body = formData;
				} else {
					try {
						mergedOptions.body = JSON.stringify(mergedOptions.body);

						mergedOptions.headers = {
							...mergedOptions.headers,
							"content-type": "application/json",
						};
					} catch {}
				}
			}

			if (mergedOptions.query) {
				const keys = Object.keys(mergedOptions.query);

				for (let i = 0; i < keys.length; i++) {
					const key = keys[i];

					if (mergedOptions.query[key] === undefined) {
						delete mergedOptions.query[key];
					}
				}

				_url = `${_url}?${new URLSearchParams(mergedOptions.query).toString()}`;
			}

			if (mergedOptions.headers) {
				const keys = Object.keys(mergedOptions.headers);

				for (let i = 0; i < keys.length; i++) {
					const key = keys[i];

					if (mergedOptions.headers[key] === undefined) {
						delete mergedOptions.headers[key];
					}
				}
			}

			if (/\/:(\w+\??)/g.test(_url)) {
				_url = _url.replaceAll(/\/:(\w+\??)/g, (_, key: string) => {
					const param = mergedOptions.params?.[
						key.replaceAll("?", "")
					] as string | undefined;

					return param ? `/${param}` : "";
				});
			}

			if (/\/\.{3}(\w+\??)/g.test(_url)) {
				_url = _url.replaceAll(/\/\.{3}(\w+\??)/g, (_, key: string) => {
					const params = mergedOptions.params?.[
						key.replaceAll("?", "")
					] as string[] | undefined;

					return params ? `/${params.join("/")}` : "";
				});
			}

			mergedOptions.method = paths.slice(-1)[0];

			return (async () => {
				if (mergedOptions.method === "ws") {
					_url = _url.startsWith("https://")
						? _url.replace("https://", "wss://")
						: _url.replace("http://", "ws://");

					return (await import("@/ecosystem/client/ws")).ws(_url);
				}

				const response = await fetch(_url, mergedOptions);
				const contentType = response.headers
					.get("Content-Type")
					?.toLowerCase()
					.split(";")[0];

				if (contentType === "application/json") {
					return await response.json();
				}

				if (contentType === "text/event-stream") {
					return (await import("@/ecosystem/client/sse")).sse(
						response.url,
						{
							withCredentials: true,
						},
					);
				}

				return transform(await response.text());
			})();
		},
	});
};

export const client = <const App extends AnyModule>(
	url: string,
	options?: Omit<RequestInit, "method">,
) => createProxy(url, options) as Chain<App["routes"]>;
