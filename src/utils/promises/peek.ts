export const peek = Bun.peek as <T>(
	value: T,
) => T extends Promise<unknown> ? unknown : T;

export const peekStatus = Bun.peek.status;
