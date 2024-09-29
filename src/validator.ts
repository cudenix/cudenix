import type { App } from "@/app";
import type { Error } from "@/error";
import type { ConditionallyOmit, ExtendsType, MaybePromise } from "@/types";
import type {
	InferValidatorError,
	InferValidatorInput,
	InferValidatorOutput,
} from "@cudenix/cudenix";

export type ValidatorConfigValidator = (
	schema: any,
	input: unknown,
	type: keyof ValidatorRequest,
) => MaybePromise<{
	content: unknown;
	success: boolean;
}>;

export type DeepInferValidatorError<Type extends Record<PropertyKey, unknown>> =
	{
		[Key in keyof Type]: InferValidatorError<Type[Key]>;
	};

export type DeepInferValidatorInput<Type extends Record<PropertyKey, unknown>> =
	{
		[Key in keyof Type]: InferValidatorInput<Type[Key]>;
	};

export type DeepInferValidatorOutput<
	Type extends Record<PropertyKey, unknown>,
> = {
	[Key in keyof Type]: InferValidatorOutput<Type[Key]>;
};

export type ValidatorErrorDetails<Type> = {
	[Key in keyof Type]: { details: [Type[Key]]; type: Key };
}[keyof Type];

export interface TransformValidatorError<
	ValidatorError extends Record<PropertyKey, unknown>,
> {
	422: Error<[{ details: [ValidatorErrorDetails<ValidatorError>] }], 422>;
}

export type MergeInferValidatorRequest<
	FirstType extends Record<PropertyKey, unknown>,
	SecondType extends Record<PropertyKey, unknown>,
> = ConditionallyOmit<
	{
		body: ExtendsType<SecondType["body"], unknown, FirstType["body"]>;
		cookies: ExtendsType<SecondType["cookies"], unknown, FirstType["cookies"]>;
		headers: ExtendsType<SecondType["headers"], unknown, FirstType["headers"]>;
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
}

export type AnyValidator = Validator<any>;

export interface ValidatorOptions<Request extends Partial<ValidatorRequest>> {
	request: Request;
}

export type AnyValidatorOptions = ValidatorOptions<any>;

type Constructor = new (options: AnyValidatorOptions) => AnyValidator;

export const Validator = function (
	this: AnyValidator,
	{ request }: AnyValidatorOptions,
) {
	this.request = request;
	this.type = "VALIDATOR";
} as unknown as Constructor;

export const validator = <const Request extends Partial<ValidatorRequest>>(
	options: ValidatorOptions<Request>,
) => new Validator(options) as Validator<Request>;

export function validatorConfig(validator: ValidatorConfigValidator) {
	return function (this: App) {
		this.memory.set("validator", validator);
	};
}
