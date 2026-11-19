import type { AnyFail, AnyOk } from "@/core/reply";

export type AnySSEFrame = SSEFrame<AnyFail | AnyOk, string>;

export interface SSEFrame<
	Data extends AnyFail | AnyOk,
	Event extends string = "message",
> {
	data: Data;
	event?: Event;
	id?: string;
	retry?: number;
}
