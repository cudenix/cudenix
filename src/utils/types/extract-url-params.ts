import type { NormalizePathSeparators } from "@/utils/types/normalize-path-separators";
import type { Prettify } from "@/utils/types/prettify";

export type ExtractUrlParams<
	Path extends string,
	// "| undefined" covers optional properties
	Accumulated extends Record<string, string | string[] | undefined> =
		NonNullable<unknown>,
> = Path extends `${string}:${string}` | `${string}...${string}`
	? CollectParams<`/${NormalizePathSeparators<Path>}`, Accumulated>
	: Accumulated;

type AppendParam<
	Accumulated extends object,
	Param extends string,
	Value,
> = Param extends `${infer Name}?`
	? keyof Accumulated & Name extends never
		? Accumulated & Partial<Record<Name, undefined | Value>>
		: Override<Accumulated, Param, Value>
	: keyof Accumulated & Param extends never
		? Accumulated & Record<Param, Value>
		: Override<Accumulated, Param, Value>;

type CaptureParam<
	Tail extends string,
	Accumulated extends object,
	Value,
> = Tail extends `${infer Param}/${infer Rest}`
	? NextCapture<`/${Rest}`, AppendParam<Accumulated, Param, Value>>
	: AppendParam<Accumulated, Tail, Value>;

type CollectParams<
	Path extends string,
	Accumulated extends object,
> = Path extends `${string}/:${string}` | `${string}/...${string}`
	? Prettify<NextCapture<Path, Accumulated>>
	: 0 extends 1 & (Path extends `/${infer Body}` ? Body : never)
		?
				| Accumulated
				| Override<Accumulated, string, [string, ...string[]] | string>
		: Accumulated;

type NextCapture<
	Path extends string,
	Accumulated extends object,
> = Path extends `${infer Head}/:${infer Tail}`
	? Head extends `${string}/...${string}`
		? Path extends `${string}/...${infer RestTail}`
			? CaptureParam<RestTail, Accumulated, [string, ...string[]]>
			: never
		: CaptureParam<Tail, Accumulated, string>
	: Path extends `${string}/...${infer Tail}`
		? CaptureParam<Tail, Accumulated, [string, ...string[]]>
		: Accumulated;

type Override<
	Accumulated extends object,
	Param extends string,
	Value,
> = Accumulated extends unknown
	? Param extends `${infer Name}?`
		? Name extends keyof Accumulated
			? Prettify<
					{
						[K in keyof Accumulated as K]: K extends Name
							? Accumulated[K] | Value
							: Accumulated[K];
					} & NonNullable<unknown>
				>
			: Prettify<Accumulated & Partial<Record<Name, undefined | Value>>>
		: Prettify<
				{
					[
						K in keyof Accumulated as K extends Param ? never : K
					]: Accumulated[K];
				} & Record<Param, Value>
			>
	: never;
