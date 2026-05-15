export type ExtractContent<Content> = Content extends (
	...args: any[]
) => infer Return
	? Awaited<Return>
	: Content;
