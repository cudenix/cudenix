import { AsyncLocalStorage } from "node:async_hooks";

import type { Context } from "@/context";

export const asyncLocalStorage = new AsyncLocalStorage<Context>();

export const getRequestContext = () => {
	return asyncLocalStorage.getStore();
};
