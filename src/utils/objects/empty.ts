export const Empty = function Empty() {
	// empty object constructor
} as unknown as new () => Record<PropertyKey, unknown>;

Empty.prototype = Object.create(null) as Record<PropertyKey, unknown>;

Object.freeze(Empty.prototype);
