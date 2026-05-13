import type { AnyModule } from "@/core/module";

export interface GroupOptions<Prefix extends `/${string}`> {
	prefix?: Prefix;
}

export type AnyGroupOptions = GroupOptions<any>;

export type GroupFn<Module extends AnyModule, Return extends AnyModule> = (
	module: Module,
) => Return;

export type AnyGroupFn = GroupFn<any, any>;

export interface Group<
	Module extends AnyModule,
	Prefix extends `/${string}`,
	Return extends AnyModule,
> {
	group: GroupFn<Module, Return>;
	prefix: Prefix;
	type: "GROUP";
}

export type AnyGroup = Group<any, any, any>;
