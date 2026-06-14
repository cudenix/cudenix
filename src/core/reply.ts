import { FrozenEmpty } from "@/utils/objects/empty";
import type { ExtractContent } from "@/utils/types/extract-content";

/**
 * @module
 * Response envelope (`Reply`) with its `ok` / `fail` factories and the
 * `MergeReplies` type helper.
 */

/**
 * Response envelope returned by middlewares, stores, validators, and route
 * handlers, with `success` as the discriminant between the success and error
 * directions. Build one with the {@link ok} / {@link fail} factories;
 * {@link Fail} and {@link Ok} are the directional aliases.
 *
 * @example
 * ```typescript
 * const a: Reply<{ a: "v1" }, 200, true> = {
 *   content: { a: "v1" },
 *   status: 200,
 *   success: true,
 * };
 * ```
 */
export interface Reply<
	Content,
	Status extends number = 200,
	Ok extends boolean = true,
> {
	content: ExtractContent<Content>;
	status: Status;
	success: Ok;
}

/**
 * Any {@link Reply} regardless of its content, status, or discriminant
 * generics. Use it where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyReply = ok({ a: "v1" });
 *
 * a.status; // 200
 * ```
 */
export type AnyReply = Reply<any, any, any>;

/**
 * Error direction of a {@link Reply} — discriminant fixed to `false`, status
 * defaulting to `400`. Build one with {@link fail}.
 *
 * @example
 * ```typescript
 * const a: Fail<{ a: "v1" }, 400> = {
 *   content: { a: "v1" },
 *   status: 400,
 *   success: false,
 * };
 * ```
 */
export type Fail<Content, Status extends number = 400> = Reply<
	Content,
	Status,
	false
>;

/**
 * Success direction of a {@link Reply} — discriminant fixed to `true`, status
 * defaulting to `200`. Build one with {@link ok}.
 *
 * @example
 * ```typescript
 * const a: Ok<{ a: "v1" }, 200> = {
 *   content: { a: "v1" },
 *   status: 200,
 *   success: true,
 * };
 * ```
 */
export type Ok<Content, Status extends number = 200> = Reply<
	Content,
	Status,
	true
>;

/**
 * Any error-direction {@link Reply} (`success: false`) regardless of its
 * content or status generics. Use it where the concrete generics are
 * irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyFail = fail({ a: "v1" });
 *
 * a.success; // false
 * ```
 */
export type AnyFail = Reply<any, any, false>;

/**
 * Any success-direction {@link Reply} (`success: true`) regardless of its
 * content or status generics. Use it where the concrete generics are
 * irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyOk = ok({ a: "v1" });
 *
 * a.success; // true
 * ```
 */
export type AnyOk = Reply<any, any, true>;

/**
 * Deeply merge two status-keyed reply dictionaries.
 *
 * @example
 * ```typescript
 * type A = MergeReplies<
 *   { 400: { content: ["a"]; status: 400; success: false } },
 *   { 400: { content: ["b"]; status: 400; success: false } }
 * >;
 * // { 400: { content: ["a"] | ["b"]; status: 400; success: false } }
 * ```
 */
export type MergeReplies<T extends object, U extends object> = {
	[K in keyof T | keyof U]: K extends keyof T
		? K extends keyof U
			? {
					[K2 in keyof T[K] | keyof U[K]]: K2 extends keyof T[K]
						? K2 extends keyof U[K]
							? T[K][K2] | U[K][K2]
							: T[K][K2]
						: K2 extends keyof U[K]
							? U[K][K2]
							: never;
				}
			: T[K]
		: K extends keyof U
			? U[K]
			: never;
};

/**
 * Options accepted by the {@link ok} / {@link fail} factories.
 *
 * @example
 * ```typescript
 * const a: ReplyOptions<401> = { status: 401 };
 *
 * fail({ a: 1 }, a); // Fail<{ a: 1 }, 401>
 * ```
 */
export interface ReplyOptions<Status extends number = number> {
	status?: Status;
}

/**
 * Any {@link ReplyOptions} regardless of its status generic. Use it where the
 * concrete status is irrelevant.
 *
 * @example
 * ```typescript
 * const fn = ({ status = 200 }: AnyReplyOptions) => status;
 *
 * fn({ status: 201 }); // 201
 * fn({}); // 200
 * ```
 */
export type AnyReplyOptions = ReplyOptions<any>;

/**
 * Constructor signature of {@link Reply}. Prefer {@link ok} / {@link fail}
 * over invoking it directly.
 *
 * @example
 * ```typescript
 * const Ctor: ReplyConstructor = Reply;
 *
 * const a = new Ctor("v1", { status: 401, success: false });
 *
 * a.success; // false
 * ```
 */
export interface ReplyConstructor {
	new <const Content, const Status extends number, const Ok extends boolean>(
		content: Content,
		options: { status: Status; success: Ok },
	): Reply<Content, Status, Ok>;
}

/**
 * Constructor for a {@link Reply} envelope; must be invoked with `new`.
 * Prefer the {@link ok} / {@link fail} factories.
 *
 * @example
 * ```typescript
 * const a = new Reply("v1", { status: 200, success: true });
 *
 * a.content; // "v1"
 * a.success; // true
 * ```
 */
export const Reply = function Reply(
	this: AnyReply,
	content: unknown,
	{ status, success }: { status: number; success: boolean },
) {
	this.content = content;
	this.status = status;
	this.success = success;
} as unknown as ReplyConstructor;

type OkFactory = <const Content, const Status extends number = 200>(
	content: Content,
	options?: ReplyOptions<Status>,
) => Ok<Content, Status>;

type FailFactory = <const Content, const Status extends number = 400>(
	content: Content,
	options?: ReplyOptions<Status>,
) => Fail<Content, Status>;

/**
 * Build a success {@link Reply} ({@link Ok}) from a payload and an optional
 * status (defaults to `200`).
 *
 * @example
 * ```typescript
 * const a = ok({ a: "v1" }); // status 200, success true
 *
 * const b = ok({ a: 1 }, { status: 201 }); // status 201
 * ```
 */
export const ok = ((
	content: unknown,
	{ status = 200 }: AnyReplyOptions = FrozenEmpty,
) => new Reply(content, { status, success: true })) as unknown as OkFactory;

/**
 * Build an error {@link Reply} ({@link Fail}) from a payload and an optional
 * status (defaults to `400`).
 *
 * @example
 * ```typescript
 * const a = fail({ a: "v1" }); // status 400, success false
 *
 * const b = fail({ a: 1 }, { status: 401 }); // status 401
 * ```
 */
export const fail = ((
	content: unknown,
	{ status = 400 }: AnyReplyOptions = FrozenEmpty,
) => new Reply(content, { status, success: false })) as unknown as FailFactory;
