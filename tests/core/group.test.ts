import { describe, expectTypeOf, test } from "bun:test";

import type {
	AnyGroup,
	AnyGroupFn,
	AnyGroupOptions,
	Group,
	GroupFn,
	GroupOptions,
} from "@/core/group";
import type { AnyModule } from "@/core/module";
import type { RequiredKeys } from "@/types/required-keys";

describe("GroupOptions", () => {
	describe("structural shape", () => {
		test("should resolve to an object with an optional `prefix` carrying the literal", () => {
			expectTypeOf<GroupOptions<"/v1">>().branded.toEqualTypeOf<{
				prefix?: "/v1";
			}>();
		});

		test("should expose a `prefix` property", () => {
			expectTypeOf<GroupOptions<"/v1">>().toHaveProperty("prefix");
		});

		test("should type `prefix` as the literal plus `undefined`", () => {
			expectTypeOf<GroupOptions<"/v1">["prefix"]>().toEqualTypeOf<
				"/v1" | undefined
			>();
		});
	});

	describe("optional modifier", () => {
		test("should mark every key optional (no required keys)", () => {
			expectTypeOf<RequiredKeys<GroupOptions<"/v1">>>().toBeNever();
		});

		test("should accept an empty object with the prefix omitted", () => {
			expectTypeOf<NonNullable<unknown>>().toExtend<
				GroupOptions<"/v1">
			>();
		});

		test("should accept an object providing the matching prefix", () => {
			expectTypeOf<{ prefix: "/v1" }>().toExtend<GroupOptions<"/v1">>();
		});
	});

	describe("input constraint", () => {
		test("should reject a prefix without a leading slash at compile time", () => {
			// @ts-expect-error - Prefix must start with '/'
			type _A = GroupOptions<"v1">;
		});

		test("should reject an empty-string prefix at compile time", () => {
			// @ts-expect-error - Prefix must start with '/'
			type _B = GroupOptions<"">;
		});
	});

	describe("rejected inputs", () => {
		test("should reject an object whose prefix is a different literal", () => {
			expectTypeOf<{ prefix: "/v2" }>().not.toExtend<
				GroupOptions<"/v1">
			>();
		});

		test("should reject an object whose prefix is widened to `string`", () => {
			expectTypeOf<{ prefix: string }>().not.toExtend<
				GroupOptions<"/v1">
			>();
		});
	});

	describe("AnyGroupOptions", () => {
		test("should resolve to `GroupOptions` with an `any` prefix", () => {
			expectTypeOf<AnyGroupOptions>().toEqualTypeOf<GroupOptions<any>>();
		});

		test("should type `prefix` as `any`", () => {
			expectTypeOf<AnyGroupOptions["prefix"]>().toBeAny();
		});

		test("should expose a `prefix` property", () => {
			expectTypeOf<AnyGroupOptions>().toHaveProperty("prefix");
		});

		test("should accept any concrete `GroupOptions` as a subtype", () => {
			expectTypeOf<GroupOptions<"/v1">>().toExtend<AnyGroupOptions>();
		});

		test("should accept an empty object", () => {
			expectTypeOf<NonNullable<unknown>>().toExtend<AnyGroupOptions>();
		});
	});
});

describe("GroupFn", () => {
	describe("structural shape", () => {
		test("should resolve to a unary function from the inner module to the returned module", () => {
			expectTypeOf<GroupFn<AnyModule, AnyModule>>().toEqualTypeOf<
				(module: AnyModule) => AnyModule
			>();
		});
	});

	describe("parameter contract", () => {
		test("should accept the inner module as its sole parameter", () => {
			expectTypeOf<
				Parameters<GroupFn<AnyModule, AnyModule>>
			>().toEqualTypeOf<[AnyModule]>();
		});
	});

	describe("return contract", () => {
		test("should return the configured module", () => {
			expectTypeOf<
				ReturnType<GroupFn<AnyModule, AnyModule>>
			>().toEqualTypeOf<AnyModule>();
		});
	});

	describe("subtype relations", () => {
		test("should accept a zero-arg factory returning a module", () => {
			expectTypeOf<() => AnyModule>().toExtend<
				GroupFn<AnyModule, AnyModule>
			>();
		});

		test("should accept the identity factory from the JSDoc example", () => {
			expectTypeOf<(module: AnyModule) => AnyModule>().toExtend<
				GroupFn<AnyModule, AnyModule>
			>();
		});
	});

	describe("rejection cases", () => {
		test("should reject a factory requiring a second parameter", () => {
			expectTypeOf<
				(module: AnyModule, extra: number) => AnyModule
			>().not.toExtend<GroupFn<AnyModule, AnyModule>>();
		});

		test("should reject a factory returning a non-module value", () => {
			expectTypeOf<(module: AnyModule) => string>().not.toExtend<
				GroupFn<AnyModule, AnyModule>
			>();
		});

		test("should reject a bare module value that is not callable", () => {
			expectTypeOf<AnyModule>().not.toExtend<
				GroupFn<AnyModule, AnyModule>
			>();
		});
	});

	describe("AnyGroupFn", () => {
		test("should resolve to a function with an `any` parameter and `any` return", () => {
			expectTypeOf<AnyGroupFn>().toEqualTypeOf<(module: any) => any>();
		});

		test("should resolve to `GroupFn<any, any>`", () => {
			expectTypeOf<AnyGroupFn>().toEqualTypeOf<GroupFn<any, any>>();
		});

		test("should accept any concrete `GroupFn` as a subtype", () => {
			expectTypeOf<
				GroupFn<AnyModule, AnyModule>
			>().toExtend<AnyGroupFn>();
		});

		test("should accept the identity factory", () => {
			expectTypeOf<
				(module: AnyModule) => AnyModule
			>().toExtend<AnyGroupFn>();
		});

		test("should accept a zero-arg factory", () => {
			expectTypeOf<() => AnyModule>().toExtend<AnyGroupFn>();
		});
	});
});

