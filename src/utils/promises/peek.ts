/**
 * Reads the value a fulfilled promise settled on.
 *
 * @example
 * ```typescript
 * peek(Promise.resolve("v1")); // "v1"
 * peek("v1"); // "v1"
 * ```
 */
// the return type narrows to the fulfilled value callers gate on
export const peek = Bun.peek as <T>(value: T | Promise<T>) => T;

/**
 * Reads the state of a promise.
 *
 * @example
 * ```typescript
 * peekStatus(Promise.resolve("v1")); // "fulfilled"
 * peekStatus(new Promise(() => {})); // "pending"
 * peekStatus("v1"); // "fulfilled"
 * ```
 */
export const peekStatus = Bun.peek.status;
