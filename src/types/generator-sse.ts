import type { AnyError } from "@/error";
import type { AnySuccess } from "@/success";

export interface GeneratorSSE<Data extends AnyError | AnySuccess> {
	data: Data;
	event?: string;
	id?: string;
	retry?: number;
}
