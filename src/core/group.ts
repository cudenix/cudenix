import type { AnyModule } from "@/core";
import { Empty } from "@/utils";

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

export interface GroupOptions<Prefix extends `/${string}`> {
	prefix?: Prefix;
}

export type AnyGroupOptions = GroupOptions<any>;

type Constructor = new (
	group: AnyGroupFn,
	options: AnyGroupOptions,
) => AnyGroup;

export const Group = function (
	this: AnyGroup,
	group: AnyGroupFn,
	options: AnyGroupOptions = new Empty(),
) {
	this.group = group;
	this.prefix = options.prefix ?? "";
	this.type = "GROUP";
} as unknown as Constructor;

export const group = <
	const Module extends AnyModule,
	const Prefix extends `/${string}`,
	const Return extends AnyModule,
>(
	group: GroupFn<Module, Return>,
	options: GroupOptions<Prefix> = new Empty(),
) => {
	return new Group(group, options) as Group<Module, Prefix, Return>;
};
