import type { ExtractContent } from "@/types/extract-content";
import { FrozenEmpty } from "@/utils/objects/empty";

export type FilterError<Type> = Extract<Type, AnyError>;

export type IgnoreError<Type> = Exclude<Type, AnyError>;

export type TransformError<Error extends AnyError> = Record<
	Error["status"],
	Error
>;

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

interface ErrorOptions<Status extends number> {
	status?: Status;
}

type AnyErrorOptions = ErrorOptions<any>;

export interface Error<Content, Status extends number = 400> {
	content: ExtractContent<Content>;
	status: Status;
	success: false;
}

export type AnyError = Error<any, any>;

interface Constructor {
	new <const Content, const Status extends number = 400>(
		content: Content,
		options?: ErrorOptions<Status>,
	): Error<Content, Status>;
}

export const Error = function Error(
	this: AnyError,
	content: unknown,
	{ status = 400 }: AnyErrorOptions = FrozenEmpty,
) {
	this.content = content;
	this.status = status;
	this.success = false;
} as unknown as Constructor;
