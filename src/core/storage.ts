import { AsyncLocalStorage } from "node:async_hooks";

import type { Context } from "@/core";

export const asyncLocalStorage = new AsyncLocalStorage<Context>();

export const getRequestContext = () => {
	return asyncLocalStorage.getStore();
};
