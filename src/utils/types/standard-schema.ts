/**
 * @module
 * Vendored copy of the Standard Schema V1 interface
 * (https://standardschema.dev), kept dependency-free on purpose. Mirrors the
 * upstream spec source — including the optional `options`/`libraryOptions`
 * channel of `validate`, which this framework never passes — and is the one
 * file in `src/utils` deliberately left without per-member documentation so
 * it can be diffed against upstream verbatim. Edit it only to track the spec.
 */

export interface StandardSchemaV1<Input = unknown, Output = Input> {
	readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
	export interface Props<Input = unknown, Output = Input> {
		readonly types?: Types<Input, Output> | undefined;
		readonly validate: (
			value: unknown,
			options?: StandardSchemaV1.Options | undefined,
		) => Result<Output> | Promise<Result<Output>>;
		readonly vendor: string;
		readonly version: 1;
	}

	export type Result<Output> = SuccessResult<Output> | FailureResult;

	export interface SuccessResult<Output> {
		readonly issues?: undefined;
		readonly value: Output;
	}

	export interface Options {
		readonly libraryOptions?: Record<string, unknown> | undefined;
	}

	export interface FailureResult {
		readonly issues: ReadonlyArray<Issue>;
	}

	export interface Issue {
		readonly message: string;
		readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
	}

	export interface PathSegment {
		readonly key: PropertyKey;
	}

	export interface Types<Input = unknown, Output = Input> {
		readonly input: Input;
		readonly output: Output;
	}

	export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
		Schema["~standard"]["types"]
	>["input"];

	export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
		Schema["~standard"]["types"]
	>["output"];
}
