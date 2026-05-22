/**
 * @module
 * Bidirectional type-equality conditional.
 */

/**
 * Resolve to `true` when `Type` and `Extends` are mutually assignable,
 * otherwise to `false`.
 *
 * A plain `Type extends Extends ? true : false` only checks assignability in
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
 * @example
 * ```typescript
 * type A = ExtendsType<string, string>; // true
 * type B = ExtendsType<"v1", string>;   // false (subtype only)
 * type C = ExtendsType<string, "v1">;   // false (supertype only)
 * ```
 */
export type ExtendsType<Type, Extends> = [Type, Extends] extends [Extends, Type]
	? true
	: false;
