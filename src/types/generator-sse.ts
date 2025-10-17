import type { AnyError, AnySuccess } from "@/core";

export interface GeneratorSSE<
	Data extends AnyError | AnySuccess,
	Event extends string = "message",
> {
	data: Data;
	event?: Event;
	id?: string;
	retry?: number;
}

export type AnyGeneratorSSE = GeneratorSSE<any, any>;
