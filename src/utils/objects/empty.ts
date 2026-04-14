// Biome-ignore lint/complexity/useArrowFunction: Is necessary for the prototype
export const Empty = function  Empty() {} as unknown as new () => Record<PropertyKey, unknown>;

Empty.prototype = Object.create(null);

export const FreezeEmpty = Object.freeze(new Empty());
