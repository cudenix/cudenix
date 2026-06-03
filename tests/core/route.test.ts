import { describe, expectTypeOf, test } from "bun:test";

import type { DeveloperContext } from "@/core/context";
import "@/core/global";
import type { AnyError, AnySuccess } from "@/core/reply";
import type {
	AnyRoute,
	AnyRouteFn,
	AnyRouteHandler,
	AnyRouteOptions,
	ParseRoute,
	PathToObject,
	Route,
	RouteFn,
	RouteFnReturnGenerator,
	RouteFnReturnGeneratorEnvelope,
	RouteFnReturnGeneratorFrame,
	RouteHandler,
	RouteOptions,
	ValidatorsWithParams,
} from "@/core/route";
import type { AnyValidator, ValidatorOptions } from "@/core/validator";
import type { GeneratorSSE } from "@/utils/types/generator-sse";
import type { MaybePromise } from "@/utils/types/maybe-promise";
import type { RequiredKeys } from "@/utils/types/required-keys";

describe("PathToObject", () => {
	describe("structural shape", () => {
		test("should nest each slash segment into one level of record", () => {
			expectTypeOf<PathToObject<"a/b/c", "v1">>().branded.toEqualTypeOf<{
				a: { b: { c: "v1" } };
			}>();
		});

		test("should place the value directly under a single segment", () => {
			expectTypeOf<PathToObject<"a", "v1">>().branded.toEqualTypeOf<{
				a: "v1";
			}>();
		});

		test("should pass an object value through unchanged at the leaf", () => {
			expectTypeOf<
				PathToObject<"a/b", { c: number }>
			>().branded.toEqualTypeOf<{ a: { b: { c: number } } }>();
		});
	});

	describe("empty segments", () => {
		test("should not collapse an empty middle segment", () => {
			expectTypeOf<PathToObject<"a//b", "v1">>().branded.toEqualTypeOf<{
				a: { "": { b: "v1" } };
			}>();
		});

		test("should keep an empty-string key for a trailing slash", () => {
			expectTypeOf<PathToObject<"a/", "v1">>().branded.toEqualTypeOf<{
				a: { "": "v1" };
			}>();
		});
	});

	describe("input constraint", () => {
		test("should reject a non-string Path at compile time", () => {
			// @ts-expect-error - Path must extend string
			type _A = PathToObject<number, "v1">;
		});
	});
});

describe("ParseRoute", () => {
	describe("structural shape", () => {
		test("should fold a two-segment path into the lower-cased method leaf", () => {
			expectTypeOf<
				ParseRoute<"GET", "/a/b", { body: "v1" }, { 200: "v2" }>
			>().branded.toEqualTypeOf<{
				a: {
					b: {
						get: {
							method: "GET";
							path: "/a/b";
							request: { body: "v1" };
							response: { 200: "v2" };
						};
					};
				};
			}>();
		});

		test("should fold a single-segment path under its method leaf", () => {
			expectTypeOf<
				ParseRoute<"GET", "/a", unknown, unknown>
			>().branded.toEqualTypeOf<{
				a: {
					get: {
						method: "GET";
						path: "/a";
						request: unknown;
						response: unknown;
					};
				};
			}>();
		});
	});

	describe("root path", () => {
		test("should rekey the root '/' to an `index` leaf", () => {
			expectTypeOf<
				ParseRoute<"POST", "/", unknown, unknown>
			>().branded.toEqualTypeOf<{
				index: {
					post: {
						method: "POST";
						path: "/";
						request: unknown;
						response: unknown;
					};
				};
			}>();
		});
	});

	describe("method casing", () => {
		test("should key the leaf by the lower-cased method and tag the field upper-cased", () => {
			expectTypeOf<
				ParseRoute<"PATCH", "/a", unknown, unknown>
			>().branded.toEqualTypeOf<{
				a: {
					patch: {
						method: "PATCH";
						path: "/a";
						request: unknown;
						response: unknown;
					};
				};
			}>();
		});
	});

	describe("input constraint", () => {
		test("should reject a Path without a leading slash at compile time", () => {
			// @ts-expect-error - Path must start with '/'
			type _A = ParseRoute<"GET", "a/b", unknown, unknown>;
		});

		test("should reject a non-string Method at compile time", () => {
			// @ts-expect-error - Method must extend HttpMethod
			type _B = ParseRoute<number, "/a", unknown, unknown>;
		});
	});
});

