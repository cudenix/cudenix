import type { AnyError } from "@/error";
import type { AnySuccess } from "@/success";

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
