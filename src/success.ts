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

export interface Success<
	Content,
	Status extends number,
	Transform extends boolean,
> {
	content: ExtractContent<Content>;
	status: Status;
	success: true;
	transform: Transform;
}

export type AnySuccess = Success<any, any, any>;

type Constructor = new (
	content: unknown,
	status?: number,
	transform?: boolean,
) => AnySuccess;

export const Success = function (
	this: AnySuccess,
	content: unknown,
	status = 200,
	transform = true,
) {
	this.content = content;
	this.status = status;
	this.success = true;
	this.transform = transform;
} as unknown as Constructor;

export const success = <
	const Content,
	const Status extends number = 200,
	const Transform extends boolean = true,
>(
	content: Content,
	status?: Status,
	transform?: Transform,
) =>
	new Success(content, status, transform) as Success<
		Content,
		Status,
		Transform
	>;
