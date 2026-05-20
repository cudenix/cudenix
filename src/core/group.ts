import type { AnyModule } from "@/core/module";

/**
 * @module
 * Group chain unit: scoped sub-tree of routes nested under a prefix.
 */

/**
 * Options accepted by `Module.group`.
 *
 * `prefix` is appended to the parent module's accumulated path at compile
 * time to form the base under which every route defined inside the group is
 * registered. Each segment is normalized so that a lone `"/"` contributes
 * nothing — preventing double slashes — but otherwise the segments are
 * joined verbatim, which is why the leading slash is required at the type
 * level.
 *
 * @typeParam Prefix - Literal string type of the prefix, preserved through
 *   the type system so the routes defined inside the group can be inferred
 *   with their full, merged path.
 */
export interface GroupOptions<Prefix extends `/${string}`> {
	prefix?: Prefix;
}

/**
 * Convenience alias matching any {@link GroupOptions} regardless of the
 * prefix parameter.
 *
 * Reach for it where the concrete prefix is erased — for example, the
 * options argument of `Module.prototype.group`, which destructures the
 * prefix without caring about its literal type.
 */
export type AnyGroupOptions = GroupOptions<any>;

/**
 * Function signature of a group registered through `Module.group`.
 *
 * The compiler invokes the function with a freshly constructed module
 * whose prefix has already been merged from the parent module's
 * accumulated path and the group's own prefix, and whose chain has been
 * pre-loaded with every middleware, store, and validator accumulated up to
 * that point — including those inherited from ancestors, not only the
 * immediate parent. The function is expected to return a module — typically
 * the same instance, with routes (and optionally further units) chained on.
 * At compile time the routes from the returned module are folded into the
 * parent's route tree under the merged prefix, while any middlewares,
 * stores, and validators registered inside the group stay scoped to routes
 * defined inside it and do not affect units declared elsewhere in the
 * parent's chain.
 *
 * @typeParam Module - Type of the module handed to the group, already
 *   carrying the merged prefix and the parent's inherited chain state.
 * @typeParam Return - Type of the module returned by the group; its
 *   `routes` shape is intersected into the parent's route tree.
 */
export type GroupFn<Module extends AnyModule, Return extends AnyModule> = (
	module: Module,
) => Return;

/**
 * Convenience alias matching any {@link GroupFn} regardless of input or
 * return module parameters.
 *
 * Reach for it where the concrete generics are erased — for example, the
 * parameter type of `Module.prototype.group`, which receives whichever
 * group function the caller registered without seeing the routes it
 * defines.
 */
export type AnyGroupFn = GroupFn<any, any>;

/**
 * Internal descriptor for a group, pushed onto a module's chain by
 * `Module.group` and consumed by the compiler when it walks the chain.
 *
 * - `group` — user-supplied function invoked by the compiler when the
 *   group is reached.
 * - `prefix` — literal string forwarded from {@link GroupOptions}, or the
 *   empty string when the caller omitted `options.prefix`. The compiler
 *   treats both `""` and `"/"` as no-ops when concatenating the merged
 *   path.
 * - `type` — discriminant the compiler uses to tell groups apart from
 *   middlewares, validators, stores, nested modules, and routes while
 *   traversing the chain in declaration order.
 *
 * @typeParam Module - Type of the module handed to the group function.
 * @typeParam Prefix - Literal string prefix scoped to this group.
 * @typeParam Return - Type of the module returned by the group function.
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
 * Convenience alias matching any {@link Group} regardless of module,
 * prefix, or return parameters.
 *
 * Reach for it in container or registry types where the concrete generics
 * are irrelevant — for example, the heterogeneous `ModuleChain` array
 * that holds every unit attached to a module.
 */
export type AnyGroup = Group<any, any, any>;
