/**
 * Normalizes the separators accepted by the runtime route parser.
 */
export type NormalizePathSeparators<Path extends string> =
	Path extends `${infer Head}\\${infer Tail}`
		? NormalizePathSeparators<`${Head}/${Tail}`>
		: Path;