describe("RouteFnReturnGeneratorEnvelope", () => {
	describe("structural shape", () => {
		test("should resolve to the union of error and success envelopes", () => {
			expectTypeOf<RouteFnReturnGeneratorEnvelope>().toEqualTypeOf<
				AnyError | AnySuccess
			>();
		});
	});

	describe("subtype relations", () => {
		test("should accept a success envelope as a member", () => {
			expectTypeOf<AnySuccess>().toExtend<RouteFnReturnGeneratorEnvelope>();
		});

		test("should accept an error envelope as a member", () => {
			expectTypeOf<AnyError>().toExtend<RouteFnReturnGeneratorEnvelope>();
		});
	});
});

describe("RouteFnReturnGeneratorFrame", () => {
	describe("structural shape", () => {
		test("should resolve to a `GeneratorSSE` of the envelope with a `string` event", () => {
			expectTypeOf<RouteFnReturnGeneratorFrame>().toEqualTypeOf<
				GeneratorSSE<RouteFnReturnGeneratorEnvelope, string>
			>();
		});

		test("should type the `data` payload as the envelope union", () => {
			expectTypeOf<RouteFnReturnGeneratorFrame["data"]>().toEqualTypeOf<
				AnyError | AnySuccess
			>();
		});

		test("should type the `event` channel as optional `string`", () => {
			expectTypeOf<RouteFnReturnGeneratorFrame["event"]>().toEqualTypeOf<
				string | undefined
			>();
		});
	});

	describe("subtype relations", () => {
		test("should accept a frame literal carrying a success payload", () => {
			expectTypeOf<{
				data: AnySuccess;
			}>().toExtend<RouteFnReturnGeneratorFrame>();
		});
	});
});

describe("RouteFnReturnGenerator", () => {
	describe("structural shape", () => {
		test("should resolve to the sync-or-async generator union", () => {
			expectTypeOf<RouteFnReturnGenerator>().toEqualTypeOf<
				| Generator<
						RouteFnReturnGeneratorFrame,
						RouteFnReturnGeneratorEnvelope | undefined
				  >
				| AsyncGenerator<
						RouteFnReturnGeneratorFrame,
						RouteFnReturnGeneratorEnvelope | undefined
				  >
			>();
		});
	});

	describe("subtype relations", () => {
		test("should accept a concrete synchronous generator", () => {
			expectTypeOf<
				Generator<
					RouteFnReturnGeneratorFrame,
					RouteFnReturnGeneratorEnvelope | undefined
				>
			>().toExtend<RouteFnReturnGenerator>();
		});

		test("should accept a concrete asynchronous generator", () => {
			expectTypeOf<
				AsyncGenerator<
					RouteFnReturnGeneratorFrame,
					RouteFnReturnGeneratorEnvelope | undefined
				>
			>().toExtend<RouteFnReturnGenerator>();
		});
	});
});

describe("ValidatorsWithParams", () => {
	describe("with declared params", () => {
		test("should add an inferred `params` slot alongside the validators", () => {
			expectTypeOf<
				ValidatorsWithParams<"/a/:p1", { body: { a: string } }>
			>().branded.toEqualTypeOf<{
				body: { a: string };
				params: { p1: string };
			}>();
		});

		test("should add a sole `params` slot to an empty validator map", () => {
			expectTypeOf<
				ValidatorsWithParams<"/:p1", NonNullable<unknown>>
			>().branded.toEqualTypeOf<{ params: { p1: string } }>();
		});
	});

	describe("without declared params", () => {
		test("should pass the validators through for a param-free path", () => {
			expectTypeOf<
				ValidatorsWithParams<"/a/b", { body: { a: string } }>
			>().branded.toEqualTypeOf<{ body: { a: string } }>();
		});

		test("should pass the validators through for the root path", () => {
			expectTypeOf<
				ValidatorsWithParams<"/", { body: { a: string } }>
			>().branded.toEqualTypeOf<{ body: { a: string } }>();
		});
	});

	describe("input constraint", () => {
		test("should reject a non-record Validators argument at compile time", () => {
			// @ts-expect-error - Validators must extend Record<PropertyKey, unknown>
			type _A = ValidatorsWithParams<"/a", string>;
		});
	});
});

