import type { Endpoint } from "@/core/app";
import {
	USE_BODY,
	USE_COOKIES,
	USE_HEADERS,
	USE_PARAMS,
	USE_QUERY,
} from "@/core/compile";
import type { AnyError } from "@/core/error";
import type { AnySuccess } from "@/core/success";
import type { MaybePromise } from "@/types/maybe-promise";
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
	memory: Map<string, unknown>;
	request: ContextRequest;
	response: ContextResponse;
	server: Bun.Server<unknown>;
	store: Record<PropertyKey, unknown>;
}

type Constructor = new (
	endpoint: Endpoint,
	memory: Map<string, unknown>,
	path: string,
	request: Request,
	server: Bun.Server<unknown>,
) => Context;

export const Context = function (
	this: Context,
	endpoint: Endpoint,
	memory: Map<string, unknown>,
	path: string,
	request: Request,
	server: Bun.Server<unknown>,
) {
	this.endpoint = endpoint;
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
	this.response = {
		content: undefined,
		cookies: new Bun.CookieMap(),
		headers: new Headers(),
	} as unknown as ContextResponse;
	this.server = server;
	this.store = new Empty();
} as unknown as Constructor;

Context.prototype.loadRequest = function (this: Context) {
	const { use } = this.endpoint;

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

Context.prototype.loadRequestBody = async function (this: Context) {
	const raw = this.request.raw.headers.get("content-type");

	if (!raw) {
		this.request.body = await this.request.raw.text();

		return;
	}

	const semi = raw.indexOf(";");
	const contentType =
		semi === -1 ? raw.toLowerCase() : raw.slice(0, semi).toLowerCase();

	if (contentType === "application/json") {
		this.request.body = await this.request.raw.json();

		return;
	}

	if (contentType === "application/octet-stream") {
		this.request.body = await this.request.raw.arrayBuffer();

		return;
	}

	if (
		contentType === "multipart/form-data" ||
		contentType === "application/x-www-form-urlencoded"
	) {
		const formData = await this.request.raw.formData();

		const result = new Empty();

		for (const [key, value] of formData) {
			if (result[key] === undefined) {
				result[key] = value;

				continue;
			}

			if (Array.isArray(result[key])) {
				result[key].push(value);

				continue;
			}

			result[key] = [result[key], value];
		}

		this.request.body = result;

		return;
	}

	this.request.body = await this.request.raw.text();
};

Context.prototype.loadRequestCookies = function (this: Context) {
	const header = this.request.raw.headers.get("cookie");

	if (!header) {
		this.response.cookies = new Bun.CookieMap();

		return;
	}

	const cookies = new Bun.CookieMap(header);

	this.response.cookies = cookies;

	if (cookies.size === 0) {
		return;
	}

	this.request.cookies = cookies.toJSON();
};

Context.prototype.loadRequestHeaders = function (this: Context) {
	if (this.request.raw.headers.count === 0) {
		return;
	}

	this.request.headers = this.request.raw.headers.toJSON();
};

Context.prototype.loadRequestParams = function (this: Context) {
	if (!this.endpoint.paramsRegexp) {
		return;
	}

	const match = this.endpoint.paramsRegexp.exec(this.request.path);

	if (!match) {
		return;
	}

	const groups = match.groups;

	if (!groups) {
		return;
	}

	for (const key in groups) {
		const value = groups[key];

		if (value === undefined || value.indexOf("%") === -1) {
			continue;
		}

		groups[key] = decodeURIComponent(value);
	}

	this.request.params = groups;
};

Context.prototype.loadRequestQuery = function (this: Context) {
	const url = this.request.raw.url;
	const queryIndex = url.indexOf("?");

	if (queryIndex === -1) {
		return;
	}

	const params = new Empty();

	let hasParams = false;
	let i = queryIndex + 1;

	while (i < url.length) {
		const keyStart = i;

		let flags = 0;

		while (i < url.length) {
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

		const hasValue = i < url.length && url.charCodeAt(i) === 61;

		let key = url.substring(keyStart, i);
		let value: string;

		if (hasValue) {
			i++;

			const valueStart = i;

			while (i < url.length) {
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
			value = "true";
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
			const parsed =
				firstChar === 123 || firstChar === 91 ? tryParse(value) : value;

			if (params[key] === undefined) {
				params[key] = parsed;
			} else if (Array.isArray(params[key])) {
				(params[key] as unknown[]).push(parsed);
			} else {
				params[key] = [params[key], parsed];
			}

			hasParams = true;
		}

		if (i >= url.length || url.charCodeAt(i) === 35) {
			break;
		}

		i++;
	}

	if (!hasParams) {
		return;
	}

	this.request.query = params;
};

export const context = (
	endpoint: Endpoint,
	memory: Map<string, unknown>,
	path: string,
	request: Request,
	server: Bun.Server<unknown>,
) => {
	return new Context(endpoint, memory, path, request, server);
};
