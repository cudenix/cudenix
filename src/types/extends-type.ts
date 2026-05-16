/**
 * @module
 * Bidirectional type-equality conditional.
 */

/**
 * Resolve to `True` when `Type` and `Extends` are mutually assignable,
 * otherwise to `False`.
 *
 * A plain `Type extends Extends ? True : False` only checks assignability in
 * one direction, so it accepts subtypes that are not actually the same
 * type. Comparing the tuples `[Type, Extends]` against `[Extends, Type]`
 * forces the relation to hold both ways — equivalent to a strict equality
 * probe at the type level. The tuple wrapping also suppresses the implicit
 * distribution that conditional types perform over naked union operands,
 * so the comparison treats `Type` as a single shape rather than splitting
 * it member-by-member.
 *
 * @typeParam Type - Candidate type to test.
 * @typeParam Extends - Reference type compared against `Type`.
 * @typeParam True - Branch returned when both types are mutually assignable.
 *   Defaults to `Type`, so by default a match passes the input through.
 * @typeParam False - Branch returned otherwise. Defaults to `Type`, making
 *   the default behavior "pass through" rather than producing `never`.
 * @example
 * ```typescript
 * type A = ExtendsType<string, string, "yes", "no">; // "yes"
 * type B = ExtendsType<"foo", string, "yes", "no">;  // "no" (subtype only)
 * type C = ExtendsType<string, "foo", "yes", "no">;  // "no" (supertype only)
 * ```
 */
export type ExtendsType<Type, Extends, True = Type, False = Type> = [
	Type,
	Extends,
] extends [Extends, Type]
	? True
	: False;