describe("RouteFn", () => {
	describe("call signature", () => {
		test("should resolve to a unary function from the developer context to the Return", () => {
			expectTypeOf<
				RouteFn<
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>().toEqualTypeOf<
				(
					context: DeveloperContext<
						NonNullable<unknown>,
						NonNullable<unknown>
					>,
				) => MaybePromise<AnySuccess>
			>();
		});

		test("should declare exactly one parameter", () => {
			expectTypeOf<
				Parameters<
					RouteFn<
						"/a",
						MaybePromise<AnySuccess>,
						NonNullable<unknown>,
						NonNullable<unknown>
					>
				>["length"]
			>().toEqualTypeOf<1>();
		});
	});

	describe("Return parameter", () => {
		test("should thread a promise-wrapped success through to the return type", () => {
			expectTypeOf<
				ReturnType<
					RouteFn<
						"/a",
						MaybePromise<AnySuccess>,
						NonNullable<unknown>,
						NonNullable<unknown>
					>
				>
			>().toEqualTypeOf<MaybePromise<AnySuccess>>();
		});

		test("should thread an error envelope through to the return type", () => {
			expectTypeOf<
				ReturnType<
					RouteFn<
						"/a",
						AnyError,
						NonNullable<unknown>,
						NonNullable<unknown>
					>
				>
			>().toEqualTypeOf<AnyError>();
		});

		test("should thread a streaming generator through to the return type", () => {
			expectTypeOf<
				ReturnType<
					RouteFn<
						"/a",
						RouteFnReturnGenerator,
						NonNullable<unknown>,
						NonNullable<unknown>
					>
				>
			>().toEqualTypeOf<RouteFnReturnGenerator>();
		});
	});

	describe("Stores parameter", () => {
		test("should type `context.store` as the Stores parameter", () => {
			expectTypeOf<
				Parameters<
					RouteFn<"/a", AnyError, { a: string }, NonNullable<unknown>>
				>[0]["store"]
			>().toEqualTypeOf<{ a: string }>();
		});

		test("should type `context.store` as an empty object when Stores is empty", () => {
			expectTypeOf<
				Parameters<
					RouteFn<
						"/a",
						AnyError,
						NonNullable<unknown>,
						NonNullable<unknown>
					>
				>[0]["store"]
			>().toEqualTypeOf<NonNullable<unknown>>();
		});
	});

	describe("Validators parameter", () => {
		test("should keep `context.request.raw` typed as a `Request`", () => {
			expectTypeOf<
				Parameters<
					RouteFn<
						"/a",
						AnyError,
						NonNullable<unknown>,
						NonNullable<unknown>
					>
				>[0]["request"]["raw"]
			>().toEqualTypeOf<Request>();
		});

		test("should merge a declared validator slot onto `context.request`", () => {
			expectTypeOf<
				Parameters<
					RouteFn<
						"/a",
						AnyError,
						NonNullable<unknown>,
						{ body: { a: string } }
					>
				>[0]["request"]["body"]
			>().toEqualTypeOf<{ a: string }>();
		});

		test("should infer the `params` slot from the path onto `context.request`", () => {
			expectTypeOf<
				Parameters<
					RouteFn<
						"/a/:p1",
						AnyError,
						NonNullable<unknown>,
						NonNullable<unknown>
					>
				>[0]["request"]["params"]["p1"]
			>().toEqualTypeOf<string>();
		});

		test("should surface the full augmented `request` shape with raw and params", () => {
			expectTypeOf<
				Parameters<
					RouteFn<
						"/a/:p1",
						AnyError,
						NonNullable<unknown>,
						{ body: { a: string } }
					>
				>[0]["request"]
			>().branded.toEqualTypeOf<
				{ raw: Request } & {
					body: { a: string };
					params: { p1: string };
				}
			>();
		});
	});

	describe("subtype relations", () => {
		test("should accept a zero-argument handler returning the envelope", () => {
			expectTypeOf<() => AnySuccess>().toExtend<
				RouteFn<
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>();
		});

		test("should accept a narrower return through return covariance", () => {
			expectTypeOf<
				RouteFn<
					"/a",
					AnyError,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>().toExtend<
				RouteFn<
					"/a",
					AnyError | AnySuccess,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>();
		});
	});

	describe("rejection cases", () => {
		test("should reject a handler returning an unrelated type", () => {
			expectTypeOf<
				(
					context: DeveloperContext<
						NonNullable<unknown>,
						NonNullable<unknown>
					>,
				) => string
			>().not.toExtend<
				RouteFn<
					"/a",
					AnyError,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>();
		});

		test("should reject a handler that requires a second parameter", () => {
			expectTypeOf<
				(
					context: DeveloperContext<
						NonNullable<unknown>,
						NonNullable<unknown>
					>,
					extra: string,
				) => AnyError
			>().not.toExtend<
				RouteFn<
					"/a",
					AnyError,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>();
		});
	});

	describe("input constraint", () => {
		test("should reject a Path without a leading slash at compile time", () => {
			// @ts-expect-error - Path must start with '/'
			type _A = RouteFn<"a", any, any, any>;
		});
	});

	describe("AnyRouteFn", () => {
		test("should resolve to `RouteFn<any, any, any, any>`", () => {
			expectTypeOf<AnyRouteFn>().toEqualTypeOf<
				RouteFn<any, any, any, any>
			>();
		});

		test("should accept a concrete route function as a subtype", () => {
			expectTypeOf<
				RouteFn<
					"/a",
					AnyError,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>().toExtend<AnyRouteFn>();
		});

		test("should be usable as an array element type", () => {
			expectTypeOf<
				RouteFn<
					"/a",
					AnyError,
					NonNullable<unknown>,
					NonNullable<unknown>
				>[]
			>().toExtend<AnyRouteFn[]>();
		});
	});
});

