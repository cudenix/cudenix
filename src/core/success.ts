import type { ExtractContent } from "@/types";

export type FilterSuccess<Type> = Extract<Type, AnySuccess>;

export type TransformSuccess<Success extends AnySuccess> = {
	[Key in Success["status"]]: Success;
};

export type MergeSuccesses<Successes, Success> = {
	[Key in keyof Successes | keyof Success]: Key extends keyof Successes
		? Key extends keyof Success
			? {
					[Key2 in
						| keyof Successes[Key]
						| keyof Success[Key]]: Key2 extends keyof Successes[Key]
						? Key2 extends keyof Success[Key]
							? Successes[Key][Key2] | Success[Key][Key2]
							: Successes[Key][Key2]
						: Key2 extends keyof Success[Key]
							? Success[Key][Key2]
							: never;
				}
			: Successes[Key]
		: Key extends keyof Success
			? Success[Key]
			: never;
};

export interface SuccessOptions<
	Status extends number,
	Transform extends boolean,
> {
	status?: Status;
	transform?: Transform;
}

export type AnySuccessOptions = SuccessOptions<any, any>;

export interface Success<
	Content,
	Status extends number = 200,
	Transform extends boolean = true,
> {
	content: ExtractContent<Content>;
	status: Status;
	success: true;
	transform: Transform;
}

export type AnySuccess = Success<any, any, any>;

type Constructor = new (
	content: unknown,
	options?: AnySuccessOptions,
) => AnySuccess;

export const Success = function (
	this: AnySuccess,
	content: unknown,
	options: AnySuccessOptions = {
		status: 200,
		transform: true,
	},
) {
	this.content = content;
	this.status = options.status;
	this.success = true;
	this.transform = options.transform;
} as unknown as Constructor;

export const success = <
	const Content,
	const Status extends number = 200,
	const Transform extends boolean = true,
>(
	content: Content,
	options?: SuccessOptions<Status, Transform>,
) => {
	return new Success(content, options) as Success<Content, Status, Transform>;
};