describe("Group", () => {
	describe("required keys contract", () => {
		test("should mark `handler`, `prefix`, and `type` as required keys", () => {
			expectTypeOf<
				RequiredKeys<Group<AnyModule, "/v1", AnyModule>>
			>().toEqualTypeOf<"handler" | "prefix" | "type">();
		});
	});

	describe("`handler` property", () => {
		test("should type `handler` as a `GroupFn` over the module and return types", () => {
			expectTypeOf<
				Group<AnyModule, "/v1", AnyModule>["handler"]
			>().toEqualTypeOf<GroupFn<AnyModule, AnyModule>>();
		});

		test("should type `handler` as a unary module-to-module function", () => {
			expectTypeOf<
				Group<AnyModule, "/v1", AnyModule>["handler"]
			>().toEqualTypeOf<(module: AnyModule) => AnyModule>();
		});
	});

	describe("`prefix` property", () => {
		test("should carry the literal prefix", () => {
			expectTypeOf<
				Group<AnyModule, "/v1", AnyModule>["prefix"]
			>().toEqualTypeOf<"/v1">();
		});

		test("should preserve a union of prefixes on the property", () => {
			expectTypeOf<
				Group<AnyModule, "/a" | "/b", AnyModule>["prefix"]
			>().toEqualTypeOf<"/a" | "/b">();
		});
	});

	describe("`type` discriminant", () => {
		test("should fix `type` to the literal 'GROUP'", () => {
			expectTypeOf<
				Group<AnyModule, "/v1", AnyModule>["type"]
			>().toEqualTypeOf<"GROUP">();
		});
	});

	describe("input constraint", () => {
		test("should reject a prefix without a leading slash at compile time", () => {
			// @ts-expect-error - Prefix must start with '/'
			type _A = Group<AnyModule, "v1", AnyModule>;
		});
	});

	describe("subtype relations", () => {
		test("should accept a matching literal object as a subtype", () => {
			expectTypeOf<{
				handler: (module: AnyModule) => AnyModule;
				prefix: "/v1";
				type: "GROUP";
			}>().toExtend<Group<AnyModule, "/v1", AnyModule>>();
		});
	});

	describe("rejection cases", () => {
		test("should reject an object whose `type` is not 'GROUP'", () => {
			expectTypeOf<{
				handler: (module: AnyModule) => AnyModule;
				prefix: "/v1";
				type: "MODULE";
			}>().not.toExtend<Group<AnyModule, "/v1", AnyModule>>();
		});

		test("should reject an object missing the `handler`", () => {
			expectTypeOf<{ prefix: "/v1"; type: "GROUP" }>().not.toExtend<
				Group<AnyModule, "/v1", AnyModule>
			>();
		});

		test("should reject an object whose prefix is a different literal", () => {
			expectTypeOf<{
				handler: (module: AnyModule) => AnyModule;
				prefix: "/v2";
				type: "GROUP";
			}>().not.toExtend<Group<AnyModule, "/v1", AnyModule>>();
		});
	});

	describe("AnyGroup", () => {
		test("should resolve to `Group<any, any, any>`", () => {
			expectTypeOf<AnyGroup>().toEqualTypeOf<Group<any, any, any>>();
		});

		test("should keep `type` fixed to 'GROUP' even when erased", () => {
			expectTypeOf<AnyGroup["type"]>().toEqualTypeOf<"GROUP">();
		});

		test("should type `prefix` as `any`", () => {
			expectTypeOf<AnyGroup["prefix"]>().toBeAny();
		});

		test("should type `handler` as `AnyGroupFn`", () => {
			expectTypeOf<AnyGroup["handler"]>().toEqualTypeOf<AnyGroupFn>();
		});

		test("should accept any concrete `Group` as a subtype", () => {
			expectTypeOf<
				Group<AnyModule, "/v1", AnyModule>
			>().toExtend<AnyGroup>();
		});
	});
});