describe("Route", () => {
	describe("required keys contract", () => {
		test("should mark the descriptor's non-optional keys as required", () => {
			expectTypeOf<
				RequiredKeys<
					Route<
						"GET",
						"/a",
						MaybePromise<AnySuccess>,
						NonNullable<unknown>,
						ValidatorOptions<{ body: { a: string } }>,
						NonNullable<unknown>
					>
				>
			>().toEqualTypeOf<
				"handler" | "method" | "path" | "sse" | "static" | "type"
			>();
		});
	});

	describe("descriptor shape", () => {
		test('should fix `type` to the `"ROUTE"` literal', () => {
			expectTypeOf<
				Route<
					"GET",
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					ValidatorOptions<{ body: { a: string } }>,
					NonNullable<unknown>
				>["type"]
			>().toEqualTypeOf<"ROUTE">();
		});

		test("should carry the Method generic on the `method` field", () => {
			expectTypeOf<
				Route<
					"GET",
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					ValidatorOptions<{ body: { a: string } }>,
					NonNullable<unknown>
				>["method"]
			>().toEqualTypeOf<"GET">();
		});

		test("should carry the Path generic on the `path` field", () => {
			expectTypeOf<
				Route<
					"GET",
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					ValidatorOptions<{ body: { a: string } }>,
					NonNullable<unknown>
				>["path"]
			>().toEqualTypeOf<"/a">();
		});

		test("should type the `sse` flag as `boolean`", () => {
			expectTypeOf<
				Route<
					"GET",
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					ValidatorOptions<{ body: { a: string } }>,
					NonNullable<unknown>
				>["sse"]
			>().toEqualTypeOf<boolean>();
		});

		test("should type the `static` flag as `boolean`", () => {
			expectTypeOf<
				Route<
					"GET",
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					ValidatorOptions<{ body: { a: string } }>,
					NonNullable<unknown>
				>["static"]
			>().toEqualTypeOf<boolean>();
		});

		test("should type the optional `jit` flag as `boolean | undefined`", () => {
			expectTypeOf<
				Route<
					"GET",
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					ValidatorOptions<{ body: { a: string } }>,
					NonNullable<unknown>
				>["jit"]
			>().toEqualTypeOf<boolean | undefined>();
		});

		test("should type the optional `validator` as `AnyValidator | undefined`", () => {
			expectTypeOf<
				Route<
					"GET",
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					ValidatorOptions<{ body: { a: string } }>,
					NonNullable<unknown>
				>["validator"]
			>().toEqualTypeOf<AnyValidator | undefined>();
		});
	});

	describe("`handler` property", () => {
		test("should reflect the merged validator output on the handler's `request`", () => {
			expectTypeOf<
				Parameters<
					Route<
						"GET",
						"/a",
						MaybePromise<AnySuccess>,
						NonNullable<unknown>,
						ValidatorOptions<{ body: { a: string } }>,
						NonNullable<unknown>
					>["handler"]
				>[0]["request"]["body"]
			>().toEqualTypeOf<{ a: string }>();
		});

		test("should keep `context.request.raw` typed as a `Request`", () => {
			expectTypeOf<
				Parameters<
					Route<
						"GET",
						"/a",
						MaybePromise<AnySuccess>,
						NonNullable<unknown>,
						ValidatorOptions<{ body: { a: string } }>,
						NonNullable<unknown>
					>["handler"]
				>[0]["request"]["raw"]
			>().toEqualTypeOf<Request>();
		});
	});

	describe("subtype relations", () => {
		test("should accept a matching literal descriptor as a subtype", () => {
			expectTypeOf<{
				handler: () => AnySuccess;
				method: "GET";
				path: "/a";
				sse: false;
				static: true;
				type: "ROUTE";
			}>().toExtend<
				Route<
					"GET",
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					ValidatorOptions<{ body: { a: string } }>,
					NonNullable<unknown>
				>
			>();
		});
	});

	describe("rejection cases", () => {
		test('should reject a descriptor whose `type` is not `"ROUTE"`', () => {
			expectTypeOf<{
				handler: () => AnySuccess;
				method: "GET";
				path: "/a";
				sse: false;
				static: true;
				type: "MIDDLEWARE";
			}>().not.toExtend<
				Route<
					"GET",
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					ValidatorOptions<{ body: { a: string } }>,
					NonNullable<unknown>
				>
			>();
		});

		test("should reject a descriptor missing the `handler`", () => {
			expectTypeOf<{
				method: "GET";
				path: "/a";
				sse: false;
				static: true;
				type: "ROUTE";
			}>().not.toExtend<
				Route<
					"GET",
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					ValidatorOptions<{ body: { a: string } }>,
					NonNullable<unknown>
				>
			>();
		});
	});

	describe("input constraint", () => {
		test("should reject a Path without a leading slash at compile time", () => {
			// @ts-expect-error - Path must start with '/'
			type _A = Route<"GET", "a", any, any, any, any>;
		});
	});

	describe("AnyRoute", () => {
		test("should resolve to `Route<any, any, any, any, any, any>`", () => {
			expectTypeOf<AnyRoute>().toEqualTypeOf<
				Route<any, any, any, any, any, any>
			>();
		});

		test('should keep `type` fixed to `"ROUTE"` even when erased', () => {
			expectTypeOf<AnyRoute["type"]>().toEqualTypeOf<"ROUTE">();
		});

		test("should keep the `handler` property present", () => {
			expectTypeOf<AnyRoute>().toHaveProperty("handler");
		});

		test("should keep the `method` property present", () => {
			expectTypeOf<AnyRoute>().toHaveProperty("method");
		});

		test("should keep the `path` property present", () => {
			expectTypeOf<AnyRoute>().toHaveProperty("path");
		});

		test("should keep the `sse` property present", () => {
			expectTypeOf<AnyRoute>().toHaveProperty("sse");
		});

		test("should keep the `static` property present", () => {
			expectTypeOf<AnyRoute>().toHaveProperty("static");
		});

		test("should keep the `type` property present", () => {
			expectTypeOf<AnyRoute>().toHaveProperty("type");
		});

		test("should accept a concrete route descriptor as a subtype", () => {
			expectTypeOf<
				Route<
					"GET",
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					ValidatorOptions<{ body: { a: string } }>,
					NonNullable<unknown>
				>
			>().toExtend<AnyRoute>();
		});

		test("should be usable as an array element type", () => {
			expectTypeOf<
				Route<
					"GET",
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					ValidatorOptions<{ body: { a: string } }>,
					NonNullable<unknown>
				>[]
			>().toExtend<AnyRoute[]>();
		});
	});
});

