export type HttpMethod =
	| "CONNECT"
	| "DELETE"
	| "GET"
	| "HEAD"
	| "OPTIONS"
	| "PATCH"
	| "POST"
	| "PUT"
	| "QUERY"
	| "TRACE"
	// accepts any method while keeping autocomplete
	| (NonNullable<unknown> & string);
