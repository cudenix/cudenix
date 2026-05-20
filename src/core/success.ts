import type { ExtractContent } from "@/types/extract-content";
import { FrozenEmpty } from "@/utils/objects/empty";

export type FilterSuccess<Type> = Extract<Type, AnySuccess>;

export type TransformSuccess<Success extends AnySuccess> = Record<
	Success["status"],
	Success
>;

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

export interface SuccessOptions<Status extends number> {
	status?: Status;
}

export type AnySuccessOptions = SuccessOptions<any>;

export interface Success<Content, Status extends number = 200> {
	content: ExtractContent<Content>;
	status: Status;
	success: true;
}

export type AnySuccess = Success<any, any>;

export interface SuccessConstructor {
	new <const Content, const Status extends number = 400>(
		content: Content,
		options?: SuccessOptions<Status>,
	): Success<Content, Status>;
}

export const Success = function Success(
	this: AnySuccess,
	content: unknown,
	{ status = 200 }: AnySuccessOptions = FrozenEmpty,
) {
	this.content = content;
	this.status = status;
	this.success = true;
} as unknown as SuccessConstructor;
