import {
	USE_BODY,
	USE_COOKIES,
	USE_HEADERS,
	USE_PARAMS,
	USE_QUERY,
} from "@/core/analyzer";
import type { Endpoint } from "@/core/app";
import type { AnyError } from "@/core/error";
import type { AnySuccess } from "@/core/success";
import type { MaybePromise } from "@/types/maybe-promise";
import { parseCookies } from "@/utils/cookies/parse-cookies";
import { tryParse } from "@/utils/json/try-parse";
import { Empty } from "@/utils/objects/empty";

const Q_KEY_PLUS = 1;
const Q_KEY_PCT = 2;
const Q_VAL_PLUS = 4;
const Q_VAL_PCT = 8;

export interface DeveloperContext<
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> {
	memory: Map<string, unknown>;
	request: {
		raw: Request;
	} & Validators;
	response: ContextResponse;
	server: Bun.Server<unknown>;
	store: Stores;
}

export type AnyDeveloperContext = DeveloperContext<any, any>;

export interface ContextResponse {
	content?: AnyError | AnySuccess | ReadableStream;
	cookies: Bun.CookieMap;
	headers: Headers;
}

interface ContextRequest {
	body?: unknown;
	cookies?: unknown;
	headers?: unknown;
	params?: unknown;
	path: string;
	query?: unknown;
	raw: Request;
}

export interface Context {
	endpoint: Endpoint;
	loadRequest(): MaybePromise<void>;
	loadRequestBody(): Promise<void>;
	loadRequestCookies(): void;
	loadRequestHeaders(): void;
	loadRequestParams(): void;
	loadRequestQuery(): void;
	match?: RegExpExecArray;
	memory: Map<string, unknown>;
	request: ContextRequest;
	response: ContextResponse;
	server: Bun.Server<unknown>;
	store: Record<PropertyKey, unknown>;
}

type ContextResponseConstructor = new (
	cookies?: Bun.CookieMap,
) => ContextResponse;

const ContextResponse = function (
	this: ContextResponse,
	cookies?: Bun.CookieMap,
) {
	this.content = undefined;

	if (cookies) {
		(this as any)._cookies = cookies;
	}
} as unknown as ContextResponseConstructor;

Object.defineProperty(ContextResponse.prototype, "headers", {
	configurable: true,
	enumerable: true,
	get() {
		const headers = this._headers;

		if (headers) {
			return headers;
		}

		this._headers = new Headers();

		return this._headers;
	},
	set(value: Headers) {
		this._headers = value;
	},
});

Object.defineProperty(ContextResponse.prototype, "cookies", {
	configurable: true,
	enumerable: true,
	get() {
		const cookies = this._cookies;

		if (cookies) {
			return cookies;
		}

		this._cookies = new Bun.CookieMap();

		return this._cookies;
	},
	set(value: Bun.CookieMap) {
		this._cookies = value;
	},
});

type Constructor = new (
	endpoint: Endpoint,
	memory: Map<string, unknown>,
	path: string,
	request: Request,
	server: Bun.Server<unknown>,
	match?: RegExpExecArray,
) => Context;

export const Context = function (
	this: Context,
	endpoint: Endpoint,
	memory: Map<string, unknown>,
	path: string,
	request: Request,
	server: Bun.Server<unknown>,
	match?: RegExpExecArray,
) {
	this.endpoint = endpoint;
	this.match = match;
	this.memory = memory;
	this.request = {
		body: undefined,
		cookies: undefined,
		headers: undefined,
		params: undefined,
		path,
		query: undefined,
		raw: request,
	};
	this.response = new ContextResponse(
		endpoint.router === "bun"
			? (request as Bun.BunRequest).cookies
			: undefined,
	);
	this.server = server;
	this.store = new Empty();
} as unknown as Constructor;

Context.prototype.loadRequest = function loadRequest(this: Context) {
	const use = this.endpoint.use;

	if (use & USE_HEADERS) {
		this.loadRequestHeaders();
	}

	if (use & USE_COOKIES) {
		this.loadRequestCookies();
	}

	if (use & USE_PARAMS) {
		this.loadRequestParams();
	}

	if (use & USE_QUERY) {
		this.loadRequestQuery();
	}

	if (use & USE_BODY) {
		return this.loadRequestBody();
	}
};

