export type HttpMethod =
	| "DELETE"
	| "GET"
	| "OPTIONS"
	| "PATCH"
	| "POST"
	| "PUT"
	| "WS"
	| (Uppercase<string> & NonNullable<unknown>);
