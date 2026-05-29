import type { Cudenix, Endpoint } from "@/core/cudenix";
import type { AnyError } from "@/core/error";
import type { AnySuccess } from "@/core/success";
import { parseBody } from "@/utils/bodies/parse-body";
import { parseCookies } from "@/utils/cookies/parse-cookies";
import { Empty } from "@/utils/objects/empty";
import { parseParams } from "@/utils/urls/parse-params";
import { parseQuery } from "@/utils/urls/parse-query";

export type DeveloperContext<
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = Omit<
	Context<Stores, Validators>,
	| "endpoint"
	| "match"
	| "parseRequestBody"
	| "parseRequestCookies"
	| "parseRequestHeaders"
	| "parseRequestParams"
	| "parseRequestQuery"
>;

export type AnyDeveloperContext = DeveloperContext<any, any>;

export interface ContextResponse {
	content?: AnyError | AnySuccess | ReadableStream;
	cookies: Record<string, string>;
	headers: Record<string, string>;
}

export interface Context<
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> {
	endpoint: Endpoint;
	match?: RegExpExecArray;
	memory: Cudenix["memory"];
	parseRequestBody(): Promise<void>;
	parseRequestCookies(): void;
	parseRequestHeaders(): void;
	parseRequestParams(): void;
	parseRequestQuery(): void;
	request: { raw: Request } & Validators;
	response: ContextResponse;
	server: NonNullable<Cudenix["server"]>;
	store: Stores;
}

export type AnyContext = Context<any, any>;

export interface ContextConstructor {
	new (
		app: Cudenix,
		endpoint: Endpoint,
		request: Request,
		match?: RegExpExecArray,
	): AnyContext;
}

export const Context = function (
	this: AnyContext,
	app: Cudenix,
	endpoint: Endpoint,
	request: Request,
	match?: RegExpExecArray,
) {
	this.endpoint = endpoint;
	this.match = match;
	this.memory = app.memory;
	this.request = new Empty() as unknown as AnyContext["request"];
	this.response = new Empty() as unknown as AnyContext["response"];
	this.server = app.server!;
	this.store = new Empty();

	this.request.raw = request;

	this.response.cookies = new Empty() as ContextResponse["cookies"];
	this.response.headers = new Empty() as ContextResponse["headers"];
} as unknown as ContextConstructor;

Context.prototype.parseRequestBody = async function parseRequestBody(
	this: AnyContext,
) {
	this.request.body = await parseBody(this.request.raw);
};

Context.prototype.parseRequestCookies = function parseRequestCookies(
	this: AnyContext,
) {
	this.request.cookies = parseCookies(this.request.raw.headers.get("cookie"));
};

Context.prototype.parseRequestHeaders = function parseRequestHeaders(
	this: AnyContext,
) {
	this.request.headers = this.request.raw.headers.toJSON();
};

Context.prototype.parseRequestParams = function parseRequestParams(
	this: AnyContext,
) {
	const endpoint = this.endpoint;

	this.request.params =
		endpoint.router === "bun"
			? this.request.raw.params
			: parseParams(
					this.match,
					endpoint.paramKeys,
					endpoint.matchOffset,
					endpoint.restKeys,
				);
};

Context.prototype.parseRequestQuery = function parseRequestQuery(
	this: AnyContext,
) {
	this.request.query = parseQuery(this.request.raw.url);
};
