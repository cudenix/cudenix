import type { Server } from "bun";

import type { Endpoint } from "@/app";
import type { AnyError } from "@/error";
import type { AnySuccess } from "@/success";
import { Empty } from "@/utils/empty";
import { getCookies } from "@/utils/get-cookies";
import { getUrlQueryRegexp, pathToRegexp } from "@/utils/regexp";

const endsWithBracketsRegexp = /\[\]$/;

export interface DeveloperContext<
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> {
	memory: Map<string, unknown>;
	request: {
		raw: Request;
	} & Validators;
	response: ContextResponse;
	server: Server;
	store: Stores;
}

export type AnyDeveloperContext = DeveloperContext<any, any>;

export interface ContextResponse {
	content?: AnyError | AnySuccess | ReadableStream;
	cookies: Map<string, string>;
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
	loadRequest(): Promise<void>;
	loadRequestBody(): Promise<void>;
	loadRequestCookies(): void;
	loadRequestHeaders(): void;
	loadRequestParams(): void;
	loadRequestQuery(): void;
	memory: Map<string, unknown>;
	request: ContextRequest;
	response: ContextResponse;
	server: Server;
	store: Record<PropertyKey, unknown>;
}

type Constructor = new (
	endpoint: Endpoint,
	memory: Map<string, unknown>,
	path: string,
	request: Request,
	server: Server,
) => Context;

export const Context = function (
	this: Context,
	endpoint: Endpoint,
	memory: Map<string, unknown>,
	path: string,
	request: Request,
	server: Server,
) {
	this.endpoint = endpoint;
	this.memory = memory;
	this.request = {
		path,
		raw: request,
	};
	this.response = {
		cookies: new Map(),
		headers: new Headers(),
	} as ContextResponse;
	this.server = server;
	this.store = new Empty();
} as unknown as Constructor;

Context.prototype.loadRequest = async function (this: Context) {
	const { use } = this.endpoint;

	if (use.has("body")) {
		await this.loadRequestBody();
	}

	if (use.has("headers") || use.has("cookies")) {
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
};

Context.prototype.loadRequestBody = async function (this: Context) {
	const contentType = this.request.raw.headers
		.get("Content-Type")
		?.toLowerCase()
		.split(";")[0];

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

		formData.forEach((value, key) => {
			if (result[key]) {
				if ((result[key] as any).pop) {
					(result[key] as unknown[]).push(value);
				} else {
					result[key] = [result[key], value];
				}
			} else {
				result[key] = value;
			}
		});

		this.request.body = result;

		return;
	}

	this.request.body = await this.request.raw.text();
};

Context.prototype.loadRequestCookies = function (this: Context) {
	const cookies = getCookies(this.request.raw.headers);

	this.request.cookies =
		Object.keys(cookies).length > 0 ? cookies : undefined;
};

Context.prototype.loadRequestHeaders = function (this: Context) {
	const headers = new Empty();

	this.request.raw.headers.forEach((value, key) => {
		headers[key] = value;
	});

	this.request.headers =
		Object.keys(headers).length > 0 ? headers : undefined;
};

Context.prototype.loadRequestParams = function (this: Context) {
	const regexp = new RegExp(`^${pathToRegexp(this.endpoint.path, true)}$`);
	const match = regexp.exec(this.request.path);

	if (!match) {
		return;
	}

	const groups = match.groups as
		| Record<string, string | string[]>
		| undefined;

	if (!groups) {
		return;
	}

	const keys = Object.keys(groups);

	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];

		if (
			typeof groups[key] === "string" &&
			groups[key].indexOf("/") !== -1
		) {
			groups[key] = (groups[key] as unknown as string).split("/");
		}
	}

	this.request.params = groups;
};

Context.prototype.loadRequestQuery = function (this: Context) {
	const params = new Empty();

	let match: RegExpExecArray | null;

	while (
		// biome-ignore lint/suspicious/noAssignInExpressions:
		(match = getUrlQueryRegexp.exec(
			decodeURIComponent(this.request.raw.url),
		))
	) {
		let [, key, value] = match;

		if (!(key && value)) {
			continue;
		}

		value = value.replaceAll("+", " ");

		params[key] = endsWithBracketsRegexp.test(key)
			? JSON.parse(value)
			: value;
	}

	this.request.query = Object.keys(params).length > 0 ? params : undefined;
};

export const context = (
	endpoint: Endpoint,
	memory: Map<string, unknown>,
	path: string,
	request: Request,
	server: Server,
) => new Context(endpoint, memory, path, request, server);
