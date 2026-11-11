export interface StandardSchemaV1<Input = unknown, Output = Input> {
	readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
	export interface FailureResult {
		readonly issues: readonly Issue[];
	}

	export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
		Schema["~standard"]["types"]
	>["input"];

	export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
		Schema["~standard"]["types"]
	>["output"];

	export interface Issue {
		readonly message: string;
		readonly path?: readonly (PathSegment | PropertyKey)[] | undefined;
	}

	export interface Options {
		readonly libraryOptions?: Record<string, unknown> | undefined;
	}

	export interface PathSegment {
		readonly key: PropertyKey;
	}

	export interface Props<Input = unknown, Output = Input> {
		readonly types?: Types<Input, Output> | undefined;
		validate(
			value: unknown,
			options?: StandardSchemaV1.Options,
		): Promise<Result<Output>> | Result<Output>;
		readonly vendor: string;
		readonly version: 1;
	}

	export type Result<Output> = FailureResult | SuccessResult<Output>;

	export interface SuccessResult<Output> {
		readonly issues?: undefined;
		readonly value: Output;
	}

	export interface Types<Input = unknown, Output = Input> {
		readonly input: Input;
		readonly output: Output;
	}
}
