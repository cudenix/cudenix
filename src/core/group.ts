import type { AnyModule } from "@/core/module";

/**
 * Options accepted by `module.group`. The optional `prefix` must start with
 * `/`.
 *
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
 * Any {@link GroupOptions} regardless of its prefix generic. Use it where the
 * concrete prefix is irrelevant.
 *
 * @example
 * ```typescript
 * const fn = (options: AnyGroupOptions = {}) => options.prefix ?? "/";
 * ```
 */
export type AnyGroupOptions = GroupOptions<any>;

/**
 * Factory that receives a fresh inner module and returns the configured module
 * to mount.
 *
 * @example
 * ```typescript
 * const fn: GroupFn<AnyModule, AnyModule> = (module) =>
 *   module.route("GET", "/a", () => ok("v1"));
 * ```
 */
export type GroupFn<Module extends AnyModule, Return extends AnyModule> = (
	module: Module,
) => Return;

/**
 * Any {@link GroupFn} regardless of its module or return generics. Use it
 * where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const fn: AnyGroupFn = (module) => module;
 * ```
 */
export type AnyGroupFn = GroupFn<any, any>;

/**
 * Compiled {@link GroupFn} descriptor tagged `"GROUP"`.
 *
 * @example
 * ```typescript
 * const a: Group<AnyModule, "/v1", AnyModule> = {
 *   handler: (module) => module.route("GET", "/a", () => ok("v1")),
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
 * Any {@link Group} regardless of its module, prefix, or return generics. Use
 * it where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyGroup[] = [];
 * ```
 */
export type AnyGroup = Group<any, any, any>;
