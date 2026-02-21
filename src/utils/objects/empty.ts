// biome-ignore lint/complexity/useArrowFunction: <explanation>
export const Empty = function () {} as unknown as new () => Record<
	PropertyKey,
	unknown
>;

Empty.prototype = Object.create(null);
