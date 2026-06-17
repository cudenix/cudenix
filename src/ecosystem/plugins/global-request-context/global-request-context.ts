import { AsyncLocalStorage } from "node:async_hooks";

import type { AnyContext } from "@/core/context";
import { Module } from "@/core/module";

const ASYNC_LOCAL_STORAGE = new AsyncLocalStorage<AnyContext>();

export const getRequestContext = () => ASYNC_LOCAL_STORAGE.getStore();

export const globalRequestContext = () =>
	new Module().middleware(async (context, next) => {
		await ASYNC_LOCAL_STORAGE.run(context, next);
	});
