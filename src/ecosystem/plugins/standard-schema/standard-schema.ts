import type { Cudenix } from "@/core/cudenix";
import type { ValidatorCompiler } from "@/core/validator";
import { Empty, FrozenEmpty } from "@/utils/objects/empty";

interface StandardSchemaOptions {
	compilers?: Record<string, ValidatorCompiler>;
}

/**
 * Registers the Standard Schema validator, optionally accelerated by a
 * compiler per schema vendor.
 *
 * @example
 * ```typescript
 * app.plugins([
 *   initializeStandardSchema({
 *     compilers: {
 *       typebox: (schema) => {
 *         const check = TypeCompiler.Compile(schema);
 *
 *         return {
 *           run: (input) =>
 *             check.Check(input)
 *               ? { content: input, success: true }
 *               : {
 *                   content: [...check.Errors(input)].map(
 *                     ({ message, path }) => ({ message, path }),
 *                   ),
 *                   success: false,
 *                 },
 *           sync: true,
 *         };
 *       },
 *     },
 *   }),
 * ]);
 * ```
 *
 * @example
 * ```typescript
 * // valibot marks asynchrony on the schema, zod cannot: leave zod on the fallback
 * const valibot = (schema) =>
 *   schema.async
 *     ? undefined
 *     : {
 *         run: (input) => {
 *           const returned = schema["~standard"].validate(input);
 *
 *           return {
 *             content: returned.issues ?? returned.value,
 *             success: !returned.issues,
 *           };
 *         },
 *         sync: true,
 *       };
 * ```
 */
export const initializeStandardSchema = ({
	compilers,
}: StandardSchemaOptions = FrozenEmpty) =>
	function initializeStandardSchema(this: Cudenix) {
		this.memory.validator = async (schema: any, input: unknown) => {
			const returned = await schema["~standard"].validate(input);

			return {
				content: returned.issues ?? returned.value,
				success: !returned.issues,
			};
		};

		if (!compilers) {
			return;
		}

		const vendors = Object.assign(new Empty(), compilers) as Record<
			string,
			ValidatorCompiler
		>;
		// a compiler applies only to the vendor that registered it
		const validatorCompiler: ValidatorCompiler = (schema, type) => {
			const vendor = schema?.["~standard"]?.vendor;

			return vendor === undefined
				? undefined
				: vendors[vendor]?.(schema, type);
		};

		this.memory.validatorCompiler = validatorCompiler;
	};
