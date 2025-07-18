import type { ExtractContent } from "@/types";

export type FilterError<Type> = Extract<Type, AnyError>;

export type IgnoreError<Type> = Exclude<Type, AnyError>;

export type TransformError<Error extends AnyError> = {
	[Key in Error["status"]]: Error;
};

export type MergeErrors<Errors, Error> = {
	[Key in keyof Errors | keyof Error]: Key extends keyof Errors
		? Key extends keyof Error
			? {
					[Key2 in
						| keyof Errors[Key]
						| keyof Error[Key]]: Key2 extends keyof Errors[Key]
						? Key2 extends keyof Error[Key]
							? Errors[Key][Key2] | Error[Key][Key2]
							: Errors[Key][Key2]
						: Key2 extends keyof Error[Key]
							? Error[Key][Key2]
							: never;
				}
			: Errors[Key]
		: Key extends keyof Error
			? Error[Key]
			: never;
};

export interface Error<
	Content,
	Status extends number,
	Transform extends boolean,
> {
	content: ExtractContent<Content>;
	status: Status;
	success: false;
	transform: Transform;
}

export type AnyError = Error<any, any, any>;

type Constructor = new (
	content: unknown,
	status?: number,
	transform?: boolean,
) => AnyError;

export const Error = function (
	this: AnyError,
	content: unknown,
	status = 400,
	transform = true,
) {
	this.content = content;
	this.status = status;
	this.success = false;
	this.transform = transform;
} as unknown as Constructor;

export const error = <
	const Content,
	const Status extends number = 400,
	const Transform extends boolean = true,
>(
	content: Content,
	status?: Status,
	transform?: Transform,
) => {
	return new Error(content, status, transform) as Error<
		Content,
		Status,
		Transform
	>;
};
