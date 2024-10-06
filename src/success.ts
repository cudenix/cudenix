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

export interface Success<Content, Status extends number> {
	content: ExtractContent<Content>;
	status: Status;
	success: true;
}

export type AnySuccess = Success<any, any>;

type Constructor = new (content: unknown, status?: number) => AnySuccess;

export const Success = function (
	this: AnySuccess,
	content: unknown,
	status = 200,
) {
	this.content = content;
	this.status = status;
	this.success = true;
} as unknown as Constructor;

export const success = <const Content, const Status extends number = 200>(
	content: Content,
	status?: Status,
) => new Success(content, status) as Success<Content, Status>;
