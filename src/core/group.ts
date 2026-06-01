import type { AnyModule } from "@/core/module";

/**
 * @module
 * Group chain link — encapsulate a sub-module so that links added inside the
 * factory (middlewares, stores, validators) only affect routes declared in
 * the group, while everything the parent had set up earlier (including
 * `.mount()` and prior middlewares) still flows in.
 */

/**
 * Options accepted by `module.group`. The `prefix` is concatenated with the
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
 * Wildcard alias matching any {@link GroupOptions} regardless of its prefix
 * parameter. Reach for it where the concrete prefix is erased — for example,
 * the runtime body of `module.group`, which destructures `prefix` without
 * caring about its literal type.
 *
 * @example
 * ```typescript
 * const fn = (options: AnyGroupOptions = {}) => options.prefix ?? "/";
 * ```
 */
export type AnyGroupOptions = GroupOptions<any>;

/**
 * Factory that receives a fresh inner module (already typed with the merged
 * prefix and the parent's accumulated stores, validators, successes, and
 * errors) and returns the configured module to mount. Whatever routes the
 * returned module declares are merged into the parent under the group's
 * prefix.
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
 * Wildcard alias matching any {@link GroupFn} regardless of its module or
 * return generics. Reach for it in chain storage and runtime dispatch where
 * the concrete generics are irrelevant — for example, the `handler` parameter
 * of the runtime `module.group`.
 *
 * @example
 * ```typescript
 * const fn: AnyGroupFn = (module) => module;
 * ```
 */
export type AnyGroupFn = GroupFn<any, any>;

/**
 * Compiled group descriptor pushed onto the chain by `module.group`. Pairs
 * the user-supplied {@link GroupFn} with a `"GROUP"` discriminator so the
 * chain walker can dispatch on link kind. The compiler walks the parent's
 * chain, instantiates an inner module that inherits the parent's prior links
 * (so prior middlewares and `.mount()` cascades still apply), and hands it to
 * the factory to gather routes. Anything the factory adds stays inside the
 * group — it is not appended to the parent's chain, so siblings declared
 * after the group are not affected.
 *
 * Built by the framework — application code rarely constructs one directly.
 *
 * @typeParam Module - Inner module type passed to the factory.
 * @typeParam Prefix - Subtree prefix mounted under the parent.
 * @typeParam Return - Inner module type the factory returns.
 * @example
 * ```typescript
 * const a: Group<AnyModule, "/v1", AnyModule> = {
 *   handler: (module) => module.route("GET", "/a", () => new Success("v1")),
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
	handler: GroupFn<Module, Return>;
	prefix: Prefix;
	type: "GROUP";
}

/**
 * Wildcard alias matching any {@link Group} regardless of its module, prefix,
 * or return generics. Reach for it in chain arrays and runtime helpers that
 * store mixed link kinds side-by-side.
 *
 * @example
 * ```typescript
 * const a: AnyGroup[] = [];
 * ```
 */
export type AnyGroup = Group<any, any, any>;