describe("RouteHandler", () => {
	describe("structural shape", () => {
		test("should resolve to the union of the route function and the static envelope", () => {
			expectTypeOf<
				RouteHandler<
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>().toEqualTypeOf<
				| RouteFn<
						"/a",
						MaybePromise<AnySuccess>,
						NonNullable<unknown>,
						NonNullable<unknown>
				  >
				| AnySuccess
			>();
		});
	});

	describe("subtype relations", () => {
		test("should accept a matching route function as the function form", () => {
			expectTypeOf<
				RouteFn<
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>().toExtend<
				RouteHandler<
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>();
		});

		test("should accept a success envelope as the static form", () => {
			expectTypeOf<AnySuccess>().toExtend<
				RouteHandler<
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>();
		});

		test("should accept an error envelope as the static form", () => {
			expectTypeOf<AnyError>().toExtend<
				RouteHandler<
					"/a",
					MaybePromise<AnyError>,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>();
		});
	});

	describe("rejection cases", () => {
		test("should reject an unrelated type as a handler", () => {
			expectTypeOf<string>().not.toExtend<
				RouteHandler<
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>();
		});
	});

	describe("AnyRouteHandler", () => {
		test("should resolve to `RouteHandler<any, any, any, any>`", () => {
			expectTypeOf<AnyRouteHandler>().toEqualTypeOf<
				RouteHandler<any, any, any, any>
			>();
		});

		test("should accept a concrete route handler as a subtype", () => {
			expectTypeOf<
				RouteHandler<
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					NonNullable<unknown>
				>
			>().toExtend<AnyRouteHandler>();
		});

		test("should be usable as a function parameter type", () => {
			expectTypeOf<(handler: AnyRouteHandler) => void>().toExtend<
				(
					handler: RouteHandler<
						"/a",
						MaybePromise<AnySuccess>,
						NonNullable<unknown>,
						NonNullable<unknown>
					>,
				) => void
			>();
		});

		test("should be usable as an array element type", () => {
			expectTypeOf<
				RouteHandler<
					"/a",
					MaybePromise<AnySuccess>,
					NonNullable<unknown>,
					NonNullable<unknown>
				>[]
			>().toExtend<AnyRouteHandler[]>();
		});
	});
});

