export type ExtractContent<Content> = Content extends (...args: any[]) => any
	? Awaited<ReturnType<Content>>
	: Content;
