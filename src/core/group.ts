import type { AnyModule } from "@/core/module";

/**
 * @module
 * Group chain unit: scoped sub-tree of routes nested under a prefix.
 */

/**
 * Options accepted by `Module.group`.
 *
 * `prefix` is concatenated with the parent module's path at compile time
 * to form the base under which every route defined inside the group is
 * registered. Because the parent's path and the group's prefix are joined
 * verbatim, the leading slash is required so the merged path always
 * remains well-formed.
 *
 * @typeParam Prefix - Literal string type of the prefix, preserved through
 *   the type system so the routes defined inside the group can be inferred
 *   with their full, merged path.
 * @example
 * ```typescript
 * new Module().group(
 *   (module) => module.route("GET", "/", () => new Success("admin home")),
 *   { prefix: "/admin" },
 * );
 * ```
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
 * whose prefix has already been merged from the parent's path and the
 * group's own prefix, and whose chain has been pre-loaded with every
 * middleware, store, and validator inherited from the parent. The
 * function is expected to return a module — typically the same instance,
 * with routes (and optionally further units) chained on. At compile time
 * the routes from the returned module are folded into the parent's route
 * tree under the merged prefix, while any middlewares, stores, and
 * validators registered inside the group stay scoped to routes defined
 * inside it and do not affect units declared elsewhere in the parent's
 * chain.
 *
 * @typeParam Module - Type of the module handed to the group, already
 *   carrying the merged prefix and the parent's inherited chain state.
 * @typeParam Return - Type of the module returned by the group; its
 *   `routes` shape is intersected into the parent's route tree.
 * @example
 * ```typescript
 * new Module().group(
 *   (module) =>
 *     module
 *       .route("GET", "/", () => new Success("listing users"))
 *       .route("GET", "/:id", (context) =>
 *         new Success(context.request.params.id),
 *       ),
 *   { prefix: "/users" },
 * );
 * ```
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
 * - `prefix` — literal string forwarded from {@link GroupOptions},
 *   unchanged.
 * - `type` — discriminant the compiler uses to tell groups apart from
 *   middlewares, validators, stores, nested modules, and routes while
 *   traversing the chain in declaration order.
 *
 * @typeParam Module - Type of the module handed to the group function.
 * @typeParam Prefix - Literal string prefix scoped to this group.
 * @typeParam Return - Type of the module returned by the group function.
 * @example
 * ```typescript
 * const link: Group<AnyModule, "/users", AnyModule> = {
 *   group: (module) =>
 *     module.route("GET", "/:id", (context) =>
 *       new Success(context.request.params.id),
 *     ),
 *   prefix: "/users",
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
 * Convenience alias matching any {@link Group} regardless of module,
 * prefix, or return parameters.
 *
 * Reach for it in container or registry types where the concrete generics
 * are irrelevant — for example, the heterogeneous `ModuleChain` array
 * that holds every unit attached to a module.
 */
export type AnyGroup = Group<any, any, any>;
