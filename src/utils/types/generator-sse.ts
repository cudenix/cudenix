import type { AnyFail, AnyOk } from "@/core/reply";

export type AnyGeneratorSSE = GeneratorSSE<AnyFail | AnyOk, string>;

export interface GeneratorSSE<
	Data extends AnyFail | AnyOk,
	Event extends string = "message",
> {
	data: Data;
	event?: Event;
	id?: string;
	retry?: number;
}
