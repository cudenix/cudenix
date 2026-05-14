export const merge = (
	object1: Record<PropertyKey, unknown>,
	object2: Record<PropertyKey, unknown>,
) => {
	for (const key in object2) {
		object1[key] = object2[key];
	}
};