describe("RouteOptions", () => {
	describe("structural shape", () => {
		test("should resolve to an object with optional `jit` and `validator`", () => {
			expectTypeOf<
				RouteOptions<ValidatorOptions<{ body: { a: string } }>>
			>().branded.toEqualTypeOf<{
				jit?: boolean;
				validator?: ValidatorOptions<{ body: { a: string } }>;
			}>();
		});

		test("should expose a `jit` property", () => {
			expectTypeOf<
				RouteOptions<ValidatorOptions<{ body: { a: string } }>>
			>().toHaveProperty("jit");
		});

		test("should expose a `validator` property", () => {
			expectTypeOf<
				RouteOptions<ValidatorOptions<{ body: { a: string } }>>
			>().toHaveProperty("validator");
		});
	});

	describe("optional modifier", () => {
		test("should mark every key optional (no required keys)", () => {
			expectTypeOf<
				RequiredKeys<
					RouteOptions<ValidatorOptions<{ body: { a: string } }>>
				>
			>().toBeNever();
		});

		test("should type the optional `jit` flag as `boolean | undefined`", () => {
			expectTypeOf<
				RouteOptions<ValidatorOptions<{ body: { a: string } }>>["jit"]
			>().toEqualTypeOf<boolean | undefined>();
		});

		test("should type the optional `validator` as the options plus `undefined`", () => {
			expectTypeOf<
				RouteOptions<
					ValidatorOptions<{ body: { a: string } }>
				>["validator"]
			>().toEqualTypeOf<
				ValidatorOptions<{ body: { a: string } }> | undefined
			>();
		});
	});

	describe("subtype relations", () => {
		test("should accept an empty object with both fields omitted", () => {
			expectTypeOf<NonNullable<unknown>>().toExtend<
				RouteOptions<ValidatorOptions<{ body: { a: string } }>>
			>();
		});

		test("should accept an object providing only `jit`", () => {
			expectTypeOf<{ jit: true }>().toExtend<
				RouteOptions<ValidatorOptions<{ body: { a: string } }>>
			>();
		});

		test("should accept an object providing only `validator`", () => {
			expectTypeOf<{
				validator: ValidatorOptions<{ body: { a: string } }>;
			}>().toExtend<
				RouteOptions<ValidatorOptions<{ body: { a: string } }>>
			>();
		});
	});

	describe("AnyRouteOptions", () => {
		test("should resolve to `RouteOptions<any>`", () => {
			expectTypeOf<AnyRouteOptions>().toEqualTypeOf<RouteOptions<any>>();
		});

		test("should expose a `jit` property", () => {
			expectTypeOf<AnyRouteOptions>().toHaveProperty("jit");
		});

		test("should expose a `validator` property", () => {
			expectTypeOf<AnyRouteOptions>().toHaveProperty("validator");
		});

		test("should accept a concrete options object as a subtype", () => {
			expectTypeOf<
				RouteOptions<ValidatorOptions<{ body: { a: string } }>>
			>().toExtend<AnyRouteOptions>();
		});
	});
});
