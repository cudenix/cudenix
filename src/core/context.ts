import type { Endpoint } from "@/core/app";
import type { AnyError } from "@/core/error";
import type { AnySuccess } from "@/core/success";
import type { MaybePromise } from "@/types/maybe-promise";
import { Empty } from "@/utils/objects/empty";

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

export interface ContextRequest {
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
		path,
		raw: request,
	};
	this.response = {
		cookies: new Bun.CookieMap(),
		headers: new Headers(),
	} as ContextResponse;
	this.server = server;
	this.store = new Empty();
} as unknown as Constructor;

Context.prototype.loadRequest = function (this: Context) {
	const { use } = this.endpoint;

	if (use.has("headers")) {
		this.loadRequestHeaders();
	}

	if (use.has("cookies")) {
		this.loadRequestCookies();
	}

	if (use.has("params")) {
		this.loadRequestParams();
	}

	if (use.has("query")) {
		this.loadRequestQuery();
	}

	if (use.has("body")) {
		return this.loadRequestBody();
	}
};

Context.prototype.loadRequestBody = async function (this: Context) {
	const raw = this.request.raw.headers.get("Content-Type");

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

	if (contentType === "multipart/form-data") {
		const formData = await this.request.raw.formData();

		const result = new Empty();

		for (const [key, value] of formData.entries()) {
			if (key in result) {
				if (Array.isArray(result[key])) {
					result[key].push(value);
				} else {
					result[key] = [result[key], value];
				}
			} else {
				result[key] = value;
			}
		}

		this.request.body = result;

		return;
	}

	this.request.body = await this.request.raw.text();
};

Context.prototype.loadRequestCookies = function (this: Context) {
	const header = this.request.raw.headers.get("Cookie");

	if (!header) {
		return;
	}

	this.response.cookies = new Bun.CookieMap(header);

	const cookies = this.response.cookies.toJSON();

	let hasCookies = false;

	for (const cookie in cookies) {
		hasCookies = true;

		break;
	}

	if (!hasCookies) {
		return;
	}

	this.request.cookies = cookies;
};

Context.prototype.loadRequestHeaders = function (this: Context) {
	const headers = new Empty();

	let hasHeaders = false;

	this.request.raw.headers.forEach((value, key) => {
		headers[key] = value;

		hasHeaders = true;
	});

	if (!hasHeaders) {
		return;
	}

	this.request.headers = headers;
};

Context.prototype.loadRequestParams = function (this: Context) {
	const match = this.endpoint.paramsRegexp.exec(this.request.path);

	if (!match) {
		return;
	}

	const groups = match.groups as
		| Record<string, string | string[]>
		| undefined;

	if (!groups) {
		return;
	}

	for (const key in groups) {
		if (
			typeof groups[key] === "string" &&
			groups[key].indexOf("/") !== -1
		) {
			groups[key] = groups[key].split("/");
		}
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

		while (i < url.length) {
			const char = url.charCodeAt(i);

			if (char === 61 || char === 38 || char === 35) {
				break;
			}

			i++;
		}

		if (i >= url.length || url.charCodeAt(i) === 35) {
			break;
		}

		if (url.charCodeAt(i) === 38) {
			i++;

			continue;
		}

		const key = url.substring(keyStart, i);

		i++;

		const valueStart = i;

		while (i < url.length) {
			const char = url.charCodeAt(i);

			if (char === 38 || char === 35) {
				break;
			}

			i++;
		}

		if (key.length > 0) {
			const rawValue = url.substring(valueStart, i);

			let value =
				rawValue.indexOf("+") === -1
					? rawValue.indexOf("%") === -1
						? rawValue
						: decodeURIComponent(rawValue)
					: decodeURIComponent(rawValue.replaceAll("+", " "));

			if (value.startsWith("sos-") && value.endsWith("-eos")) {
				try {
					value = JSON.parse(value.slice(4, -4));
				} catch {}
			} else if (value.startsWith("sas-") && value.endsWith("-eas")) {
				try {
					value = JSON.parse(value.slice(4, -4));
				} catch {}
			}

			params[key.indexOf("%") === -1 ? key : decodeURIComponent(key)] =
				value;

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
