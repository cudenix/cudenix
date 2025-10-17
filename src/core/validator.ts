import type { Error } from "@/core";
import type { ConditionallyOmit, ExtendsType, MaybePromise } from "@/types";

export type ValidatorPlugin = (
	schema: any,
	input: unknown,
	type: keyof ValidatorRequest,
) => MaybePromise<{
	content: unknown;
	success: boolean;
}>;

export type DeepInferValidatorError<Type extends Record<PropertyKey, unknown>> =
	{
		[Key in keyof Type]: Cudenix.InferValidatorError<Type[Key]>;
	};

export type DeepInferValidatorInput<Type extends Record<PropertyKey, unknown>> =
	{
		[Key in keyof Type]: Cudenix.InferValidatorInput<Type[Key]>;
	};

export type DeepInferValidatorOutput<
	Type extends Record<PropertyKey, unknown>,
> = {
	[Key in keyof Type]: Cudenix.InferValidatorOutput<Type[Key]>;
};

export type ValidatorErrorDetails<Type> = {
	[Key in keyof Type]: {
		details: [Type[Key]];
		type: Key;
	};
}[keyof Type];

export interface TransformValidatorError<
	ValidatorError extends Record<PropertyKey, unknown>,
> {
	422: Error<
		[
			{
				details: [ValidatorErrorDetails<ValidatorError>];
			},
		],
		422,
		true
	>;
}

export type MergeInferValidatorRequest<
	FirstType extends Record<PropertyKey, unknown>,
	SecondType extends Record<PropertyKey, unknown>,
> = ConditionallyOmit<
	{
		body: ExtendsType<SecondType["body"], unknown, FirstType["body"]>;
		cookies: ExtendsType<
			SecondType["cookies"],
			unknown,
			FirstType["cookies"]
		>;
		headers: ExtendsType<
			SecondType["headers"],
			unknown,
			FirstType["headers"]
		>;
		params: ExtendsType<SecondType["params"], unknown, FirstType["params"]>;
		query: ExtendsType<SecondType["query"], unknown, FirstType["query"]>;
	},
	unknown
>;

export interface ValidatorRequest<
	Body = unknown,
	Cookies = unknown,
	Headers = unknown,
	Params = unknown,
	Query = unknown,
> {
	body: Body;
	cookies: Cookies;
	headers: Headers;
	params: Params;
	query: Query;
}

export interface Validator<Request extends Partial<ValidatorRequest>> {
	request: Request;
	type: "VALIDATOR";
	keys: (keyof ValidatorRequest)[];
}

export type AnyValidator = Validator<any>;

export interface ValidatorOptions<Request extends Partial<ValidatorRequest>> {
	request: Request;
}

export type AnyValidatorOptions = ValidatorOptions<any>;

type Constructor = new (options: AnyValidatorOptions) => AnyValidator;

export const Validator = function (
	this: AnyValidator,
	options: AnyValidatorOptions,
) {
	this.request = options.request;
	this.type = "VALIDATOR";
	this.keys = Object.keys(options.request) as (keyof ValidatorRequest)[];
} as unknown as Constructor;

export const validator = <const Request extends Partial<ValidatorRequest>>(
	options: ValidatorOptions<Request>,
) => {
	return new Validator(options) as Validator<Request>;
};
