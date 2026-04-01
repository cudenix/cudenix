import { AsyncLocalStorage } from "node:async_hooks";

import type { AnyDeveloperContext } from "@/core/context";
import { module } from "@/core/module";

export const ASYNC_LOCAL_STORAGE = new AsyncLocalStorage<AnyDeveloperContext>();

export const getRequestContext = () => {
	return ASYNC_LOCAL_STORAGE.getStore();
};

export const globalRequestContext = () => {
	return module().middleware(async (context, next) => {
		await ASYNC_LOCAL_STORAGE.run(context, next);
	});
};