Context.prototype.loadRequestBody = async function loadRequestBody(
	this: Context,
) {
	const rawContentType = this.request.raw.headers.get("content-type");

	if (!rawContentType) {
		this.request.body = await this.request.raw.text();

		return;
	}

	if (rawContentType === "application/json") {
		this.request.body = await this.request.raw.json();

		return;
	}

	if (rawContentType === "application/octet-stream") {
		this.request.body = await this.request.raw.arrayBuffer();

		return;
	}

	let isForm =
		rawContentType === "multipart/form-data" ||
		rawContentType === "application/x-www-form-urlencoded";

	if (!isForm) {
		const semiIndex = rawContentType.indexOf(";");

		if (semiIndex !== -1) {
			if (
				semiIndex === 16 &&
				rawContentType.startsWith("application/json")
			) {
				this.request.body = await this.request.raw.json();

				return;
			}

			if (
				semiIndex === 24 &&
				rawContentType.startsWith("application/octet-stream")
			) {
				this.request.body = await this.request.raw.arrayBuffer();

				return;
			}

			isForm =
				(semiIndex === 19 &&
					rawContentType.startsWith("multipart/form-data")) ||
				(semiIndex === 33 &&
					rawContentType.startsWith(
						"application/x-www-form-urlencoded",
					));
		}
	}

	if (isForm) {
		const formData = await this.request.raw.formData();

		const body = new Empty();

		formData.forEach((value, key) => {
			if (body[key] === undefined) {
				body[key] = value;

				return;
			}

			if (Array.isArray(body[key])) {
				body[key].push(value);

				return;
			}

			body[key] = [body[key], value];
		});

		this.request.body = body;

		return;
	}

	this.request.body = await this.request.raw.text();
};

Context.prototype.loadRequestCookies = function loadRequestCookies(
	this: Context,
) {
	const header = this.request.raw.headers.get("cookie");

	if (!header) {
		return;
	}

	this.request.cookies = parseCookies(header);
};

Context.prototype.loadRequestHeaders = function loadRequestHeaders(
	this: Context,
) {
	if (this.request.raw.headers.count === 0) {
		return;
	}

	this.request.headers = this.request.raw.headers.toJSON();
};

Context.prototype.loadRequestParams = function loadRequestParams(
	this: Context,
) {
	const endpoint = this.endpoint;

	if (endpoint.router === "bun") {
		this.request.params = (this.request.raw as Bun.BunRequest).params;

		return;
	}

	const match = this.match;
	const paramKeys = endpoint.paramKeys;

	if (!match || !paramKeys || paramKeys.length === 0) {
		return;
	}

	const params = new Empty() as Record<string, string | string[]>;
	const restKeys = endpoint.restKeys;
	const offset = endpoint.markerIndex! + 1;

	for (let i = 0; i < paramKeys.length; i++) {
		const value = match[offset + i];

		if (value === undefined) {
			continue;
		}

		const name = paramKeys[i]!;
		const decoded =
			value.indexOf("%") === -1 ? value : decodeURIComponent(value);

		if (restKeys?.has(name)) {
			params[name] = decoded.split("/");
		} else {
			params[name] = decoded;
		}
	}

	this.request.params = params;
};

Context.prototype.loadRequestQuery = function loadRequestQuery(this: Context) {
	const url = this.request.raw.url;
	const queryIndex = url.indexOf("?");

	if (queryIndex === -1) {
		return;
	}

	const urlLength = url.length;

	const params = new Empty();

	let hasParams = false;
	let i = queryIndex + 1;

	while (i < urlLength) {
		const keyStart = i;

		let flags = 0;

		while (i < urlLength) {
			const char = url.charCodeAt(i);

			if (char === 61 || char === 38 || char === 35) {
				break;
			}

			if (char === 43) {
				flags |= Q_KEY_PLUS;
			} else if (char === 37) {
				flags |= Q_KEY_PCT;
			}

			i++;
		}

		const hasValue = i < urlLength && url.charCodeAt(i) === 61;

		let key = url.substring(keyStart, i);
		let value: string;

		if (hasValue) {
			i++;

			const valueStart = i;

			while (i < urlLength) {
				const char = url.charCodeAt(i);

				if (char === 38 || char === 35) {
					break;
				}

				if (char === 43) {
					flags |= Q_VAL_PLUS;
				} else if (char === 37) {
					flags |= Q_VAL_PCT;
				}

				i++;
			}

			value = url.substring(valueStart, i);
		} else {
			value = "";
		}

		if (key.length > 0) {
			if (flags & Q_KEY_PLUS) {
				key = key.replaceAll("+", " ");
			}

			if (flags & Q_KEY_PCT) {
				key = decodeURIComponent(key);
			}

			if (hasValue) {
				if (flags & Q_VAL_PLUS) {
					value = value.replaceAll("+", " ");
				}

				if (flags & Q_VAL_PCT) {
					value = decodeURIComponent(value);
				}
			}

			const firstChar = value.charCodeAt(0);

			let parsed = value as unknown;

			if (firstChar === 123 || firstChar === 91) {
				const lastChar = value.charCodeAt(value.length - 1);

				if (
					(firstChar === 123 && lastChar === 125) ||
					(firstChar === 91 && lastChar === 93)
				) {
					parsed = tryParse(value);
				}
			}

			if (params[key] === undefined) {
				params[key] = parsed;
			} else if (Array.isArray(params[key])) {
				(params[key] as unknown[]).push(parsed);
			} else {
				params[key] = [params[key], parsed];
			}

			hasParams = true;
		}

		if (i >= urlLength || url.charCodeAt(i) === 35) {
			break;
		}

		i++;
	}

	if (!hasParams) {
		return;
	}

	this.request.query = params;
};
