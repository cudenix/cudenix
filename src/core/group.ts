import type { AnyModule } from "@/core/module";

/**
 * @module
 * Group chain link — encapsulate a sub-module so that links added inside the
 * factory (middlewares, stores, validators) only affect routes declared in
 * the group, while everything the parent had set up earlier (including
 * `.extends()` and prior middlewares) still flows in.
 */

/**
 * Options accepted by `module.group()`. The `prefix` is concatenated with the
 * parent module's prefix when the inner module is mounted; omit it to keep the
 * inner routes at the parent's root.
 *
 * Must start with `/` so the type-level path merger can normalize the
 * boundary slash.
 *
 * @typeParam Prefix - Subtree prefix. Must start with `/`.
 * @example
 * ```typescript
 * const a: GroupOptions<"/v1"> = { prefix: "/v1" };
 * const b: GroupOptions<"/"> = {};
 * ```
 */
export interface GroupOptions<Prefix extends `/${string}`> {
	prefix?: Prefix;
}

/**
 * Erased {@link GroupOptions} for runtime call sites that do not need to
 * preserve the literal prefix.
 *
 * @example
 * ```typescript
 * const fn = (options: AnyGroupOptions = {}) => options.prefix ?? "/";
 * ```
 */
export type AnyGroupOptions = GroupOptions<any>;

/**
 * Factory that receives a fresh inner module (already typed with the merged
 * prefix and the parent's stores/validators) and returns the configured
 * module to mount. Whatever routes the returned module declares are merged
 * into the parent under the group's prefix.
 *
 * @typeParam Module - Inner module handed to the factory.
 * @typeParam Return - Inner module the factory returns after configuration.
 * @example
 * ```typescript
 * const fn: GroupFn<AnyModule, AnyModule> = (module) =>
 *   module.route("GET", "/a", () => new Success("v1"));
 * ```
 */
export type GroupFn<Module extends AnyModule, Return extends AnyModule> = (
	module: Module,
) => Return;

/**
 * Erased {@link GroupFn} for chain storage and runtime dispatch — keeps the
 * structural shape without carrying the inner module's full generic baggage.
 *
 * @example
 * ```typescript
 * const fn: AnyGroupFn = (module) => module;
 * ```
 */
export type AnyGroupFn = GroupFn<any, any>;

/**
 * Chain link emitted by `module.group()`. The compiler walks the parent's
 * chain, instantiates an inner module that inherits the parent's prior links
 * (so prior middlewares and `.extends()` cascades still apply), and hands it
 * to {@link GroupFn} to gather routes. Anything the factory adds stays inside
 * the group — it is not appended to the parent's chain, so siblings declared
 * after the group are not affected.
 *
 * The `type: "GROUP"` discriminator is what the chain walker matches on — do
 * not change it manually.
 *
 * @typeParam Module - Inner module type passed to the factory.
 * @typeParam Prefix - Subtree prefix mounted under the parent.
 * @typeParam Return - Inner module type the factory returns.
 * @example
 * ```typescript
 * const group: Group<AnyModule, "/v1", AnyModule> = {
 *   group: (module) => module.route("GET", "/a", () => new Success("v1")),
 *   prefix: "/v1",
 *   type: "GROUP",
 * };
 * ```
 */
export interface Group<
	Module extends AnyModule,
	Prefix extends `/${string}`,
	Return extends AnyModule,
> {
	group: GroupFn<Module, Return>;
	prefix: Prefix;
	type: "GROUP";
}

/**
 * Erased {@link Group} for chain arrays and runtime helpers that store mixed
 * link types side-by-side.
 *
 * @example
 * ```typescript
 * const links: AnyGroup[] = [];
 * ```
 */
export type AnyGroup = Group<any, any, any>;
