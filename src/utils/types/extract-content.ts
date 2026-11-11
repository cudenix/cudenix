export type ExtractContent<T> = T extends (...args: any[]) => infer Return
	? Awaited<Return>
	: T;
