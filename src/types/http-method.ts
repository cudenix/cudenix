export type HttpMethod =
	| "DELETE"
	| "GET"
	| "HEAD"
	| "OPTIONS"
	| "PATCH"
	| "POST"
	| "PUT"
	| "WS"
	| (Uppercase<string> & NonNullable<unknown>);
